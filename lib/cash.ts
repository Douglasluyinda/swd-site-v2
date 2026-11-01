// Pure cash-session rules (no DB). UGX whole numbers.
//
// expected = opening float + cash sales − cash refunds − expenses
//            − withdrawals + deposits   (per the Business OS spec)
//
// SAFE DEFAULT pending owner decision: a closing variance beyond
// CASH_VARIANCE_THRESHOLD (UGX) needs approval by another manager/owner.

export const CASH_VARIANCE_THRESHOLD = 5000;

export type CashMovementType = "EXPENSE" | "DEPOSIT" | "WITHDRAWAL" | "CORRECTION";
export const MANUAL_CASH_MOVEMENTS: CashMovementType[] = ["EXPENSE", "DEPOSIT", "WITHDRAWAL"];

export function expectedCash(input: {
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  expenses: number;
  withdrawals: number;
  deposits: number;
  repairPayments?: number;
  corrections?: number; // signed
}): number {
  return (
    input.openingFloat + input.cashSales - input.cashRefunds - input.expenses -
    input.withdrawals + input.deposits + (input.repairPayments ?? 0) + (input.corrections ?? 0)
  );
}

export function variance(counted: number, expected: number): number {
  return counted - expected;
}

export function needsApproval(varianceAmount: number, threshold = CASH_VARIANCE_THRESHOLD): boolean {
  return Math.abs(varianceAmount) > threshold;
}

export function validateClose(input: { counted: number; varianceAmount: number; note?: string | null }): string | null {
  if (!Number.isInteger(input.counted) || input.counted < 0) return "Counted cash must be a whole number, 0 or more.";
  if (input.varianceAmount !== 0 && !input.note?.trim()) return "Explain the variance before closing.";
  return null;
}

export function validateMovement(input: { type: string; amount: number; reason?: string | null }): string | null {
  if (!(MANUAL_CASH_MOVEMENTS as string[]).includes(input.type)) return "Invalid cash movement type.";
  if (!Number.isInteger(input.amount) || input.amount <= 0) return "Amount must be a positive whole number.";
  if (!input.reason?.trim()) return "A reason is required.";
  return null;
}

export function canApprove(input: { approverId: number; closerId: number; approverCanReconcile: boolean }): string | null {
  if (!input.approverCanReconcile) return "You do not have permission to approve cash sessions.";
  if (input.approverId === input.closerId) return "A session must be approved by someone other than the person who closed it.";
  return null;
}
