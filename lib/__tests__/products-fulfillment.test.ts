import { describe, it, expect } from "vitest";
import { isPurchasableInStore, validateProductFulfillment } from "@/lib/product-fulfillment";

describe("isPurchasableInStore", () => {
  it("allows SWD-inventory products through checkout", () => {
    expect(isPurchasableInStore({ fulfillmentType: "inventory" })).toBe(true);
  });

  it("allows a null fulfillmentType (legacy rows) through checkout", () => {
    expect(isPurchasableInStore({ fulfillmentType: null })).toBe(true);
  });

  it("blocks affiliate listings from checkout", () => {
    expect(isPurchasableInStore({ fulfillmentType: "affiliate" })).toBe(false);
  });
});

describe("validateProductFulfillment", () => {
  it("requires an affiliate link when fulfillmentType is affiliate", () => {
    expect(
      validateProductFulfillment({ fulfillmentType: "affiliate", affiliateUrl: null }),
    ).toMatch(/affiliate link is required/i);
  });

  it("accepts an affiliate product with a link, regardless of supplier", () => {
    expect(
      validateProductFulfillment({
        fulfillmentType: "affiliate",
        affiliateUrl: "https://partner.example.com/product",
        supplierId: null,
      }),
    ).toBeNull();
  });

  it("requires a supplier for SWD-inventory products", () => {
    expect(
      validateProductFulfillment({ fulfillmentType: "inventory", supplierId: null }),
    ).toMatch(/supplier is required/i);
  });

  it("accepts an inventory product with a supplier", () => {
    expect(
      validateProductFulfillment({ fulfillmentType: "inventory", supplierId: 3 }),
    ).toBeNull();
  });
});
