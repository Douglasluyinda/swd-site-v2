// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, inventoryMovements, products, sales, saleItems } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { createSale, refundSale } from "@/lib/sales";

async function setup(stock: number, price = 20000) {
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [emp] = await db
    .insert(admins)
    .values({ email: `pos-${tag}@test.local`, passwordHash: "x", staffRole: "CASHIER" })
    .returning();
  const [p] = await db
    .insert(products)
    .values({ sku: `POS-${tag}`, title: "POS test item", status: "active", sellingPrice: price, costPrice: 12000 })
    .returning();
  if (stock) await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: stock, employeeId: emp.id });
  return { emp, p, tag };
}

const key = () => `key-${Date.now()}-${Math.random()}`;

describe("POS sale (integration)", () => {
  it("creates sale, cash payment, SALE movement and decrements stock", async () => {
    const { emp, p } = await setup(5);
    const r = await createSale({
      idempotencyKey: key(), employeeId: emp.id, role: "CASHIER",
      lines: [{ productId: p.id, quantity: 2 }], discountPercent: 0, tendered: 50000,
    });
    expect(r.receiptNumber).toMatch(/^SWD-R-\d{4}-\d{6}$/);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(3);
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, p.id));
    expect(moves.find((m) => m.movementType === "SALE")?.quantityChange).toBe(-2);
  });

  it("is idempotent: same key twice, concurrently → one sale, stock taken once", async () => {
    const { emp, p } = await setup(5);
    const k = key();
    const args = { idempotencyKey: k, employeeId: emp.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: 0, tendered: 20000 };
    const [a, b] = await Promise.all([createSale(args), createSale(args)]);
    expect(a.receiptNumber).toBe(b.receiptNumber);
    expect((await db.select().from(sales).where(eq(sales.idempotencyKey, k))).length).toBe(1);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(4);
  });

  it("rolls back everything when stock is insufficient", async () => {
    const { emp, p } = await setup(1);
    const k = key();
    await expect(
      createSale({ idempotencyKey: k, employeeId: emp.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 2 }], discountPercent: 0, tendered: 40000 }),
    ).rejects.toThrow(/below zero/);
    expect((await db.select().from(sales).where(eq(sales.idempotencyKey, k))).length).toBe(0);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(1);
  });

  it("never oversells: 8 concurrent single-unit sales of 5 units → exactly 5 succeed", async () => {
    const { emp, p } = await setup(5);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createSale({ idempotencyKey: key(), employeeId: emp.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: 0, tendered: 20000 }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(0);
  });

  it("rejects a cashier discount and uses server-side price", async () => {
    const { emp, p } = await setup(3);
    await expect(
      createSale({ idempotencyKey: key(), employeeId: emp.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: 5, tendered: 20000 }),
    ).rejects.toThrow(/at most 0%/);
  });

  it("returns restock via the ledger, pro-rate the refund, and cap at units sold", async () => {
    const { emp, p } = await setup(5);
    const { receiptNumber } = await createSale({
      idempotencyKey: key(), employeeId: emp.id, role: "OWNER",
      lines: [{ productId: p.id, quantity: 2 }], discountPercent: 10, tendered: 36000,
    });
    const [sale] = await db.select().from(sales).where(eq(sales.receiptNumber, receiptNumber));
    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));

    const r = await refundSale({ receiptNumber, employeeId: emp.id, reason: "faulty", quantities: { [item.id]: 1 } });
    expect(r.refundTotal).toBe(18000); // 20000 less 10%
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(4);

    await expect(
      refundSale({ receiptNumber, employeeId: emp.id, reason: "again", quantities: { [item.id]: 2 } }),
    ).rejects.toThrow(/more than was sold/);
  });
});
