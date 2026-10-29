// Pure fulfilment-type rules, shared by the admin create/edit form
// (lib/admin-actions.ts) and the checkout route (app/api/checkout/route.ts)
// so both enforce the same contract: an affiliate listing is an outbound
// link to a verified partner and must never be treated as SWD-owned stock.
//
// No DB import here on purpose — keeps this unit-testable without
// DATABASE_URL set, same as lib/checkout-pricing.ts.

export function isPurchasableInStore(product: { fulfillmentType: string | null }): boolean {
  return product.fulfillmentType !== "affiliate";
}

export function validateProductFulfillment(input: {
  fulfillmentType: string;
  affiliateUrl?: string | null;
  supplierId?: number | null;
}): string | null {
  if (input.fulfillmentType === "affiliate") {
    return input.affiliateUrl
      ? null
      : "An affiliate link is required when Fulfilment is set to Affiliate.";
  }
  // SWD-owned inventory must be traceable to a known supplier — affiliate
  // listings are the only kind that can skip this.
  return input.supplierId ? null : "A supplier is required for SWD-inventory products.";
}
