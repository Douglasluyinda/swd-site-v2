// Pure rules for the inventory ledger (no DB) so they can be unit-tested.
// Signs are fixed per movement type; callers pass a positive quantity and
// never choose the direction themselves.

export const MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "SALE",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "LOSS",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

const SIGN: Record<MovementType, 1 | -1> = {
  PURCHASE_RECEIPT: 1,
  SALE: -1,
  CUSTOMER_RETURN: 1,
  SUPPLIER_RETURN: -1,
  ADJUSTMENT_IN: 1,
  ADJUSTMENT_OUT: -1,
  DAMAGE: -1,
  LOSS: -1,
  TRANSFER_IN: 1,
  TRANSFER_OUT: -1,
};

// Movement types an employee may record by hand from the Inventory screen.
// SALE is reserved for POS; TRANSFER_* for a future multi-location flow.
export const MANUAL_MOVEMENT_TYPES: MovementType[] = [
  "PURCHASE_RECEIPT",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "LOSS",
];

// Types that explain a loss/correction, so a written reason is mandatory.
const REASON_REQUIRED: MovementType[] = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "LOSS"];

export function isMovementType(v: string): v is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(v);
}

export function signedQuantity(type: MovementType, quantity: number): number {
  return SIGN[type] * quantity;
}

export function validateMovement(input: {
  type: MovementType;
  quantity: number;
  currentBalance: number;
  note?: string | null;
}): string | null {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return "Quantity must be a positive whole number.";
  }
  if (REASON_REQUIRED.includes(input.type) && !input.note?.trim()) {
    return "A reason is required for adjustments, damage and loss.";
  }
  if (input.currentBalance + signedQuantity(input.type, input.quantity) < 0) {
    return "This would take stock below zero.";
  }
  return null;
}

export function isLowStock(quantity: number, reorderLevel: number | null | undefined): boolean {
  return reorderLevel != null && quantity <= reorderLevel;
}
