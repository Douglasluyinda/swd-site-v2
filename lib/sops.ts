// Pure SOP rules (no DB).
//
// Approval: SAFE DEFAULT pending owner decision — only an OWNER approves a
// version (managers write drafts). An owner may approve a draft they wrote,
// so a one-person business is not blocked; a manager never approves their own.
// Staff acknowledge a specific version; a new approved version resets that.

export const SOP_ROLES = ["OWNER", "MANAGER", "CASHIER", "TECHNICIAN"] as const;
export const REVIEW_MONTHS_DEFAULT = 12;

export type SopStatus = "DRAFT" | "APPROVED" | "SUPERSEDED";

export function parseRoles(csv: string): string[] {
  return csv.split(",").map((r) => r.trim()).filter(Boolean);
}

export function validateRoles(roles: string[]): string | null {
  if (roles.length === 0) return "Choose at least one role.";
  if (roles.some((r) => !(SOP_ROLES as readonly string[]).includes(r))) return "Unknown role.";
  return null;
}

export function parseSteps(body: string): string[] {
  return body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function validateDraft(i: { body: string; purpose?: string | null; reviewDate?: string | null }): string | null {
  if (parseSteps(i.body).length === 0) return "Write at least one step.";
  if (i.body.length > 20000) return "The procedure is too long.";
  if (!i.purpose?.trim()) return "State the purpose.";
  if (i.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(i.reviewDate)) return "Review date must be YYYY-MM-DD.";
  return null;
}

export function validateApproval(i: {
  status: string; actorRole: string; actorId: number; authorId: number | null; reviewDate?: string | null; today: string;
}): string | null {
  if (i.status !== "DRAFT") return "Only a draft can be approved.";
  if (i.actorRole !== "OWNER") return "Only the owner can approve a procedure.";
  if (!i.reviewDate) return "Set a review date before approving.";
  if (i.reviewDate <= i.today) return "The review date must be in the future.";
  return null;
}

export function mustAcknowledge(role: string | null | undefined, applicable: string[]): boolean {
  return !!role && applicable.includes(role);
}

export function reviewState(reviewDate: string | null | undefined, today: string): "OK" | "DUE_SOON" | "OVERDUE" | "NONE" {
  if (!reviewDate) return "NONE";
  if (reviewDate < today) return "OVERDUE";
  const soon = new Date(`${today}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 30);
  return reviewDate <= soon.toISOString().slice(0, 10) ? "DUE_SOON" : "OK";
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

// Who still has to acknowledge the current approved version.
export function pendingAcknowledgements(
  staff: { id: number; role: string | null; active: boolean }[],
  applicable: string[],
  acknowledgedIds: Set<number>,
): number[] {
  return staff.filter((s) => s.active && mustAcknowledge(s.role, applicable) && !acknowledgedIds.has(s.id)).map((s) => s.id);
}
