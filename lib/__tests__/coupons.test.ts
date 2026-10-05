import { describe, it, expect } from "vitest";
import { computeDiscount } from "@/lib/coupons";

describe("computeDiscount", () => {
  it("computes a percent-off discount", () => {
    expect(computeDiscount({ percentOff: 10, amountOff: null }, 100)).toBe(10);
  });

  it("computes an amount-off discount", () => {
    expect(computeDiscount({ percentOff: null, amountOff: 15 }, 100)).toBe(15);
  });

  it("caps amount-off at the subtotal (never a negative total)", () => {
    expect(computeDiscount({ percentOff: null, amountOff: 500 }, 100)).toBe(100);
  });

  it("returns 0 when neither discount type is set", () => {
    expect(computeDiscount({ percentOff: null, amountOff: null }, 100)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeDiscount({ percentOff: 33, amountOff: null }, 10)).toBe(3.3);
  });
});
