import { describe, expect, it } from "vitest";
import {
  canApprovePo, poNumber, poTotal, remainingToReceive, statusAfterReceipt, supplierBalance,
  validatePayment, validatePoLines, validateReceiptLine,
} from "@/lib/purchasing";

describe("po basics", () => {
  it("formats numbers and totals", () => {
    expect(poNumber(2026, 7)).toBe("SWD-PO-2026-000007");
    expect(poTotal([{ quantity: 10, unitCost: 15000 }, { quantity: 2, unitCost: 500 }])).toBe(151000);
  });
  it("validates lines", () => {
    expect(validatePoLines([])).toMatch(/at least one/);
    expect(validatePoLines([{ productId: 1, quantity: 1, unitCost: 1 }, { productId: 1, quantity: 1, unitCost: 1 }])).toMatch(/only once/);
    expect(validatePoLines([{ productId: 1, quantity: 0, unitCost: 5 }])).toMatch(/Quantities/);
    expect(validatePoLines([{ productId: 1, quantity: 1, unitCost: 0 }])).toMatch(/Unit costs/);
    expect(validatePoLines([{ productId: 1, quantity: 2, unitCost: 5 }])).toBeNull();
  });
});

describe("canApprovePo", () => {
  const base = { approverId: 2, approverRole: "MANAGER", creatorId: 1, total: 100000, hasPermission: true };
  it("allows a different manager within the limit", () => expect(canApprovePo(base)).toBeNull());
  it("blocks no permission and self-approval by a manager", () => {
    expect(canApprovePo({ ...base, hasPermission: false })).toMatch(/permission/);
    expect(canApprovePo({ ...base, approverId: 1 })).toMatch(/someone other/);
  });
  it("lets an owner approve their own order", () => {
    expect(canApprovePo({ ...base, approverId: 1, approverRole: "OWNER" })).toBeNull();
  });
  it("needs the owner above the threshold", () => {
    expect(canApprovePo({ ...base, total: 1_000_001 })).toMatch(/owner/);
    expect(canApprovePo({ ...base, total: 1_000_001, approverRole: "OWNER" })).toBeNull();
    expect(canApprovePo({ ...base, total: 1_000_000 })).toBeNull();
  });
});

describe("receiving", () => {
  it("computes remaining", () => {
    expect(remainingToReceive(10, 4)).toBe(6);
    expect(remainingToReceive(10, 12)).toBe(0);
  });
  it("validates a receipt line", () => {
    expect(validateReceiptLine({ remaining: 5, accepted: 5, rejected: 0 })).toBeNull();
    expect(validateReceiptLine({ remaining: 5, accepted: 6, rejected: 0 })).toMatch(/more than/);
    expect(validateReceiptLine({ remaining: 5, accepted: 3, rejected: 1 })).toMatch(/why/);
    expect(validateReceiptLine({ remaining: 5, accepted: 3, rejected: 1, note: "cracked" })).toBeNull();
    expect(validateReceiptLine({ remaining: 5, accepted: -1, rejected: 0 })).toMatch(/whole/);
  });
  it("sets partial vs complete", () => {
    expect(statusAfterReceipt([{ ordered: 5, accepted: 5 }, { ordered: 2, accepted: 1 }])).toBe("PARTIALLY_RECEIVED");
    expect(statusAfterReceipt([{ ordered: 5, accepted: 5 }, { ordered: 2, accepted: 2 }])).toBe("RECEIVED");
  });
});

describe("supplier money", () => {
  it("balance and payment validation", () => {
    expect(supplierBalance(500000, 200000)).toBe(300000);
    expect(validatePayment({ amount: 300000, balance: 300000 })).toBeNull();
    expect(validatePayment({ amount: 300001, balance: 300000 })).toMatch(/more than/);
    expect(validatePayment({ amount: 0, balance: 10 })).toMatch(/positive/);
  });
});
