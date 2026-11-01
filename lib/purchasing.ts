// Pure purchasing rules (no DB). UGX whole numbers.
//
// SAFE DEFAULT pending owner decision: a manager can't approve their own
// purchase order (an OWNER can — owner-run shops often have one person), and
// POs above PO_OWNER_APPROVAL_THRESHOLD need an OWNER.

export const PO_OWNER_APPROVAL_THRESHOLD = 1_000_000;

export type PoStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export function poNumber(year: number, seq: number): string {
  return `SWD-PO-${year}-${String(seq).padStart(6, "0")}`;
}

export function poTotal(lines: { quantity: number; unitCost: number }[]): number {
  return lines.reduce((a, l) => a + l.quantity * l.unitCost, 0);
}

export function validatePoLines(lines: { productId: number; quantity: number; unitCost: number }[]): string | null {
  if (lines.length === 0) return "Add at least one product.";
  const ids = lines.map((l) => l.productId);
  if (new Set(ids).size !== ids.length) return "Each product may appear only once.";
  for (const l of lines) {
    if (!Number.isInteger(l.productId) || l.productId <= 0) return "Choose a product for every line.";
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) return "Quantities must be positive whole numbers.";
    if (!Number.isInteger(l.unitCost) || l.unitCost <= 0) return "Unit costs must be positive whole numbers (UGX).";
  }
  return null;
}

export function canApprovePo(input: {
  approverId: number; approverRole: string; creatorId: number; total: number; hasPermission: boolean;
}): string | null {
  if (!input.hasPermission) return "You do not have permission to approve purchase orders.";
  if (input.approverId === input.creatorId && input.approverRole !== "OWNER") {
    return "A purchase order must be approved by someone other than its creator.";
  }
  if (input.total > PO_OWNER_APPROVAL_THRESHOLD && input.approverRole !== "OWNER") {
    return `Orders above ${PO_OWNER_APPROVAL_THRESHOLD.toLocaleString()} UGX need the owner's approval.`;
  }
  return null;
}

export function remainingToReceive(ordered: number, alreadyAccepted: number): number {
  return Math.max(0, ordered - alreadyAccepted);
}

export function validateReceiptLine(input: { remaining: number; accepted: number; rejected: number; note?: string | null }): string | null {
  if (!Number.isInteger(input.accepted) || !Number.isInteger(input.rejected) || input.accepted < 0 || input.rejected < 0) {
    return "Quantities must be whole numbers, 0 or more.";
  }
  if (input.accepted > input.remaining) return "Cannot receive more than was ordered.";
  if (input.rejected > 0 && !input.note?.trim()) return "Say why units were rejected.";
  return null;
}

export function statusAfterReceipt(items: { ordered: number; accepted: number }[]): "PARTIALLY_RECEIVED" | "RECEIVED" {
  return items.every((i) => i.accepted >= i.ordered) ? "RECEIVED" : "PARTIALLY_RECEIVED";
}

export function supplierBalance(invoiced: number, paid: number): number {
  return invoiced - paid;
}

export function validatePayment(input: { amount: number; balance: number }): string | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return "Amount must be a positive whole number.";
  if (input.amount > input.balance) return "That is more than the outstanding balance.";
  return null;
}
