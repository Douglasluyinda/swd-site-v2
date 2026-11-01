// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, products, repairEvents, repairPayments, repairTickets } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { openSession, sessionTotals } from "@/lib/cash-sessions";
import {
  addPart, answerQuote, assignTechnician, changeStatus, collectDevice, createTicket, saveDiagnosis, submitQuote,
} from "@/lib/repair-service";

const tag = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
async function world() {
  const t = tag();
  const mk = async (role: string, n: string) => (await db.insert(admins).values({ email: `rp-${n}-${t}@test.local`, passwordHash: "x", staffRole: role }).returning())[0];
  const owner = await mk("OWNER", "o"), mgr = await mk("MANAGER", "m"), tech = await mk("TECHNICIAN", "t"), cashier = await mk("CASHIER", "c");
  const [part] = await db.insert(products).values({ sku: `RP-${t}`, title: "Screen", status: "active", costPrice: 20000 }).returning();
  await applyStockMovement({ productId: part.id, type: "PURCHASE_RECEIPT", quantity: 5, employeeId: owner.id });
  const phone = `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  return { owner, mgr, tech, cashier, part, phone, t };
}
const M = (a: { id: number; staffRole: string | null }) => ({ id: a.id, role: a.staffRole! });

describe("repairs (integration)", () => {
  it("full lifecycle: rules enforced, stock used, payment hits the drawer once", async () => {
    const w = await world();
    const { id } = await createTicket({ name: "Repair Cust", phone: w.phone, deviceType: "Phone", issue: "Cracked screen", createdBy: w.cashier.id });

    // cannot skip ahead
    await expect(changeStatus({ ticketId: id, to: "IN_REPAIR", actor: M(w.mgr), canManage: true })).rejects.toThrow(/cannot go from/);
    await expect(changeStatus({ ticketId: id, to: "DIAGNOSING", actor: M(w.mgr), canManage: true })).rejects.toThrow(/Assign/);
    await assignTechnician({ ticketId: id, technicianId: w.tech.id, by: w.mgr.id });
    await expect(assignTechnician({ ticketId: id, technicianId: w.cashier.id, by: w.mgr.id })).rejects.toThrow(/cannot work on repairs/);
    await changeStatus({ ticketId: id, to: "DIAGNOSING", actor: M(w.tech), canManage: false });
    await expect(submitQuote({ ticketId: id, amount: 90000, externalCost: 0, by: w.mgr.id })).rejects.toThrow(/diagnosis/);
    await saveDiagnosis({ ticketId: id, diagnosis: "Screen needs replacing", actor: M(w.tech), canManage: false });
    await submitQuote({ ticketId: id, amount: 90000, externalCost: 10000, externalTechnician: "Ben (board repair)", by: w.mgr.id });

    // no work before the customer answers
    await expect(changeStatus({ ticketId: id, to: "IN_REPAIR", actor: M(w.tech), canManage: false })).rejects.toThrow(/cannot go from/);
    await expect(answerQuote({ ticketId: id, approve: true, note: "", by: w.mgr.id })).rejects.toThrow(/how the customer/);
    await answerQuote({ ticketId: id, approve: true, note: "Phoned, agreed", by: w.mgr.id });

    await expect(addPart({ ticketId: id, productId: w.part.id, quantity: 1, actor: M(w.tech), canManage: false })).rejects.toThrow(/In repair/);
    await changeStatus({ ticketId: id, to: "IN_REPAIR", actor: M(w.tech), canManage: false });
    await addPart({ ticketId: id, productId: w.part.id, quantity: 1, actor: M(w.tech), canManage: false });
    await expect(addPart({ ticketId: id, productId: w.part.id, quantity: 99, actor: M(w.tech), canManage: false })).rejects.toThrow(/below zero/);
    expect((await db.select().from(products).where(eq(products.id, w.part.id)))[0].stock).toBe(4);

    await changeStatus({ ticketId: id, to: "QUALITY_CHECK", actor: M(w.tech), canManage: false });
    await expect(changeStatus({ ticketId: id, to: "READY", actor: M(w.tech), canManage: false })).rejects.toThrow(/Only a manager/);
    await changeStatus({ ticketId: id, to: "READY", actor: M(w.mgr), canManage: true });

    // collection needs the collector's open session when money is due
    await expect(collectDevice({ ticketId: id, actor: M(w.cashier) })).rejects.toThrow(/cash session/);
    const session = await openSession(w.cashier.id, 10000);
    const results = await Promise.allSettled([collectDevice({ ticketId: id, actor: M(w.cashier) }), collectDevice({ ticketId: id, actor: M(w.cashier) })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); // double click cannot take the money twice

    const pays = await db.select().from(repairPayments).where(eq(repairPayments.ticketId, id));
    expect(pays).toHaveLength(1);
    expect(pays[0].amount).toBe(90000);
    const totals = await sessionTotals(db, session.id, 10000);
    expect(totals.repairPayments).toBe(90000);
    expect(totals.expected).toBe(100000);

    const [t] = await db.select().from(repairTickets).where(eq(repairTickets.id, id));
    expect(t.status).toBe("COLLECTED");
    expect(t.externalCost).toBe(10000);
    const events = await db.select().from(repairEvents).where(eq(repairEvents.ticketId, id));
    expect(events.map((e) => e.toStatus)).toContain("COLLECTED");
    await expect(changeStatus({ ticketId: id, to: "CANCELLED", note: "x", actor: M(w.mgr), canManage: true })).rejects.toThrow(/cannot go from/);
  });

  it("a declined quote is handed back with nothing owed, and a technician cannot touch others' tickets", async () => {
    const w = await world();
    const { id } = await createTicket({ name: "Decliner", phone: w.phone, deviceType: "Laptop", issue: "No power", createdBy: w.mgr.id });
    await assignTechnician({ ticketId: id, technicianId: w.tech.id, by: w.mgr.id });
    await changeStatus({ ticketId: id, to: "DIAGNOSING", actor: M(w.mgr), canManage: true });
    await saveDiagnosis({ ticketId: id, diagnosis: "Motherboard", actor: M(w.tech), canManage: false });
    await expect(saveDiagnosis({ ticketId: id, diagnosis: "x", actor: M(w.cashier), canManage: false })).rejects.toThrow(/assigned to you/);
    await submitQuote({ ticketId: id, amount: 500000, externalCost: 0, by: w.mgr.id });
    await answerQuote({ ticketId: id, approve: false, note: "Too expensive", by: w.mgr.id });
    await collectDevice({ ticketId: id, actor: M(w.cashier) }); // no session needed: nothing due
    expect((await db.select().from(repairPayments).where(eq(repairPayments.ticketId, id)))).toHaveLength(0);
  });

  it("the same phone reuses the customer", async () => {
    const w = await world();
    const a = await createTicket({ name: "Same", phone: w.phone, deviceType: "Phone", issue: "a", createdBy: w.mgr.id });
    const b = await createTicket({ name: "Same", phone: w.phone, deviceType: "Tablet", issue: "b", createdBy: w.mgr.id });
    expect(b.customerId).toBe(a.customerId);
    expect(b.ticketNumber).not.toBe(a.ticketNumber);
  });

  it("history and payments cannot be edited or deleted", async () => {
    const w = await world();
    const { id } = await createTicket({ name: "Ledger", phone: w.phone, deviceType: "Phone", issue: "a", createdBy: w.mgr.id });
    await expect(db.update(repairEvents).set({ note: "tampered" }).where(eq(repairEvents.ticketId, id))).rejects.toThrow();
    await expect(db.delete(repairEvents).where(eq(repairEvents.ticketId, id))).rejects.toThrow();
  });
});
