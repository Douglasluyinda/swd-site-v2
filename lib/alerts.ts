// Pure alert rules (no DB). Alerts are computed live from the records each time
// the dashboard loads — nothing is stored, so they cannot go stale. Each alert is
// only shown to roles that hold the permission to act on it.
import { hasPermission, type Permission } from "@/lib/rbac";

export const QUOTE_WAITING_DAYS = 3; // customer has not answered a quote
export const READY_UNCOLLECTED_DAYS = 14; // finished repair still in the shop
export const CASH_SESSION_OPEN_HOURS = 16; // session probably left open

export type AlertCounts = {
  lowStock: number;
  cashPendingApproval: number;
  cashLeftOpen: number;
  poAwaitingApproval: number;
  quotesWaiting: number;
  repairsUncollected: number;
  sopReviewsDue: number;
  offlineSyncIssues: number;
};

export type Alert = { key: string; severity: "HIGH" | "MEDIUM"; text: string; href: string };

const RULES: { key: keyof AlertCounts; permission: Permission; severity: Alert["severity"]; href: string; text: (n: number) => string }[] = [
  { key: "cashPendingApproval", permission: "cash.reconcile", severity: "HIGH", href: "/admin/business-os/cash", text: (n) => `${n} cash session${n === 1 ? "" : "s"} with a variance waiting for approval` },
  { key: "cashLeftOpen", permission: "cash.reconcile", severity: "HIGH", href: "/admin/business-os/cash", text: (n) => `${n} cash session${n === 1 ? "" : "s"} open for more than ${CASH_SESSION_OPEN_HOURS} hours` },
  { key: "offlineSyncIssues", permission: "cash.reconcile", severity: "HIGH", href: "/admin/business-os/pos/offline-issues", text: (n) => `${n} offline sale${n === 1 ? "" : "s"} could not be recorded and need${n === 1 ? "s" : ""} a manager` },
  { key: "poAwaitingApproval", permission: "purchasing.approve", severity: "MEDIUM", href: "/admin/business-os/purchasing", text: (n) => `${n} purchase order${n === 1 ? "" : "s"} awaiting approval` },
  { key: "lowStock", permission: "inventory.view", severity: "MEDIUM", href: "/admin/business-os/inventory", text: (n) => `${n} product${n === 1 ? " is" : "s are"} at or below reorder level` },
  { key: "quotesWaiting", permission: "repairs.manage", severity: "MEDIUM", href: "/admin/business-os/repairs?status=QUOTED", text: (n) => `${n} repair quote${n === 1 ? "" : "s"} unanswered for ${QUOTE_WAITING_DAYS}+ days` },
  { key: "repairsUncollected", permission: "repairs.counter", severity: "MEDIUM", href: "/admin/business-os/repairs?status=READY", text: (n) => `${n} repaired device${n === 1 ? "" : "s"} waiting ${READY_UNCOLLECTED_DAYS}+ days for collection` },
  { key: "sopReviewsDue", permission: "sops.manage", severity: "MEDIUM", href: "/admin/business-os/sops", text: (n) => `${n} SOP${n === 1 ? "" : "s"} overdue or due for review within 30 days` },
];

export function buildAlerts(counts: AlertCounts, role: string | null | undefined): Alert[] {
  return RULES
    .filter((r) => counts[r.key] > 0 && hasPermission(role, r.permission))
    .map((r) => ({ key: r.key, severity: r.severity, href: r.href, text: r.text(counts[r.key]) }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "HIGH" ? -1 : 1));
}
