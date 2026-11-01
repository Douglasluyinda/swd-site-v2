import { describe, expect, it } from "vitest";
import { canApprove, expectedCash, needsApproval, validateClose, validateMovement, variance } from "@/lib/cash";

describe("expectedCash", () => {
  it("follows the spec formula", () => {
    expect(expectedCash({ openingFloat: 50000, cashSales: 200000, cashRefunds: 20000, expenses: 10000, withdrawals: 30000, deposits: 5000 }))
      .toBe(195000);
  });
  it("applies signed post-close corrections", () => {
    expect(expectedCash({ openingFloat: 0, cashSales: 100, cashRefunds: 0, expenses: 0, withdrawals: 0, deposits: 0, corrections: -40 })).toBe(60);
  });
});

describe("variance and approval", () => {
  it("is counted minus expected (short is negative)", () => {
    expect(variance(190000, 195000)).toBe(-5000);
    expect(variance(196000, 195000)).toBe(1000);
  });
  it("needs approval only beyond the threshold, in either direction", () => {
    expect(needsApproval(5000)).toBe(false);
    expect(needsApproval(-5001)).toBe(true);
    expect(needsApproval(5001)).toBe(true);
    expect(needsApproval(0)).toBe(false);
  });
});

describe("validateClose", () => {
  it("requires an explanation for any variance", () => {
    expect(validateClose({ counted: 100, varianceAmount: 0 })).toBeNull();
    expect(validateClose({ counted: 100, varianceAmount: -50 })).toMatch(/Explain/);
    expect(validateClose({ counted: 100, varianceAmount: -50, note: "gave wrong change" })).toBeNull();
  });
  it("rejects negative or fractional counts", () => {
    expect(validateClose({ counted: -1, varianceAmount: 0 })).not.toBeNull();
    expect(validateClose({ counted: 1.5, varianceAmount: 0 })).not.toBeNull();
  });
});

describe("validateMovement", () => {
  it("needs a valid type, positive amount, and a reason", () => {
    expect(validateMovement({ type: "EXPENSE", amount: 1000, reason: "lunch for guard" })).toBeNull();
    expect(validateMovement({ type: "SALE", amount: 1000, reason: "x" })).toMatch(/type/);
    expect(validateMovement({ type: "EXPENSE", amount: 0, reason: "x" })).toMatch(/positive/);
    expect(validateMovement({ type: "EXPENSE", amount: 5, reason: " " })).toMatch(/reason/);
  });
});

describe("canApprove", () => {
  it("blocks self-approval and users without permission", () => {
    expect(canApprove({ approverId: 1, closerId: 1, approverCanReconcile: true })).toMatch(/someone other/);
    expect(canApprove({ approverId: 2, closerId: 1, approverCanReconcile: false })).toMatch(/permission/);
    expect(canApprove({ approverId: 2, closerId: 1, approverCanReconcile: true })).toBeNull();
  });
});
