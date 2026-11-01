// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, products, purchaseOrderItems, purchaseOrders, suppliers } from "@/lib/db/schema";
import {
  approvePurchaseOrder, cancelPurchaseOrder, createPurchaseOrder, getSupplierBalance,
  receiveGoods, recordSupplierInvoice, recordSupplierPayment,
} from "@/lib/purchase-orders";

const tag = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
async function world() {
  const t = tag();
  const [maker] = await db.insert(admins).values({ email: `po-m-${t}@test.local`, passwordHash: "x", staffRole: "MANAGER" }).returning();
  const [boss] = await db.insert(admins).values({ email: `po-o-${t}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
  const [sup] = await db.insert(suppliers).values({ name: `Sup ${t}`, status: "active" }).returning();
  const [p] = await db.insert(products).values({ sku: `PO-${t}`, title: "PO item", status: "active" }).returning();
  return { maker, boss, sup, p };
}
async function approved(w: Awaited<ReturnType<typeof world>>, qty = 10, cost = 5000) {
  const { poNumber } = await createPurchaseOrder({ supplierId: w.sup.id, createdBy: w.maker.id, lines: [{ productId: w.p.id, quantity: qty, unitCost: cost }] });
  await approvePurchaseOrder({ poNumber, approverId: w.boss.id, approverRole: "OWNER", hasPermission: true });
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
  const [item] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, po.id));
  return { poNumber, item };
}
const stock = async (id: number) => (await db.select().from(products).where(eq(products.id, id)))[0].stock;

describe("purchasing (integration)", () => {
  it("a PO does not change stock until goods are received; partial then full", async () => {
    const w = await world();
    const { poNumber, item } = await approved(w);
    expect(await stock(w.p.id)).toBe(0);

    expect((await receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 6, rejected: 1, rejectionNote: "cracked" }] })).status).toBe("PARTIALLY_RECEIVED");
    expect(await stock(w.p.id)).toBe(6);

    await expect(receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 5, rejected: 0 }] })).rejects.toThrow(/more than was ordered/);
    expect((await receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 4, rejected: 0 }] })).status).toBe("RECEIVED");
    expect(await stock(w.p.id)).toBe(10);
    await expect(receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 1, rejected: 0 }] })).rejects.toThrow(/approved orders/);
  });

  it("cannot receive an unapproved order, and approval rules hold", async () => {
    const w = await world();
    const { poNumber } = await createPurchaseOrder({ supplierId: w.sup.id, createdBy: w.maker.id, lines: [{ productId: w.p.id, quantity: 1, unitCost: 100 }] });
    await expect(receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: 1, accepted: 1, rejected: 0 }] })).rejects.toThrow(/approved orders/);
    await expect(approvePurchaseOrder({ poNumber, approverId: w.maker.id, approverRole: "MANAGER", hasPermission: true })).rejects.toThrow(/someone other/);
    await approvePurchaseOrder({ poNumber, approverId: w.boss.id, approverRole: "OWNER", hasPermission: true });
    await expect(approvePurchaseOrder({ poNumber, approverId: w.boss.id, approverRole: "OWNER", hasPermission: true })).rejects.toThrow(/not awaiting/);
  });

  it("two simultaneous receipts can't exceed the ordered quantity", async () => {
    const w = await world();
    const { poNumber, item } = await approved(w, 10);
    const r = await Promise.allSettled([
      receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 7, rejected: 0 }] }),
      receiveGoods({ poNumber, receivedBy: w.boss.id, lines: [{ poItemId: item.id, accepted: 7, rejected: 0 }] }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await stock(w.p.id)).toBe(7);
  });

  it("cancel only before receipt", async () => {
    const w = await world();
    const a = await approved(w);
    await cancelPurchaseOrder(a.poNumber);
    const b = await approved(w);
    await receiveGoods({ poNumber: b.poNumber, receivedBy: w.boss.id, lines: [{ poItemId: b.item.id, accepted: 1, rejected: 0 }] });
    await expect(cancelPurchaseOrder(b.poNumber)).rejects.toThrow(/nothing received/);
  });

  it("supplier balance = invoices − payments; overpay and duplicate invoice refused", async () => {
    const w = await world();
    const { poNumber } = await approved(w);
    await recordSupplierInvoice({ supplierId: w.sup.id, poNumber, invoiceNumber: "INV-1", amount: 50000, createdBy: w.boss.id });
    await expect(recordSupplierInvoice({ supplierId: w.sup.id, invoiceNumber: "INV-1", amount: 1, createdBy: w.boss.id })).rejects.toThrow(/already recorded/);
    await recordSupplierPayment({ supplierId: w.sup.id, amount: 20000, method: "BANK", paidBy: w.boss.id });
    expect((await getSupplierBalance(db, w.sup.id)).balance).toBe(30000);
    await expect(recordSupplierPayment({ supplierId: w.sup.id, amount: 30001, method: "BANK", paidBy: w.boss.id })).rejects.toThrow(/more than the outstanding/);
    const race = await Promise.allSettled([
      recordSupplierPayment({ supplierId: w.sup.id, amount: 30000, method: "CASH", paidBy: w.boss.id }),
      recordSupplierPayment({ supplierId: w.sup.id, amount: 30000, method: "CASH", paidBy: w.boss.id }),
    ]);
    expect(race.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await getSupplierBalance(db, w.sup.id)).balance).toBe(0);
  });
});
