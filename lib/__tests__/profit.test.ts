import { describe, it, expect } from "vitest";
import { calculateProfit } from "@/lib/profit";

describe("calculateProfit", () => {
  it("computes the demo blender's contribution margin correctly", () => {
    // Portable Blender (DEMO): $50 selling + $4 customer shipping,
    // $20 supplier cost + $6 supplier shipping.
    const result = calculateProfit({
      sellingPrice: 50,
      customerShipping: 4,
      supplierCost: 20,
      supplierShipping: 6,
      paymentFeeRate: 0.029,
      advertisingCostPerOrder: 0,
      refundReserveRate: 0.03,
    });

    expect(result.revenue).toBe(54);
    expect(result.grossMargin).toBe(28); // 54 - 20 - 6
    expect(result.paymentFees).toBeCloseTo(54 * 0.029, 5);
    expect(result.refundReserve).toBeCloseTo(54 * 0.03, 5);
    expect(result.contributionMargin).toBeCloseTo(
      28 - 54 * 0.029 - 54 * 0.03,
      5,
    );
  });

  it("handles zero revenue without dividing by zero", () => {
    const result = calculateProfit({
      sellingPrice: 0,
      customerShipping: 0,
      supplierCost: 0,
      supplierShipping: 0,
    });
    expect(result.revenue).toBe(0);
    expect(result.grossMarginRate).toBe(0);
    expect(result.contributionMarginRate).toBe(0);
  });

  it("lets advertising cost reduce contribution margin directly", () => {
    const withoutAds = calculateProfit({
      sellingPrice: 100,
      customerShipping: 0,
      supplierCost: 40,
      supplierShipping: 0,
      paymentFeeRate: 0,
      refundReserveRate: 0,
    });
    const withAds = calculateProfit({
      sellingPrice: 100,
      customerShipping: 0,
      supplierCost: 40,
      supplierShipping: 0,
      paymentFeeRate: 0,
      refundReserveRate: 0,
      advertisingCostPerOrder: 15,
    });
    expect(withoutAds.contributionMargin - withAds.contributionMargin).toBe(15);
  });
});
