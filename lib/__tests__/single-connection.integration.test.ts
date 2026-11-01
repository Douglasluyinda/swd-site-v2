// Regression: production runs the DB pool at max=1. Any code that touches the
// global `db` while a transaction is open then waits forever for a second
// connection. This runs a full sale + return on a 1-connection pool and fails
// (by timeout) if that ever comes back.
import { afterAll, describe, expect, it, vi } from "vitest";

describe("sale + return on a single-connection pool", () => {
  it("completes without deadlocking", { timeout: 15000 }, async () => {
    vi.stubEnv("DB_POOL_MAX", "1");
    vi.resetModules();
    const { db } = await import("@/lib/db/client");
    const { admins, products, saleItems, sales } = await import("@/lib/db/schema");
    const { applyStockMovement } = await import("@/lib/inventory");
    const { createSale, refundSale } = await import("@/lib/sales");
    const { openSession } = await import("@/lib/cash-sessions");
    const { eq } = await import("drizzle-orm");

    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [emp] = await db.insert(admins).values({ email: `one-${tag}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [p] = await db.insert(products).values({ sku: `ONE-${tag}`, title: "Pool test", status: "active", sellingPrice: 10000 }).returning();
    await openSession(emp.id, 0);
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 3, employeeId: emp.id });

    const { receiptNumber } = await createSale({
      idempotencyKey: `pool-${tag}`, employeeId: emp.id, role: "OWNER",
      lines: [{ productId: p.id, quantity: 2 }], discountPercent: 0, tendered: 20000,
    });
    const [sale] = await db.select().from(sales).where(eq(sales.receiptNumber, receiptNumber));
    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    const r = await refundSale({ receiptNumber, employeeId: emp.id, reason: "test", quantities: { [item.id]: 1 } });
    expect(r.refundTotal).toBe(10000);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(2);
  });

  it("receiving goods and paying a supplier complete without deadlocking", { timeout: 15000 }, async () => {
    vi.stubEnv("DB_POOL_MAX", "1");
    vi.resetModules();
    const { db } = await import("@/lib/db/client");
    const { admins, products, purchaseOrderItems, purchaseOrders, suppliers } = await import("@/lib/db/schema");
    const po = await import("@/lib/purchase-orders");
    const { eq } = await import("drizzle-orm");

    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [boss] = await db.insert(admins).values({ email: `pool-po-${tag}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [sup] = await db.insert(suppliers).values({ name: `PoolSup ${tag}`, status: "active" }).returning();
    const [p] = await db.insert(products).values({ sku: `PP-${tag}`, title: "Pool PO", status: "active" }).returning();
    const { poNumber } = await po.createPurchaseOrder({ supplierId: sup.id, createdBy: boss.id, lines: [{ productId: p.id, quantity: 4, unitCost: 1000 }] });
    await po.approvePurchaseOrder({ poNumber, approverId: boss.id, approverRole: "OWNER", hasPermission: true });
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
    const [item] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, row.id));
    await po.receiveGoods({ poNumber, receivedBy: boss.id, lines: [{ poItemId: item.id, accepted: 4, rejected: 0 }] });
    await po.recordSupplierInvoice({ supplierId: sup.id, poNumber, invoiceNumber: "X1", amount: 4000, createdBy: boss.id });
    await po.recordSupplierPayment({ supplierId: sup.id, amount: 4000, method: "CASH", paidBy: boss.id });
    expect((await po.getSupplierBalance(db, sup.id)).balance).toBe(0);
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(prod.stock).toBe(4);
  });
  afterAll(() => vi.unstubAllEnvs());
  it("a repair from intake to collection completes without deadlocking", { timeout: 20000 }, async () => {
    vi.stubEnv("DB_POOL_MAX", "1");
    vi.resetModules();
    const { db } = await import("@/lib/db/client");
    const { admins, products } = await import("@/lib/db/schema");
    const { applyStockMovement } = await import("@/lib/inventory");
    const { openSession } = await import("@/lib/cash-sessions");
    const r = await import("@/lib/repair-service");

    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [o] = await db.insert(admins).values({ email: `pool-rp-${tag}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [p] = await db.insert(products).values({ sku: `PRP-${tag}`, title: "Part", status: "active", costPrice: 1000 }).returning();
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 2, employeeId: o.id });
    await openSession(o.id, 0);
    const actor = { id: o.id, role: "OWNER" };
    const { id } = await r.createTicket({ name: "Pool", phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, deviceType: "Phone", issue: "x", createdBy: o.id });
    await r.assignTechnician({ ticketId: id, technicianId: o.id, by: o.id });
    await r.changeStatus({ ticketId: id, to: "DIAGNOSING", actor, canManage: true });
    await r.saveDiagnosis({ ticketId: id, diagnosis: "d", actor, canManage: true });
    await r.submitQuote({ ticketId: id, amount: 5000, externalCost: 0, by: o.id });
    await r.answerQuote({ ticketId: id, approve: true, note: "ok", by: o.id });
    await r.changeStatus({ ticketId: id, to: "IN_REPAIR", actor, canManage: true });
    await r.addPart({ ticketId: id, productId: p.id, quantity: 1, actor, canManage: true });
    await r.changeStatus({ ticketId: id, to: "QUALITY_CHECK", actor, canManage: true });
    await r.changeStatus({ ticketId: id, to: "READY", actor, canManage: true });
    expect((await r.collectDevice({ ticketId: id, actor })).paid).toBe(5000);
  });
});
