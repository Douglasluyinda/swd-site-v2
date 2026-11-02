import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, discountLimits, resolveSettings, validateSetting, validateSettingsSet } from "@/lib/settings";
import { validateSaleInput } from "@/lib/pos";
import { canApprovePo } from "@/lib/purchasing";
import { needsApproval } from "@/lib/cash";

describe("settings", () => {
  it("defaults match the original safe defaults", () => {
    expect(discountLimits(DEFAULT_SETTINGS)).toEqual({ OWNER: 100, MANAGER: 10, CASHIER: 0, TECHNICIAN: 0 });
    expect(DEFAULT_SETTINGS["cash.variance_threshold"]).toBe(5000);
    expect(DEFAULT_SETTINGS["purchasing.owner_approval_threshold"]).toBe(1_000_000);
  });
  it("validates values", () => {
    expect(validateSetting("discount.manager_percent", "15")).toBeNull();
    expect(validateSetting("discount.manager_percent", "101")).toMatch(/between/);
    expect(validateSetting("discount.manager_percent", "-1")).toMatch(/whole number/);
    expect(validateSetting("discount.manager_percent", "1.5")).toMatch(/whole number/);
    expect(validateSetting("nope", "1")).toMatch(/Unknown/);
  });
  it("a bad stored value falls back to the default, never loosens a control", () => {
    expect(resolveSettings([{ key: "discount.cashier_percent", value: "9999" }, { key: "cash.variance_threshold", value: "abc" }, { key: "x", value: "1" }])).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings([{ key: "cash.variance_threshold", value: "20000" }])["cash.variance_threshold"]).toBe(20000);
  });
  it("cashier cannot exceed manager", () => {
    expect(validateSettingsSet({ ...DEFAULT_SETTINGS, "discount.cashier_percent": 11 })).toMatch(/cashier/);
    expect(validateSettingsSet({ ...DEFAULT_SETTINGS, "discount.cashier_percent": 5 })).toBeNull();
  });
  it("the rules actually use the configured numbers", () => {
    const base = { lines: [{ productId: 1, quantity: 1 }], tendered: 100000, total: 100000, role: "CASHIER" };
    expect(validateSaleInput({ ...base, discountPercent: 5 })).toMatch(/at most 0%/);
    expect(validateSaleInput({ ...base, discountPercent: 5, limits: { CASHIER: 5 } })).toBeNull();
    expect(needsApproval(8000)).toBe(true);
    expect(needsApproval(8000, 10000)).toBe(false);
    const po = { approverId: 2, approverRole: "MANAGER", creatorId: 1, total: 2_000_000, hasPermission: true };
    expect(canApprovePo(po)).toMatch(/owner/);
    expect(canApprovePo({ ...po, ownerThreshold: 5_000_000 })).toBeNull();
  });
});
