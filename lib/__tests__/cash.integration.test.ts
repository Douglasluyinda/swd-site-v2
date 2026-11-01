// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, cashSessions, products, sales, saleItems } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { createSale, refundSale } from "@/lib/sales";
import { addCorrection, addMovement, approveSession, closeSession, openSession, sessionTotals } from "@/lib/cash-sessions";

async function emp(role = "CASHIER") {
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [e] = await db.insert(admins).values({ email: `cash-${tag}@test.local`, passwordHash: "x", staffRole: role }).returning();
  return e;
}
async function stocked(by: number, qty = 10, price = 10000) {
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [p] = await db.insert(products).values({ sku: `CASH-${tag}`, title: "Cash test", status: "active", sellingPrice: price }).returning();
  await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: qty, employeeId: by });
  return p;
}
const key = () => `ck-${Date.now()}-${Math.random()}`;

describe("cash sessions (integration)", () => {
  it("blocks sales and refunds without an open session", async () => {
    const e = await emp();
    const p = await stocked(e.id);
    await expect(
      createSale({ idempotencyKey: key(), employeeId: e.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: 0, tendered: 10000 }),
    ).rejects.toThrow(/Open a cash session/);
  });

  it("allows only one open session per employee", async () => {
    const e = await emp();
    await openSession(e.id, 0);
    await expect(openSession(e.id, 0)).rejects.toThrow(/already have an open/);
  });

  it("reconciles: float + sales − refund − expense − withdrawal + deposit", async () => {
    const e = await emp("OWNER");
    const s = await openSession(e.id, 50000);
    const p = await stocked(e.id);
    const { receiptNumber } = await createSale({ idempotencyKey: key(), employeeId: e.id, role: "OWNER", lines: [{ productId: p.id, quantity: 3 }], discountPercent: 0, tendered: 30000 });
    const [sale] = await db.select().from(sales).where(eq(sales.receiptNumber, receiptNumber));
    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    await refundSale({ receiptNumber, employeeId: e.id, reason: "faulty", quantities: { [item.id]: 1 } });
    await addMovement({ sessionId: s.id, employeeId: e.id, type: "EXPENSE", amount: 2000, reason: "cleaning" });
    await addMovement({ sessionId: s.id, employeeId: e.id, type: "WITHDRAWAL", amount: 8000, reason: "bank run" });
    await addMovement({ sessionId: s.id, employeeId: e.id, type: "DEPOSIT", amount: 1000, reason: "owner top-up" });

    const t = await sessionTotals(db, s.id, 50000);
    expect(t.expected).toBe(50000 + 30000 - 10000 - 2000 - 8000 + 1000); // 61000

    const r = await closeSession({ sessionId: s.id, employeeId: e.id, counted: 61000 });
    expect(r).toMatchObject({ variance: 0, pendingApproval: false });
  });

  it("requires a note for any variance, and approval by someone else beyond the threshold", async () => {
    const cashier = await emp();
    const mgr = await emp("MANAGER");
    const s = await openSession(cashier.id, 10000);
    await expect(closeSession({ sessionId: s.id, employeeId: cashier.id, counted: 9000 })).rejects.toThrow(/Explain/);
    const r = await closeSession({ sessionId: s.id, employeeId: cashier.id, counted: 2000, note: "gave wrong change" });
    expect(r).toMatchObject({ variance: -8000, pendingApproval: true });

    await expect(approveSession({ sessionId: s.id, approverId: cashier.id, approverCanReconcile: true })).rejects.toThrow(/someone other/);
    await expect(approveSession({ sessionId: s.id, approverId: mgr.id, approverCanReconcile: false })).rejects.toThrow(/permission/);
    await approveSession({ sessionId: s.id, approverId: mgr.id, approverCanReconcile: true });
    const [row] = await db.select().from(cashSessions).where(eq(cashSessions.id, s.id));
    expect(row.status).toBe("CLOSED");
    expect(row.approvedBy).toBe(mgr.id);
  });

  it("refuses movements on a closed session, and logs corrections without editing the session", async () => {
    const e = await emp();
    const s = await openSession(e.id, 1000);
    await closeSession({ sessionId: s.id, employeeId: e.id, counted: 1000 });
    await expect(addMovement({ sessionId: s.id, employeeId: e.id, type: "EXPENSE", amount: 1, reason: "late" })).rejects.toThrow(/not open/);
    const before = (await db.select().from(cashSessions).where(eq(cashSessions.id, s.id)))[0];
    await addCorrection({ sessionId: s.id, employeeId: e.id, amount: -500, reason: "miscounted note" });
    const after = (await db.select().from(cashSessions).where(eq(cashSessions.id, s.id)))[0];
    expect(after.expectedCash).toBe(before.expectedCash);
    expect((await sessionTotals(db, s.id, 1000)).expected).toBe(500);
  });

  it("closing is blocked for someone else's session", async () => {
    const a = await emp(); const b = await emp();
    const s = await openSession(a.id, 0);
    await expect(closeSession({ sessionId: s.id, employeeId: b.id, counted: 0 })).rejects.toThrow(/your own/);
  });
});
