import { describe, it, expect } from "vitest";
import { computeUnitPrice, sumCart } from "@/lib/checkout-pricing";

describe("computeUnitPrice", () => {
  it("returns the base selling price with no variant delta", () => {
    expect(computeUnitPrice(50)).toBe(50);
  });

  it("adds a positive variant price delta", () => {
    expect(computeUnitPrice(50, 5)).toBe(55);
  });

  it("applies a negative variant price delta", () => {
    expect(computeUnitPrice(50, -10)).toBe(40);
  });
});

describe("sumCart", () => {
  it("sums a single line item correctly (the demo blender case)", () => {
    const result = sumCart([{ unitPrice: 50, quantity: 2, customerShipping: 4 }]);
    expect(result).toEqual({ subtotal: 100, shippingTotal: 4, total: 104 });
  });

  it("charges shipping once per line, not once per unit", () => {
    const result = sumCart([{ unitPrice: 10, quantity: 5, customerShipping: 3 }]);
    expect(result.shippingTotal).toBe(3);
    expect(result.subtotal).toBe(50);
    expect(result.total).toBe(53);
  });

  it("sums multiple distinct line items", () => {
    const result = sumCart([
      { unitPrice: 50, quantity: 1, customerShipping: 4 },
      { unitPrice: 20, quantity: 3, customerShipping: 2 },
    ]);
    expect(result.subtotal).toBe(50 + 60);
    expect(result.shippingTotal).toBe(6);
    expect(result.total).toBe(116);
  });

  it("returns zeros for an empty cart", () => {
    expect(sumCart([])).toEqual({ subtotal: 0, shippingTotal: 0, total: 0 });
  });
});
