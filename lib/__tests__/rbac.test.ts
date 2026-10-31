import { describe, expect, it } from "vitest";
import { hasPermission, isValidStaffRole, STAFF_ROLES } from "@/lib/rbac";

describe("isValidStaffRole", () => {
  it("accepts the four defined roles", () => {
    for (const role of STAFF_ROLES) {
      expect(isValidStaffRole(role)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isValidStaffRole("SUPERADMIN")).toBe(false);
    expect(isValidStaffRole("")).toBe(false);
    expect(isValidStaffRole("owner")).toBe(false); // case-sensitive
  });
});

describe("hasPermission", () => {
  it("grants OWNER full access, including staff management", () => {
    expect(hasPermission("OWNER", "staff.manage")).toBe(true);
    expect(hasPermission("OWNER", "cash.reconcile")).toBe(true);
    expect(hasPermission("OWNER", "settings.manage")).toBe(true);
  });

  it("denies MANAGER staff management and settings", () => {
    expect(hasPermission("MANAGER", "staff.manage")).toBe(false);
    expect(hasPermission("MANAGER", "settings.manage")).toBe(false);
    expect(hasPermission("MANAGER", "pos.refund")).toBe(true);
  });

  it("restricts CASHIER to POS/customers/own cash session", () => {
    expect(hasPermission("CASHIER", "pos.sell")).toBe(true);
    expect(hasPermission("CASHIER", "pos.refund")).toBe(false);
    expect(hasPermission("CASHIER", "inventory.manage")).toBe(false);
  });

  it("restricts TECHNICIAN to assigned repairs and inventory viewing", () => {
    expect(hasPermission("TECHNICIAN", "repairs.update")).toBe(true);
    expect(hasPermission("TECHNICIAN", "repairs.manage")).toBe(false);
    expect(hasPermission("TECHNICIAN", "reports.view")).toBe(false);
  });

  it("denies everything for a null, undefined, or invalid role (default deny)", () => {
    expect(hasPermission(null, "pos.sell")).toBe(false);
    expect(hasPermission(undefined, "pos.sell")).toBe(false);
    expect(hasPermission("NOT_A_ROLE", "pos.sell")).toBe(false);
  });
});
