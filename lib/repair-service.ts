import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, cashSessions, products, repairCounters, repairEvents, repairParts, repairPayments, repairTickets } from "@/lib/db/schema";
import { findOrCreateByPhone } from "@/lib/customer-service";
import { getOpenSession } from "@/lib/cash-sessions";
import { applyStockMovement } from "@/lib/inventory";
import {
  amountDue, ticketNumber, validateApproval, validateCollect, validateIntake, validatePart,
  validateQuote, validateTransition, type RepairStatus,
} from "@/lib/repairs";
import { hasPermission } from "@/lib/rbac";

// Inside transactions use `tx`, never the global `db` (single-connection pool).
type Tx = typeof db;
export type Actor = { id: number; role: string };

async function lockTicket(tx: Tx, id: number) {
  const [t] = await tx.select().from(repairTickets).where(eq(repairTickets.id, id)).for("update");
  if (!t) throw new Error("Repair ticket not found.");
  return t;
}

async function logEvent(tx: Tx, ticketId: number, from: string | null, to: string, employeeId: number, note?: string | null) {
  await tx.insert(repairEvents).values({ ticketId, fromStatus: from, toStatus: to, note: note?.trim() || null, employeeId });
}

export async function createTicket(input: {
  name: string; phone: string; deviceType: string; brand?: string | null; model?: string | null;
  imei?: string | null; issue: string; intakeNotes?: string | null; createdBy: number;
}) {
  const err = validateIntake(input);
  if (err) throw new Error(err);
  return db.transaction(async (tx) => {
    const customer = await findOrCreateByPhone(tx as unknown as typeof db, { name: input.name, phone: input.phone });
    const year = new Date().getFullYear();
    const [c] = await tx
      .insert(repairCounters).values({ year, seq: 1 })
      .onConflictDoUpdate({ target: repairCounters.year, set: { seq: sql`${repairCounters.seq} + 1` } })
      .returning({ seq: repairCounters.seq });
    const number = ticketNumber(year, c.seq);
    const [t] = await tx.insert(repairTickets).values({
      ticketNumber: number, customerId: customer.id, deviceType: input.deviceType.trim(),
      brand: input.brand?.trim() || null, model: input.model?.trim() || null, imei: input.imei?.trim() || null,
      issue: input.issue.trim(), intakeNotes: input.intakeNotes?.trim() || null, createdBy: input.createdBy,
    }).returning({ id: repairTickets.id });
    await logEvent(tx as unknown as Tx, t.id, null, "RECEIVED", input.createdBy, "Device received");
    return { id: t.id, ticketNumber: number, customerId: customer.id };
  });
}

export async function assignTechnician(input: { ticketId: number; technicianId: number; by: number }) {
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    if (["COLLECTED", "CANCELLED"].includes(t.status)) throw new Error("This ticket is closed.");
    const [tech] = await tx.select().from(admins).where(eq(admins.id, input.technicianId)).limit(1);
    if (!tech || !tech.active) throw new Error("That employee is not active.");
    if (!hasPermission(tech.staffRole, "repairs.update")) throw new Error("That employee cannot work on repairs.");
    await tx.update(repairTickets).set({ technicianId: tech.id, updatedAt: new Date() }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, t.status, input.by, `Assigned to ${tech.name ?? tech.email}`);
  });
}

export async function saveDiagnosis(input: { ticketId: number; diagnosis: string; actor: Actor; canManage: boolean }) {
  const text = input.diagnosis.trim();
  if (!text) throw new Error("Write the diagnosis/work done.");
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    if (["COLLECTED", "CANCELLED"].includes(t.status)) throw new Error("This ticket is closed.");
    if (!input.canManage && t.technicianId !== input.actor.id) throw new Error("You can only update tickets assigned to you.");
    await tx.update(repairTickets).set({ diagnosis: text, updatedAt: new Date() }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, t.status, input.actor.id, "Diagnosis updated");
  });
}

export async function changeStatus(input: { ticketId: number; to: RepairStatus; note?: string | null; actor: Actor; canManage: boolean }) {
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    const err = validateTransition({
      from: t.status as RepairStatus, to: input.to, technicianId: t.technicianId, actorId: input.actor.id,
      actorRole: input.actor.role, canManage: input.canManage, note: input.note, diagnosis: t.diagnosis,
    });
    if (err) throw new Error(err);
    await tx.update(repairTickets).set({
      status: input.to, updatedAt: new Date(),
      ...(input.to === "READY" ? { qcBy: input.actor.id, qcAt: new Date() } : {}),
    }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, input.to, input.actor.id, input.note);
  });
}

export async function submitQuote(input: {
  ticketId: number; amount: number; externalCost: number; externalTechnician?: string | null; by: number;
}) {
  const err = validateQuote(input);
  if (err) throw new Error(err);
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    if (t.status !== "DIAGNOSING") throw new Error("A quote can only be given while the ticket is Diagnosing.");
    if (!t.diagnosis?.trim()) throw new Error("Record the diagnosis before quoting.");
    await tx.update(repairTickets).set({
      status: "QUOTED", quoteAmount: input.amount, quotedAt: new Date(),
      externalCost: input.externalCost, externalTechnician: input.externalTechnician?.trim() || null, updatedAt: new Date(),
    }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, "QUOTED", input.by, `Quote ${input.amount.toLocaleString()} UGX`);
  });
}

export async function answerQuote(input: { ticketId: number; approve: boolean; note: string; by: number }) {
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    const err = validateApproval({ status: t.status as RepairStatus, quoteAmount: t.quoteAmount, note: input.note });
    if (err) throw new Error(err);
    const to = input.approve ? "APPROVED" : "DECLINED";
    await tx.update(repairTickets).set({
      status: to, updatedAt: new Date(),
      ...(input.approve ? { approvedBy: input.by, approvedAt: new Date(), approvalNote: input.note.trim() } : {}),
    }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, to, input.by, input.note);
  });
}

export async function addPart(input: { ticketId: number; productId: number; quantity: number; actor: Actor; canManage: boolean }) {
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    const err = validatePart({ status: t.status as RepairStatus, quantity: input.quantity });
    if (err) throw new Error(err);
    if (!input.canManage && t.technicianId !== input.actor.id) throw new Error("You can only update tickets assigned to you.");
    const [p] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!p) throw new Error("Product not found.");
    const unitCost = p.costPrice ?? p.supplierCost ?? null;
    await applyStockMovement({
      productId: p.id, type: "REPAIR_USE", quantity: input.quantity, unitCost,
      reference: t.ticketNumber, employeeId: input.actor.id,
    }, tx as unknown as Parameters<typeof applyStockMovement>[1]);
    await tx.insert(repairParts).values({ ticketId: t.id, productId: p.id, quantity: input.quantity, unitCost, employeeId: input.actor.id });
    await logEvent(tx as unknown as Tx, t.id, t.status, t.status, input.actor.id, `Fitted ${input.quantity} × ${p.title}`);
  });
}

// Hands the device back. Payment (cash, in full) is taken here, on the
// collector's own open cash session, in the same transaction as the status
// change — a double click cannot take the money twice (ticket row is locked
// and COLLECTED is final).
export async function collectDevice(input: { ticketId: number; actor: Actor }) {
  return db.transaction(async (tx) => {
    const t = await lockTicket(tx as unknown as Tx, input.ticketId);
    const due = amountDue(t.status as RepairStatus, t.quoteAmount, 0);
    let session = await getOpenSession(tx as unknown as typeof db, input.actor.id);
    if (session) {
      // Lock it so a concurrent close can't miss this payment (same as POS sales).
      [session] = await tx.select().from(cashSessions).where(eq(cashSessions.id, session.id)).for("update");
      if (session.status !== "OPEN") session = null as never;
    }
    const err = validateCollect({ status: t.status as RepairStatus, due, hasOpenSession: !!session });
    if (err) throw new Error(err);
    if (due > 0) {
      await tx.insert(repairPayments).values({ ticketId: t.id, amount: due, method: "CASH", cashSessionId: session!.id, employeeId: input.actor.id });
    }
    await tx.update(repairTickets).set({ status: "COLLECTED", collectedAt: new Date(), updatedAt: new Date() }).where(eq(repairTickets.id, t.id));
    await logEvent(tx as unknown as Tx, t.id, t.status, "COLLECTED", input.actor.id, due > 0 ? `Paid ${due.toLocaleString()} UGX cash` : "Returned, nothing owed");
    return { paid: due };
  });
}
