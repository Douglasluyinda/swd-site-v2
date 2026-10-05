// Pure pricing functions used by checkout — no DB, no I/O, so they're
// cheap to unit test directly. The checkout route fetches products from
// the database, then hands the raw numbers to these functions rather
// than doing the arithmetic inline; that split is what makes "the
// server never trusts client-sent prices" actually verifiable by a test
// rather than just an assertion in a comment.

export function computeUnitPrice(sellingPrice: number, variantPriceDelta = 0): number {
  return sellingPrice + variantPriceDelta;
}

export type PricedLine = {
  unitPrice: number;
  quantity: number;
  customerShipping: number;
};

export function sumCart(lines: PricedLine[]): {
  subtotal: number;
  shippingTotal: number;
  total: number;
} {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const shippingTotal = lines.reduce((sum, l) => sum + l.customerShipping, 0);
  return { subtotal, shippingTotal, total: subtotal + shippingTotal };
}
