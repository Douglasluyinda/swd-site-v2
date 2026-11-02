// Needs a real Postgres via DATABASE_URL (non-production — mutates app_settings, restored at the end).
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, appSettings, cashSessions, products } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { closeSession, openSession } from "@/lib/cash-sessions";
import { createSale } from "@/lib/sales";
import { getSettings, setSetting } from "@/lib/settings-service";
import { loadAlertCounts } from "@/lib/alert-queries";

const KEYS = ["discount.manager_percent", "discount.cashier_percent", "cash.variance_threshold"];
const snapshot = (await db.select().from(appSettings)).filter((r) => KEYS.includes(r.key));

afterAll(async () => {
  for (const k of KEYS) await db.delete(appSettings).where(eq(appSettings.key, k));
  for (const r of snapshot) await db.insert(appSettings).values(r);
});

describe("settings (integration)", () => {
  it("defaults apply until changed; rejects bad values and cashier > manager", async () => {
    const before = await getSettings();
    await expect(setSetting({ key: "discount.manager_percent", value: "150", by: 1 })).rejects.toThrow(/between/);
    await setSetting({ key: "discount.manager_percent", value: "10", by: (await owner()).id });
    await expect(setSetting({ key: "discount.cashier_percent", value: "11", by: (await owner()).id })).rejects.toThrow(/cannot be higher/);
    expect((await getSettings())["discount.cashier_percent"]).toBe(before["discount.cashier_percent"]);
  });

  it("a changed discount limit is enforced on the next sale, and the variance threshold on close", { timeout: 20000 }, async () => {
    const o = await owner();
    const t = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [cashier] = await db.insert(admins).values({ email: `set-c-${t}@test.local`, passwordHash: "x", staffRole: "CASHIER" }).returning();
    const [p] = await db.insert(products).values({ sku: `SET-${t}`, title: "Set item", status: "active", sellingPrice: 10000, costPrice: 5000 }).returning();
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 10, employeeId: o.id });
    const s = await openSession(cashier.id, 0);
    const sale = (key: string, pct: number) => createSale({ idempotencyKey: `${key}-${t}`, employeeId: cashier.id, role: "CASHIER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: pct, tendered: 10000 });

    await setSetting({ key: "discount.cashier_percent", value: "0", by: o.id });
    await expect(sale("a", 5)).rejects.toThrow(/at most 0%/);
    await setSetting({ key: "discount.manager_percent", value: "20", by: o.id });
    await setSetting({ key: "discount.cashier_percent", value: "5", by: o.id });
    await expect(sale("b", 5)).resolves.toBeTruthy();
    await expect(sale("c", 6)).rejects.toThrow(/at most 5%/);

    // expected = 9,500 (one 5%-off sale); counting 8,000 is 1,500 short. The default 5,000
    // threshold would let that close; a 1,000 threshold must send it for approval.
    await setSetting({ key: "cash.variance_threshold", value: "1000", by: o.id });
    const r = await closeSession({ sessionId: s.id, employeeId: cashier.id, counted: 8000, note: "short" });
    expect(r.variance).toBe(-1500);
    expect(r.pendingApproval).toBe(true);
    const [row] = await db.select().from(cashSessions).where(eq(cashSessions.id, s.id));
    expect(row.status).toBe("PENDING_APPROVAL");
  });

  it("alert counts see a session awaiting approval", { timeout: 20000 }, async () => {
    const o = await owner();
    const before = await loadAlertCounts();
    const [c] = await db.insert(admins).values({ email: `set-a-${Date.now()}@test.local`, passwordHash: "x", staffRole: "CASHIER" }).returning();
    const s = await openSession(c.id, 100000);
    await setSetting({ key: "cash.variance_threshold", value: "100", by: o.id });
    const r = await closeSession({ sessionId: s.id, employeeId: c.id, counted: 90000, note: "missing" });
    expect(r.pendingApproval).toBe(true);
    expect((await loadAlertCounts()).cashPendingApproval).toBe(before.cashPendingApproval + 1);
  });
});

async function owner() {
  const [o] = await db.insert(admins).values({ email: `set-o-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
  return o;
}
