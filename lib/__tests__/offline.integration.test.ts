// Needs a real Postgres via DATABASE_URL (non-production — inserts rows, changes the offline setting, restores it).
import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { admins, appSettings, cashSessions, offlineSyncFailures, products, sales } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { openSession } from "@/lib/cash-sessions";
import { registerTerminal, syncOfflineSale } from "@/lib/offline-service";
import { setSetting } from "@/lib/settings-service";
import type { OfflineSale } from "@/lib/offline";

afterAll(async () => { await db.delete(appSettings).where(eq(appSettings.key, "offline.enabled")); });

async function world(stock = 10) {
  const t = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [owner] = await db.insert(admins).values({ email: `off-o-${t}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
  const [cashier] = await db.insert(admins).values({ email: `off-c-${t}@test.local`, passwordHash: "x", staffRole: "CASHIER" }).returning();
  const [p] = await db.insert(products).values({ sku: `OFF-${t}`, title: "Offline item", status: "active", sellingPrice: 10000, costPrice: 6000 }).returning();
  await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: stock, employeeId: owner.id });
  await setSetting({ key: "offline.enabled", value: "1", by: owner.id });
  const { terminalId } = await registerTerminal({ name: "Till 1", by: owner.id });
  const session = await openSession(cashier.id, 0);
  const mk = (over: Partial<OfflineSale> = {}): OfflineSale => ({
    clientId: randomUUID(), terminalId, employeeId: cashier.id, occurredAt: new Date(Date.now() - 60_000).toISOString(),
    lines: [{ productId: p.id, quantity: 2 }], discountPercent: 0, expectedTotal: 20000, tendered: 20000, ...over,
  });
  const run = (sale: OfflineSale, employeeId = cashier.id, role = "CASHIER") => syncOfflineSale({ sale, employeeId, role });
  return { owner, cashier, p, terminalId, session, mk, run };
}

describe("offline sync (integration)", () => {
  it("records the sale at the time it happened, marked offline, and a repeat does not duplicate", { timeout: 20000 }, async () => {
    const w = await world();
    const sale = w.mk();
    const r = await w.run(sale);
    expect(r.ok && !r.duplicate).toBe(true);
    const again = await w.run(sale);
    expect(again.ok && again.duplicate).toBe(true);
    if (!r.ok || !again.ok) throw new Error("unreachable");
    expect(again.receiptNumber).toBe(r.receiptNumber);
    const rows = await db.select().from(sales).where(eq(sales.idempotencyKey, sale.clientId));
    expect(rows).toHaveLength(1);
    expect(rows[0].offlineTerminalId).toBe(w.terminalId);
    expect(rows[0].syncedAt).not.toBeNull();
    expect(Math.abs(rows[0].createdAt.getTime() - new Date(sale.occurredAt).getTime())).toBeLessThan(1000);
    expect(rows[0].cashSessionId).toBe(w.session.id);
    expect((await db.select().from(products).where(eq(products.id, w.p.id)))[0].stock).toBe(8);
  });

  it("conflicts are refused, kept for a manager, and fixable: price change, no stock, wrong terminal, other employee", { timeout: 20000 }, async () => {
    const w = await world(1);
    // price changed since the customer paid
    const stale = w.mk({ expectedTotal: 18000, tendered: 18000 });
    let r = await w.run(stale);
    expect(!r.ok && r.error).toMatch(/Price changed/);
    expect(await db.select().from(sales).where(eq(sales.idempotencyKey, stale.clientId))).toHaveLength(0);
    // not enough stock (1 on hand, 2 sold offline) — nothing recorded, stock unchanged
    const tooMany = w.mk();
    r = await w.run(tooMany);
    expect(!r.ok && r.error).toMatch(/below zero/);
    expect((await db.select().from(products).where(eq(products.id, w.p.id)))[0].stock).toBe(1);
    const open = await db.select().from(offlineSyncFailures).where(and(eq(offlineSyncFailures.clientId, tooMany.clientId)));
    expect(open).toHaveLength(1);
    expect(JSON.parse(open[0].payload).clientId).toBe(tooMany.clientId);
    // manager receives stock, device retries the SAME sale -> succeeds and the failure is resolved
    await applyStockMovement({ productId: w.p.id, type: "PURCHASE_RECEIPT", quantity: 5, employeeId: w.owner.id });
    r = await w.run(tooMany);
    expect(r.ok).toBe(true);
    const after = await db.select().from(offlineSyncFailures).where(eq(offlineSyncFailures.clientId, tooMany.clientId));
    expect(after).toHaveLength(1);
    expect(after[0].resolvedAt).not.toBeNull();
    // a device that is not the registered terminal
    r = await w.run(w.mk({ terminalId: "some-other-device" }));
    expect(!r.ok && r.error).toMatch(/not the registered/);
    // another employee's queue
    r = await w.run(w.mk(), w.owner.id, "OWNER");
    expect(!r.ok && r.error).toMatch(/another employee/);
  });

  it("session rules: no open session is retryable-free conflict; a session opened after the sale is a conflict", { timeout: 20000 }, async () => {
    const w = await world();
    const early = w.mk({ occurredAt: new Date(Date.now() - 3_600_000).toISOString() });
    await db.update(cashSessions).set({ openedAt: new Date(Date.now() - 600_000) }).where(eq(cashSessions.id, w.session.id));
    let r = await w.run(early);
    expect(!r.ok && r.error).toMatch(/opened after this sale/);
    await db.update(cashSessions).set({ status: "CLOSED", closedAt: new Date() }).where(eq(cashSessions.id, w.session.id));
    r = await w.run(w.mk());
    expect(!r.ok && r.error).toMatch(/Open a cash session/);
  });

  it("stays off until the owner turns it on, and old/future/invalid sales are refused", { timeout: 20000 }, async () => {
    const w = await world();
    expect((await w.run(w.mk({ occurredAt: new Date(Date.now() + 3_600_000).toISOString() }))).ok).toBe(false);
    expect((await w.run(w.mk({ occurredAt: new Date(Date.now() - 9 * 86_400_000).toISOString() }))).ok).toBe(false);
    await setSetting({ key: "offline.enabled", value: "0", by: w.owner.id });
    const off = await w.run(w.mk());
    expect(!off.ok && off.error).toMatch(/switched off/);
    expect(!off.ok && off.retryable).toBe(true); // nothing wrong with the sale; keep it queued
  });

  it("only one terminal can be active", async () => {
    const w = await world();
    const second = await registerTerminal({ name: "Till 2", by: w.owner.id });
    const r = await w.run(w.mk()); // first terminal id is now deactivated
    expect(!r.ok && r.error).toMatch(/not the registered/);
    expect(second.terminalId).not.toBe(w.terminalId);
  });
});
