import { describe, expect, it } from "vitest";
import { computeSale, receiptNumber, refundAmount, returnableQuantity, validateSaleInput } from "@/lib/pos";

describe("computeSale", () => {
  it("computes integer subtotal, discount and total", () => {
    expect(computeSale([{ productId: 1, quantity: 2, unitPrice: 25000 }, { productId: 2, quantity: 1, unitPrice: 9900 }], 10))
      .toEqual({ subtotal: 59900, discount: 5990, total: 53910 });
  });
  it("rounds the discount to a whole shilling", () => {
    expect(computeSale([{ productId: 1, quantity: 1, unitPrice: 999 }], 5).discount).toBe(50);
  });
});

describe("validateSaleInput", () => {
  const base = { lines: [{ productId: 1, quantity: 1 }], discountPercent: 0, role: "CASHIER", tendered: 1000, total: 1000 };
  it("accepts a plain cash sale", () => expect(validateSaleInput(base)).toBeNull());
  it("rejects empty cart, duplicate products, bad quantities", () => {
    expect(validateSaleInput({ ...base, lines: [] })).toMatch(/empty/);
    expect(validateSaleInput({ ...base, lines: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] })).toMatch(/only once/);
    expect(validateSaleInput({ ...base, lines: [{ productId: 1, quantity: 0 }] })).toMatch(/positive/);
    expect(validateSaleInput({ ...base, lines: [{ productId: 1, quantity: 1.5 }] })).toMatch(/positive/);
  });
  it("enforces role discount limits", () => {
    expect(validateSaleInput({ ...base, discountPercent: 1 })).toMatch(/at most 0%/);
    expect(validateSaleInput({ ...base, role: "MANAGER", discountPercent: 10 })).toBeNull();
    expect(validateSaleInput({ ...base, role: "MANAGER", discountPercent: 11 })).toMatch(/at most 10%/);
    expect(validateSaleInput({ ...base, role: "OWNER", discountPercent: 50 })).toBeNull();
    expect(validateSaleInput({ ...base, role: null, discountPercent: 1 })).not.toBeNull();
  });
  it("rejects under-tendered cash", () => {
    expect(validateSaleInput({ ...base, tendered: 999 })).toMatch(/less than/);
  });
});

describe("receipts and returns", () => {
  it("formats receipt numbers", () => expect(receiptNumber(2026, 42)).toBe("SWD-R-2026-000042"));
  it("limits returns to what remains", () => {
    expect(returnableQuantity(3, 1)).toBe(2);
    expect(returnableQuantity(3, 5)).toBe(0);
  });
  it("pro-rates refunds for the sale discount", () => {
    // 10% off a 100000 sale; returning a 40000 line refunds 36000.
    expect(refundAmount(20000, 2, 100000, 10000)).toBe(36000);
    expect(refundAmount(20000, 2, 0, 0)).toBe(0);
  });
});
