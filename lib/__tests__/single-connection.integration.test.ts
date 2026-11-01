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
    const { eq } = await import("drizzle-orm");

    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [emp] = await db.insert(admins).values({ email: `one-${tag}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [p] = await db.insert(products).values({ sku: `ONE-${tag}`, title: "Pool test", status: "active", sellingPrice: 10000 }).returning();
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
  afterAll(() => vi.unstubAllEnvs());
});
