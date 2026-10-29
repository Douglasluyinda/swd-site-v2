// Region-based delivery fee matching — pure, no DB import (same reasoning
// as lib/product-fulfillment.ts: keeps this unit-testable without
// DATABASE_URL set). The DB read happens at the call site (app/api/checkout
// /route.ts), which passes the configured rows in.
//
// Optional and purely additive: when no shipping_rates rows are
// configured (the state every order has been in until now), checkout
// keeps using the existing per-product customerShipping sum unchanged —
// nothing changes for anyone who hasn't set this up. Once an admin adds a
// rate for a region (Admin → Shipping), an order whose city or country
// matches that region uses the configured flat fee instead.
//
// Matching is a deliberately simple case-insensitive exact match on the
// region name against the customer's entered city, then country — not a
// geocoded zone system. There's no verified list of SWD's actual delivery
// zones/fees yet (per the brief: don't promise delivery times or fees that
// haven't been established), so this is admin-entered data, not guessed.

export type DeliveryRateRow = { region: string; cost: number; estimatedDays: string | null };

export function matchDeliveryRate(
  rates: DeliveryRateRow[],
  city: string | undefined,
  country: string | undefined,
): DeliveryRateRow | null {
  const normalize = (s: string) => s.trim().toLowerCase();

  if (city) {
    const match = rates.find((r) => normalize(r.region) === normalize(city));
    if (match) return match;
  }
  if (country) {
    const match = rates.find((r) => normalize(r.region) === normalize(country));
    if (match) return match;
  }
  return null;
}
