// Pure rules for offline cash sales (no DB, no browser APIs).
//
// Policy (SAFE DEFAULTS pending owner decisions — see DELIVERY.md):
//  • Cash only. Mobile money / card can never be queued.
//  • One designated terminal; feature OFF until the owner turns it on.
//  • The customer paid the total they were shown. At sync the server re-prices
//    from current data; if the total differs, or stock/session no longer allow
//    the sale, it is NOT silently changed — it goes to a manager as a conflict.
//  • A queued sale only syncs under the employee who made it.

export const OFFLINE_MAX_AGE_DAYS = 7;
export const CLOCK_SKEW_MS = 5 * 60_000;

export type OfflineStatus = "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED";

export type OfflineSale = {
  clientId: string; // uuid, also the idempotency key
  terminalId: string;
  employeeId: number;
  occurredAt: string; // ISO
  lines: { productId: number; quantity: number }[];
  discountPercent: number;
  expectedTotal: number; // what the customer was told and paid
  tendered: number;
  customerName?: string;
  customerPhone?: string;
};

export function validateOfflineSale(s: OfflineSale, now: Date): string | null {
  if (!/^[0-9a-f-]{16,64}$/i.test(s.clientId)) return "Invalid sale id.";
  if (!s.terminalId) return "No terminal id.";
  if (!Array.isArray(s.lines) || s.lines.length === 0) return "The sale has no items.";
  if (!Number.isInteger(s.expectedTotal) || s.expectedTotal < 0) return "Invalid total.";
  if (!Number.isInteger(s.tendered) || s.tendered < s.expectedTotal) return "Cash tendered is less than the total.";
  const at = new Date(s.occurredAt);
  if (Number.isNaN(at.getTime())) return "Invalid sale time.";
  if (at.getTime() > now.getTime() + CLOCK_SKEW_MS) return "The sale time is in the future — check the till's clock.";
  if (now.getTime() - at.getTime() > OFFLINE_MAX_AGE_DAYS * 86_400_000) return `This sale is older than ${OFFLINE_MAX_AGE_DAYS} days and needs a manager.`;
  return null;
}

// The cash session must have been open when the customer paid; closed
// sessions are never edited, so a sale that missed its session is a conflict.
export function sessionCoversSale(sessionOpenedAt: Date, occurredAt: Date): boolean {
  return sessionOpenedAt.getTime() <= occurredAt.getTime() + CLOCK_SKEW_MS;
}

export function priceMatches(serverTotal: number, expectedTotal: number): string | null {
  return serverTotal === expectedTotal
    ? null
    : `Price changed since this sale: the customer paid ${expectedTotal.toLocaleString()} UGX but it now totals ${serverTotal.toLocaleString()} UGX.`;
}

// Receipt shown on the till before the server has recorded the sale.
export function provisionalReceipt(clientId: string): string {
  return `PENDING-${clientId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

// Server messages that mean "try again later" (not the sale's fault).
export function isRetryable(message: string): boolean {
  return /not signed in|offline sales are (switched )?off|network|timeout/i.test(message);
}

// What is left to sell per product once the unsynced queue is taken off the
// catalogue snapshot, so the till does not oversell what it already sold offline.
export function availableAfterQueue(onHand: number, productId: number, queue: Pick<OfflineSale, "lines">[]): number {
  const used = queue.reduce((a, s) => a + s.lines.filter((l) => l.productId === productId).reduce((b, l) => b + l.quantity, 0), 0);
  return Math.max(0, onHand - used);
}

// Oldest first, so receipts and stock movements are posted in the order sales happened.
export function syncOrder<T extends { occurredAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
