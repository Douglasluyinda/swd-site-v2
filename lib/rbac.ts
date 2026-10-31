// SWD Business OS — role-based access control.
//
// Four fixed roles per the Business OS spec (no dynamic custom-role
// builder in v1 — that's more machinery than a 4-role, single-shop
// business needs right now; add a role_permissions table later if roles
// need to vary per deployment). Permissions are enforced here, on the
// server, and checked again inside every Business OS server action —
// never trust a role check that only hid a button in the UI.

export type StaffRole = "OWNER" | "MANAGER" | "CASHIER" | "TECHNICIAN";

export const STAFF_ROLES: StaffRole[] = ["OWNER", "MANAGER", "CASHIER", "TECHNICIAN"];

export type Permission =
  | "staff.manage" // create/deactivate employees, assign roles
  | "pos.sell" // take POS sales
  | "pos.refund" // process refunds/returns
  | "inventory.manage" // stock receiving, adjustments
  | "inventory.view"
  | "customers.manage"
  | "suppliers.manage"
  | "purchasing.approve"
  | "repairs.manage" // full repair ticket lifecycle
  | "repairs.update" // technician: diagnosis, parts, status on assigned tickets
  | "cash.session" // open/close own cash session
  | "cash.reconcile" // review/approve cash sessions, variance
  | "reports.view"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  OWNER: [
    "staff.manage",
    "pos.sell",
    "pos.refund",
    "inventory.manage",
    "inventory.view",
    "customers.manage",
    "suppliers.manage",
    "purchasing.approve",
    "repairs.manage",
    "repairs.update",
    "cash.session",
    "cash.reconcile",
    "reports.view",
    "settings.manage",
  ],
  MANAGER: [
    "pos.sell",
    "pos.refund",
    "inventory.manage",
    "inventory.view",
    "customers.manage",
    "suppliers.manage",
    "purchasing.approve",
    "repairs.manage",
    "cash.session",
    "cash.reconcile",
    "reports.view",
  ],
  CASHIER: ["pos.sell", "inventory.view", "customers.manage", "cash.session"],
  TECHNICIAN: ["repairs.update", "inventory.view"],
};

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !STAFF_ROLES.includes(role as StaffRole)) return false;
  return ROLE_PERMISSIONS[role as StaffRole].includes(permission);
}

export function isValidStaffRole(role: string): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole);
}
