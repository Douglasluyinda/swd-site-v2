import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cashMovements, cashSessions, salePayments, saleReturns, sales } from "@/lib/db/schema";
import { canApprove, expectedCash, needsApproval, validateClose, validateMovement, variance } from "@/lib/cash";

// Every function takes an executor so callers already inside a transaction
// pass `tx`. With production's single-connection pool, touching the global
// `db` inside a transaction deadlocks.
type Executor = Pick<typeof db, "select" | "insert" | "update" | "transaction">;

export async function getOpenSession(executor: Executor, employeeId: number) {
  const [s] = await executor
    .select()
    .from(cashSessions)
    .where(and(eq(cashSessions.employeeId, employeeId), eq(cashSessions.status, "OPEN")))
    .limit(1);
  return s ?? null;
}

export async function openSession(employeeId: number, openingFloat: number) {
  if (!Number.isInteger(openingFloat) || openingFloat < 0) throw new Error("Opening float must be a whole number, 0 or more.");
  try {
    const [s] = await db.insert(cashSessions).values({ employeeId, openingFloat }).returning();
    return s;
  } catch {
    throw new Error("You already have an open cash session.");
  }
}

export async function sessionTotals(executor: Executor, sessionId: number, openingFloat: number) {
  const [{ v: cashSales }] = await executor
    .select({ v: sql<number>`coalesce(sum(${salePayments.amount}),0)::float` })
    .from(salePayments)
    .innerJoin(sales, eq(sales.id, salePayments.saleId))
    .where(and(eq(sales.cashSessionId, sessionId), eq(salePayments.method, "CASH"), eq(salePayments.status, "RECEIVED")));
  const [{ v: cashRefunds }] = await executor
    .select({ v: sql<number>`coalesce(sum(${saleReturns.refundTotal}),0)::float` })
    .from(saleReturns)
    .where(eq(saleReturns.cashSessionId, sessionId));
  const moves = await executor
    .select({ type: cashMovements.type, v: sql<number>`coalesce(sum(${cashMovements.amount}),0)::float` })
    .from(cashMovements)
    .where(eq(cashMovements.sessionId, sessionId))
    .groupBy(cashMovements.type);
  const sum = (t: string) => moves.find((m) => m.type === t)?.v ?? 0;
  const parts = {
    openingFloat,
    cashSales,
    cashRefunds,
    expenses: sum("EXPENSE"),
    withdrawals: sum("WITHDRAWAL"),
    deposits: sum("DEPOSIT"),
    corrections: sum("CORRECTION"),
  };
  return { ...parts, expected: expectedCash(parts) };
}

export async function addMovement(input: {
  sessionId: number; employeeId: number; type: string; amount: number; reason: string;
}) {
  const err = validateMovement(input);
  if (err) throw new Error(err);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(cashSessions).where(eq(cashSessions.id, input.sessionId)).for("update");
    if (!s || s.status !== "OPEN") throw new Error("That cash session is not open.");
    if (s.employeeId !== input.employeeId) throw new Error("You can only record cash movements on your own session.");
    await tx.insert(cashMovements).values({
      sessionId: s.id, type: input.type, amount: input.amount, reason: input.reason.trim(), employeeId: input.employeeId,
    });
  });
}

export async function closeSession(input: { sessionId: number; employeeId: number; counted: number; note?: string | null }) {
  return db.transaction(async (tx) => {
    // Locking the session row also serialises against in-flight sales on it.
    const [s] = await tx.select().from(cashSessions).where(eq(cashSessions.id, input.sessionId)).for("update");
    if (!s || s.status !== "OPEN") throw new Error("That cash session is not open.");
    if (s.employeeId !== input.employeeId) throw new Error("You can only close your own session.");

    const t = await sessionTotals(tx as unknown as typeof db, s.id, s.openingFloat);
    const v = variance(input.counted, t.expected);
    const err = validateClose({ counted: input.counted, varianceAmount: v, note: input.note });
    if (err) throw new Error(err);

    const pending = needsApproval(v);
    await tx
      .update(cashSessions)
      .set({
        status: pending ? "PENDING_APPROVAL" : "CLOSED",
        closedAt: new Date(),
        countedCash: input.counted,
        expectedCash: t.expected,
        variance: v,
        varianceNote: input.note?.trim() || null,
      })
      .where(eq(cashSessions.id, s.id));
    return { variance: v, expected: t.expected, pendingApproval: pending };
  });
}

export async function approveSession(input: { sessionId: number; approverId: number; approverCanReconcile: boolean }) {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(cashSessions).where(eq(cashSessions.id, input.sessionId)).for("update");
    if (!s || s.status !== "PENDING_APPROVAL") throw new Error("That session is not awaiting approval.");
    const err = canApprove({ approverId: input.approverId, closerId: s.employeeId, approverCanReconcile: input.approverCanReconcile });
    if (err) throw new Error(err);
    await tx
      .update(cashSessions)
      .set({ status: "CLOSED", approvedBy: input.approverId, approvedAt: new Date() })
      .where(eq(cashSessions.id, s.id));
  });
}

// A closed session's numbers are never edited; a fix is a signed CORRECTION
// movement with a reason, visible in the audit trail.
export async function addCorrection(input: { sessionId: number; employeeId: number; amount: number; reason: string }) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new Error("Correction must be a non-zero whole number.");
  if (!input.reason.trim()) throw new Error("A reason is required.");
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(cashSessions).where(eq(cashSessions.id, input.sessionId)).for("update");
    if (!s || s.status === "OPEN") throw new Error("Corrections apply to closed sessions only.");
    await tx.insert(cashMovements).values({
      sessionId: s.id, type: "CORRECTION", amount: input.amount, reason: input.reason.trim(), employeeId: input.employeeId,
    });
  });
}
