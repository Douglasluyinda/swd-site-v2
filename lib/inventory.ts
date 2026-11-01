import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  inventoryBalances,
  inventoryLocations,
  inventoryMovements,
  products,
} from "@/lib/db/schema";
import { signedQuantity, validateMovement, type MovementType } from "@/lib/inventory-ledger";

export const DEFAULT_LOCATION_NAME = "Main shop";

export async function getDefaultLocationId(executor: Pick<typeof db, "insert" | "select"> = db): Promise<number> {
  await executor.insert(inventoryLocations).values({ name: DEFAULT_LOCATION_NAME }).onConflictDoNothing();
  const [loc] = await executor
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.name, DEFAULT_LOCATION_NAME))
    .limit(1);
  return loc.id;
}

// The one way stock changes. Movement insert, balance update and the
// products.stock mirror all happen in a single transaction, with the
// balance row locked so concurrent movements can't both pass the
// "not below zero" check.
type Executor = Pick<typeof db, "insert" | "select" | "update" | "transaction">;

export async function applyStockMovement(
  input: {
  productId: number;
  locationId?: number;
  type: MovementType;
  quantity: number;
  unitCost?: number | null;
  reference?: string | null;
  note?: string | null;
  employeeId: number | null;
  },
  // Pass an open transaction to make the stock change part of a larger
  // atomic operation (e.g. a POS sale); omitted, it runs in its own.
  executor: Executor = db,
): Promise<{ balanceAfter: number }> {
  return executor.transaction(async (tx) => {
    // Everything below must use `tx`, never the global `db`: with a
    // single-connection pool (production) a second connection never comes.
    const locationId = input.locationId ?? (await getDefaultLocationId(tx));

    await tx
      .insert(inventoryBalances)
      .values({ productId: input.productId, locationId, quantity: 0 })
      .onConflictDoNothing();

    const [bal] = await tx
      .select()
      .from(inventoryBalances)
      .where(
        and(eq(inventoryBalances.productId, input.productId), eq(inventoryBalances.locationId, locationId)),
      )
      .for("update");

    const error = validateMovement({
      type: input.type,
      quantity: input.quantity,
      currentBalance: bal.quantity,
      note: input.note,
    });
    if (error) throw new Error(error);

    const change = signedQuantity(input.type, input.quantity);
    const balanceAfter = bal.quantity + change;

    await tx.insert(inventoryMovements).values({
      productId: input.productId,
      locationId,
      movementType: input.type,
      quantityChange: change,
      balanceAfter,
      unitCost: input.unitCost ?? null,
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      employeeId: input.employeeId,
    });
    await tx
      .update(inventoryBalances)
      .set({ quantity: balanceAfter, updatedAt: new Date() })
      .where(eq(inventoryBalances.id, bal.id));
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${change}`, updatedAt: new Date() })
      .where(eq(products.id, input.productId));

    return { balanceAfter };
  });
}
