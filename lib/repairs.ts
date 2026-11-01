// Pure repair-ticket rules (no DB). Money is whole UGX.
//
// Flow: RECEIVED → DIAGNOSING → QUOTED → APPROVED → IN_REPAIR → QUALITY_CHECK
//       → READY → COLLECTED.  A declined quote goes QUOTED → DECLINED →
//       COLLECTED (device handed back, nothing owed). CANCELLED is allowed
//       before the device is collected.
//
// SAFE DEFAULTS pending owner decisions: no deposits (paid in full on
// collection); quality check by someone other than the assigned technician
// (OWNER exempt, so a one-person shop can still finish jobs).

export const REPAIR_STATUSES = [
  "RECEIVED", "DIAGNOSING", "QUOTED", "APPROVED", "DECLINED",
  "IN_REPAIR", "QUALITY_CHECK", "READY", "COLLECTED", "CANCELLED",
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

const NEXT: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["QUOTED", "CANCELLED"],
  QUOTED: ["APPROVED", "DECLINED", "CANCELLED"],
  APPROVED: ["IN_REPAIR", "CANCELLED"],
  DECLINED: ["COLLECTED"],
  IN_REPAIR: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["READY", "IN_REPAIR"], // failed check goes back to the bench
  READY: ["COLLECTED"],
  COLLECTED: [],
  CANCELLED: [],
};

export function canTransition(from: RepairStatus, to: RepairStatus): boolean {
  return NEXT[from]?.includes(to) ?? false;
}

// Statuses reached only through dedicated actions (they carry data/money).
export const DEDICATED_TARGETS: RepairStatus[] = ["QUOTED", "APPROVED", "DECLINED", "COLLECTED"];

// What an assigned TECHNICIAN may move a ticket to by themselves.
export const TECHNICIAN_TARGETS: RepairStatus[] = ["DIAGNOSING", "IN_REPAIR", "QUALITY_CHECK"];

export function validateIntake(i: { deviceType: string; issue: string; imei?: string | null }): string | null {
  if (!i.deviceType?.trim()) return "Say what device it is.";
  if (!i.issue?.trim()) return "Describe the problem.";
  if (i.issue.length > 2000) return "Problem description is too long.";
  if (i.imei && !/^[A-Za-z0-9\- ]{4,40}$/.test(i.imei.trim())) return "IMEI/serial looks wrong.";
  return null;
}

export function validateQuote(i: { amount: number; externalCost: number; externalTechnician?: string | null }): string | null {
  if (!Number.isInteger(i.amount) || i.amount < 0) return "Quote must be a whole number, 0 or more.";
  if (!Number.isInteger(i.externalCost) || i.externalCost < 0) return "External cost must be a whole number, 0 or more.";
  if (i.externalCost > 0 && !i.externalTechnician?.trim()) return "Name the external technician.";
  return null;
}

export function validateTransition(i: {
  from: RepairStatus; to: RepairStatus; technicianId: number | null;
  actorId: number; actorRole: string; canManage: boolean; note?: string | null; diagnosis?: string | null;
}): string | null {
  if (DEDICATED_TARGETS.includes(i.to)) return "That step has its own button.";
  if (!canTransition(i.from, i.to)) return `A ticket cannot go from ${i.from} to ${i.to}.`;
  if (!i.canManage) {
    if (i.technicianId !== i.actorId) return "You can only update tickets assigned to you.";
    if (!TECHNICIAN_TARGETS.includes(i.to)) return "Only a manager can make that change.";
  }
  if (i.to === "DIAGNOSING" && i.technicianId == null) return "Assign a technician first.";
  if (i.to === "QUALITY_CHECK" && !i.diagnosis?.trim()) return "Record the diagnosis/work done first.";
  if (i.from === "QUALITY_CHECK" && i.to === "IN_REPAIR" && !i.note?.trim()) return "Say what failed the check.";
  if (i.to === "READY" && i.actorId === i.technicianId && i.actorRole !== "OWNER") {
    return "Quality check must be done by someone other than the technician.";
  }
  if (i.to === "CANCELLED" && !i.note?.trim()) return "Give a reason for cancelling.";
  return null;
}

export function validateApproval(i: { status: RepairStatus; quoteAmount: number | null; note?: string | null }): string | null {
  if (i.status !== "QUOTED" || i.quoteAmount == null) return "There is no quote waiting for an answer.";
  if (!i.note?.trim()) return "Record how the customer answered (e.g. 'phoned, agreed').";
  return null;
}

export function validatePart(i: { status: RepairStatus; quantity: number }): string | null {
  if (i.status !== "IN_REPAIR") return "Parts can only be fitted while the ticket is In repair.";
  if (!Number.isInteger(i.quantity) || i.quantity <= 0) return "Quantity must be a positive whole number.";
  return null;
}

export function amountDue(status: RepairStatus, quoteAmount: number | null, paid: number): number {
  if (status === "DECLINED") return 0;
  return Math.max(0, (quoteAmount ?? 0) - paid);
}

export function validateCollect(i: { status: RepairStatus; due: number; hasOpenSession: boolean }): string | null {
  if (i.status !== "READY" && i.status !== "DECLINED") return "The device is not ready for collection.";
  if (i.due > 0 && !i.hasOpenSession) return "Open your cash session to take the payment.";
  return null;
}

// Gross margin on a finished repair: what was charged minus parts and any
// external technician. Revenue from labour is not "cost" here.
export function repairMargin(charged: number, partsCost: number, externalCost: number): number {
  return charged - partsCost - externalCost;
}

export function ticketNumber(year: number, seq: number): string {
  return `SWD-RP-${year}-${String(seq).padStart(6, "0")}`;
}
