import { describe, expect, it } from "vitest";
import { isLowStock, signedQuantity, validateMovement } from "@/lib/inventory-ledger";

describe("signedQuantity", () => {
  it("adds for receipts/returns-in and subtracts for sales/losses", () => {
    expect(signedQuantity("PURCHASE_RECEIPT", 5)).toBe(5);
    expect(signedQuantity("CUSTOMER_RETURN", 2)).toBe(2);
    expect(signedQuantity("SALE", 3)).toBe(-3);
    expect(signedQuantity("DAMAGE", 1)).toBe(-1);
    expect(signedQuantity("SUPPLIER_RETURN", 4)).toBe(-4);
  });
});

describe("validateMovement", () => {
  it("accepts a normal receipt", () => {
    expect(validateMovement({ type: "PURCHASE_RECEIPT", quantity: 10, currentBalance: 0 })).toBeNull();
  });
  it("rejects zero, negative and fractional quantities", () => {
    for (const q of [0, -1, 1.5]) {
      expect(validateMovement({ type: "PURCHASE_RECEIPT", quantity: q, currentBalance: 0 })).not.toBeNull();
    }
  });
  it("rejects going below zero", () => {
    expect(
      validateMovement({ type: "ADJUSTMENT_OUT", quantity: 3, currentBalance: 2, note: "recount" }),
    ).toMatch(/below zero/);
  });
  it("allows taking stock to exactly zero", () => {
    expect(validateMovement({ type: "LOSS", quantity: 2, currentBalance: 2, note: "stolen" })).toBeNull();
  });
  it("requires a reason for adjustments, damage and loss only", () => {
    expect(validateMovement({ type: "DAMAGE", quantity: 1, currentBalance: 5 })).toMatch(/reason/);
    expect(validateMovement({ type: "ADJUSTMENT_IN", quantity: 1, currentBalance: 5, note: " " })).toMatch(/reason/);
    expect(validateMovement({ type: "SUPPLIER_RETURN", quantity: 1, currentBalance: 5 })).toBeNull();
  });
});

describe("isLowStock", () => {
  it("flags at or below the reorder level; no level means no alert", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(0, null)).toBe(false);
  });
});
