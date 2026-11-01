// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inventoryBalances, inventoryMovements, products } from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";

async function newProduct() {
  const sku = `INV-TEST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [p] = await db.insert(products).values({ sku, title: "Ledger test", status: "draft" }).returning();
  return p;
}

describe("applyStockMovement (integration)", () => {
  it("keeps ledger, balance and products.stock in agreement", async () => {
    const p = await newProduct();
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 10, employeeId: null });
    await applyStockMovement({ productId: p.id, type: "DAMAGE", quantity: 2, note: "dropped", employeeId: null });

    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, p.id));
    const sum = moves.reduce((a, m) => a + m.quantityChange, 0);
    const [bal] = await db.select().from(inventoryBalances).where(eq(inventoryBalances.productId, p.id));
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(sum).toBe(8);
    expect(bal.quantity).toBe(8);
    expect(prod.stock).toBe(8);
    expect(moves.at(-1)?.balanceAfter).toBe(8);
  });

  it("never oversells under concurrency: 15 racers for 10 units → exactly 10 succeed", async () => {
    const p = await newProduct();
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 10, employeeId: null });

    const results = await Promise.allSettled(
      Array.from({ length: 15 }, () =>
        applyStockMovement({ productId: p.id, type: "ADJUSTMENT_OUT", quantity: 1, note: "race", employeeId: null }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);

    const [bal] = await db.select().from(inventoryBalances).where(eq(inventoryBalances.productId, p.id));
    const [prod] = await db.select().from(products).where(eq(products.id, p.id));
    expect(bal.quantity).toBe(0);
    expect(prod.stock).toBe(0);
  });

  it("rejects a movement that would go below zero and records nothing", async () => {
    const p = await newProduct();
    await expect(
      applyStockMovement({ productId: p.id, type: "LOSS", quantity: 1, note: "x", employeeId: null }),
    ).rejects.toThrow(/below zero/);
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, p.id));
    expect(moves).toHaveLength(0);
  });
});
