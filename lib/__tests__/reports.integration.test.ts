// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
// Other tests share the database, so every figure is checked as a before/after delta.
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, products, saleItems, sales } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { addMovement, openSession } from "@/lib/cash-sessions";
import { createSale, refundSale } from "@/lib/sales";
import { addPart, answerQuote, assignTechnician, changeStatus, collectDevice, createTicket, saveDiagnosis, submitQuote } from "@/lib/repair-service";
import { loadReport, loadStockValuation } from "@/lib/report-queries";
import { presetPeriod } from "@/lib/reports";

describe("reports (integration)", () => {
  it("numbers reconcile with a known set of transactions", { timeout: 20000 }, async () => {
    const period = presetPeriod("this-month", new Date());
    const before = await loadReport(period);
    const stockBefore = await loadStockValuation();

    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [o] = await db.insert(admins).values({ email: `rep-${tag}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [p] = await db.insert(products).values({ sku: `REP-${tag}`, title: "Report item", status: "active", sellingPrice: 10000, costPrice: 6000 }).returning();
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 10, employeeId: o.id });
    const session = await openSession(o.id, 0);

    // sale of 3 (30,000, cost 18,000), then a refund of 1 (10,000, cost 6,000 back)
    const { receiptNumber } = await createSale({ idempotencyKey: `rep-${tag}`, employeeId: o.id, role: "OWNER", lines: [{ productId: p.id, quantity: 3 }], discountPercent: 0, tendered: 30000 });
    const [sale] = await db.select().from(sales).where(eq(sales.receiptNumber, receiptNumber));
    const [item] = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    await refundSale({ receiptNumber, employeeId: o.id, reason: "test", quantities: { [item.id]: 1 } });
    await addMovement({ sessionId: session.id, employeeId: o.id, type: "EXPENSE", amount: 2000, reason: "tea" });

    // repair: quote 50,000, part cost 6,000, external 4,000
    const actor = { id: o.id, role: "OWNER" };
    const { id } = await createTicket({ name: "Rep", phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, deviceType: "Phone", issue: "x", createdBy: o.id });
    await assignTechnician({ ticketId: id, technicianId: o.id, by: o.id });
    await changeStatus({ ticketId: id, to: "DIAGNOSING", actor, canManage: true });
    await saveDiagnosis({ ticketId: id, diagnosis: "d", actor, canManage: true });
    await submitQuote({ ticketId: id, amount: 50000, externalCost: 4000, externalTechnician: "Ben", by: o.id });
    await answerQuote({ ticketId: id, approve: true, note: "ok", by: o.id });
    await changeStatus({ ticketId: id, to: "IN_REPAIR", actor, canManage: true });
    await addPart({ ticketId: id, productId: p.id, quantity: 1, actor, canManage: true });
    await changeStatus({ ticketId: id, to: "QUALITY_CHECK", actor, canManage: true });
    await changeStatus({ ticketId: id, to: "READY", actor, canManage: true });
    await collectDevice({ ticketId: id, actor });

    const after = await loadReport(period);
    const d = (k: keyof typeof after.totals) => (after.totals[k] as number) - (before.totals[k] as number);
    expect(d("sales")).toBe(30000);
    expect(d("refunds")).toBe(10000);
    expect(d("repairRevenue")).toBe(50000);
    expect(d("revenue")).toBe(30000 - 10000 + 50000);
    expect(d("cogs")).toBe(18000 - 6000);
    expect(d("repairCost")).toBe(6000 + 4000);
    expect(d("grossProfit")).toBe(70000 - 12000 - 10000);
    expect(d("expenses")).toBe(2000);
    expect(d("operatingProfit")).toBe(48000 - 2000);
    expect(after.linesWithoutCost - before.linesWithoutCost).toBe(0);

    // 10 received − 3 sold + 1 returned − 1 used in repair = 7 units × 6,000
    const stockAfter = await loadStockValuation();
    expect(stockAfter.value - stockBefore.value).toBe(7 * 6000);
  });
});
