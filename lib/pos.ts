// Pure POS rules (no DB). UGX is a whole-number currency, so all sale math is
// integer arithmetic — no floats in money.
//
// Approval limits below are SAFE DEFAULTS pending the owner's decision (the
// Business OS pack lists discount/refund limits as owner decisions): cashiers
// can't discount, managers up to 10%, owners any amount.

export type SaleLineInput = { productId: number; quantity: number };
export type PricedLine = SaleLineInput & { unitPrice: number };

export const DISCOUNT_LIMIT_PERCENT: Record<string, number> = {
  OWNER: 100,
  MANAGER: 10,
  CASHIER: 0,
  TECHNICIAN: 0,
};

export function computeSale(lines: PricedLine[], discountPercent: number) {
  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const discount = Math.round((subtotal * discountPercent) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

export function validateSaleInput(input: {
  lines: SaleLineInput[];
  discountPercent: number;
  role: string | null | undefined;
  tendered: number;
  total: number;
}): string | null {
  if (input.lines.length === 0) return "The cart is empty.";
  for (const l of input.lines) {
    if (!Number.isInteger(l.productId) || l.productId <= 0) return "Invalid product.";
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) return "Quantities must be positive whole numbers.";
  }
  const ids = input.lines.map((l) => l.productId);
  if (new Set(ids).size !== ids.length) return "Each product may appear only once.";
  if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100) {
    return "Discount must be between 0 and 100%.";
  }
  const limit = DISCOUNT_LIMIT_PERCENT[input.role ?? ""] ?? 0;
  if (input.discountPercent > limit) {
    return `Your role can give at most ${limit}% discount; ask a manager or owner.`;
  }
  if (!Number.isInteger(input.tendered) || input.tendered < input.total) {
    return "Cash tendered is less than the total.";
  }
  return null;
}

export function receiptNumber(year: number, seq: number): string {
  return `SWD-R-${year}-${String(seq).padStart(6, "0")}`;
}

// How many of a sale line can still be returned.
export function returnableQuantity(sold: number, alreadyReturned: number): number {
  return Math.max(0, sold - alreadyReturned);
}

// Refund for returned units, pro-rated for the sale-level discount so a
// discounted sale never refunds more than was actually paid.
export function refundAmount(unitPrice: number, quantity: number, subtotal: number, discount: number): number {
  const gross = unitPrice * quantity;
  if (subtotal <= 0) return 0;
  return Math.round(gross - (gross * discount) / subtotal);
}
