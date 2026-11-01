import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products,
  receiptCounters,
  saleItems,
  salePayments,
  saleReturnItems,
  saleReturns,
  sales,
} from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import { getOpenSession } from "@/lib/cash-sessions";
import { findOrCreateByPhone } from "@/lib/customer-service";
import { normalizePhone } from "@/lib/customers";
import {
  computeSale,
  receiptNumber,
  refundAmount,
  returnableQuantity,
  validateSaleInput,
  type SaleLineInput,
} from "@/lib/pos";

export type CreateSaleInput = {
  idempotencyKey: string;
  employeeId: number;
  role: string;
  lines: SaleLineInput[];
  discountPercent: number;
  tendered: number;
  customerName?: string | null;
  customerPhone?: string | null;
};

// One atomic operation: validate → re-price from the DB (never trust client
// prices) → sale + items + cash payment → SALE ledger movements → receipt.
// A retried submit with the same idempotency key returns the original sale.
export async function createSale(input: CreateSaleInput): Promise<{ receiptNumber: string; duplicate: boolean }> {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) throw new Error("Missing idempotency key.");

  const [existing] = await db.select().from(sales).where(eq(sales.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) return { receiptNumber: existing.receiptNumber, duplicate: true };

  const ids = input.lines.map((l) => l.productId);
  const rows = ids.length
    ? await db.select().from(products).where(inArray(products.id, ids))
    : [];
  const byId = new Map(rows.map((p) => [p.id, p]));

  const priced = input.lines.map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw new Error("A product in the cart no longer exists.");
    if (p.fulfillmentType !== "inventory") throw new Error(`${p.title} is not SWD stock and cannot be sold at the till.`);
    if (p.status !== "active") throw new Error(`${p.title} is not active.`);
    const unitPrice = p.sellingPrice ?? p.price;
    if (unitPrice == null || unitPrice <= 0) throw new Error(`${p.title} has no selling price.`);
    return { ...l, unitPrice: Math.round(unitPrice) };
  });

  const totals = computeSale(priced, input.discountPercent);
  const err = validateSaleInput({
    lines: input.lines,
    discountPercent: input.discountPercent,
    role: input.role,
    tendered: input.tendered,
    total: totals.total,
  });
  if (err) throw new Error(err);

  try {
    return await db.transaction(async (tx) => {
      // Cash handling must be attributable: no open session, no cash sale.
      const session = await getOpenSession(tx as unknown as typeof db, input.employeeId);
      if (!session) throw new Error("Open a cash session before making a sale.");

      // Walk-ins stay anonymous. If a phone is given, link (or register) the
      // customer so purchase history builds up — a bad phone fails the sale
      // before anything is written.
      let customerId: number | null = null;
      if (input.customerPhone?.trim()) {
        if (!normalizePhone(input.customerPhone)) throw new Error("Enter a valid phone number, or leave it blank for a walk-in.");
        const c = await findOrCreateByPhone(tx as unknown as typeof db, {
          name: input.customerName?.trim() || "Walk-in customer", phone: input.customerPhone,
        });
        customerId = c.id;
      }

      const year = new Date().getFullYear();
      const [counter] = await tx
        .insert(receiptCounters)
        .values({ year, seq: 1 })
        .onConflictDoUpdate({ target: receiptCounters.year, set: { seq: sql`${receiptCounters.seq} + 1` } })
        .returning({ seq: receiptCounters.seq });
      const number = receiptNumber(year, counter.seq);

      const [sale] = await tx
        .insert(sales)
        .values({
          receiptNumber: number,
          idempotencyKey: input.idempotencyKey,
          employeeId: input.employeeId,
          cashSessionId: session.id,
          customerId,
          customerName: input.customerName?.trim() || null,
          customerPhone: input.customerPhone?.trim() || null,
          subtotal: totals.subtotal,
          discountPercent: input.discountPercent,
          discountAmount: totals.discount,
          total: totals.total,
        })
        .returning({ id: sales.id });

      for (const l of priced) {
        const p = byId.get(l.productId)!;
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: p.id,
          sku: p.sku,
          title: p.title,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitCost: p.costPrice ?? p.supplierCost ?? null,
        });
        // Throws (rolling back the whole sale) if stock would go below zero.
        await applyStockMovement(
          {
            productId: p.id,
            type: "SALE",
            quantity: l.quantity,
            reference: number,
            employeeId: input.employeeId,
          },
          tx as unknown as typeof db,
        );
      }

      await tx.insert(salePayments).values({
        saleId: sale.id,
        method: "CASH",
        amount: totals.total,
        tendered: input.tendered,
        status: "RECEIVED",
      });

      return { receiptNumber: number, duplicate: false };
    });
  } catch (e) {
    // Lost a race with an identical retry: the unique key rejected us.
    const [raced] = await db.select().from(sales).where(eq(sales.idempotencyKey, input.idempotencyKey)).limit(1);
    if (raced) return { receiptNumber: raced.receiptNumber, duplicate: true };
    throw e;
  }
}

// Full or partial return of sold units: restocks via CUSTOMER_RETURN ledger
// entries and records a pro-rated refund, all in one transaction.
export async function refundSale(input: {
  receiptNumber: string;
  employeeId: number;
  reason: string;
  quantities: Record<number, number>; // saleItemId -> units to return
}): Promise<{ refundTotal: number }> {
  if (!input.reason.trim()) throw new Error("A reason is required for a return.");

  return db.transaction(async (tx) => {
    // Cash goes out of the processing employee's drawer, so they need a session.
    const session = await getOpenSession(tx as unknown as typeof db, input.employeeId);
    if (!session) throw new Error("Open a cash session before processing a refund.");

    const [sale] = await tx.select().from(sales).where(eq(sales.receiptNumber, input.receiptNumber)).for("update");
    if (!sale) throw new Error("Sale not found.");

    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    const prior = await tx
      .select({ saleItemId: saleReturnItems.saleItemId, qty: sql<number>`sum(${saleReturnItems.quantity})::int` })
      .from(saleReturnItems)
      .innerJoin(saleReturns, eq(saleReturns.id, saleReturnItems.returnId))
      .where(eq(saleReturns.saleId, sale.id))
      .groupBy(saleReturnItems.saleItemId);
    const returned = new Map(prior.map((r) => [r.saleItemId, r.qty]));

    const toReturn: { item: (typeof items)[number]; qty: number; amount: number }[] = [];
    for (const item of items) {
      const qty = input.quantities[item.id] ?? 0;
      if (!qty) continue;
      if (!Number.isInteger(qty) || qty < 0) throw new Error("Return quantities must be whole numbers.");
      if (qty > returnableQuantity(item.quantity, returned.get(item.id) ?? 0)) {
        throw new Error(`Cannot return more than was sold for ${item.title}.`);
      }
      toReturn.push({ item, qty, amount: refundAmount(item.unitPrice, qty, sale.subtotal, sale.discountAmount) });
    }
    if (toReturn.length === 0) throw new Error("Choose at least one item to return.");

    const refundTotal = toReturn.reduce((a, r) => a + r.amount, 0);
    const [ret] = await tx
      .insert(saleReturns)
      .values({ saleId: sale.id, employeeId: input.employeeId, cashSessionId: session.id, reason: input.reason.trim(), refundTotal })
      .returning({ id: saleReturns.id });

    for (const r of toReturn) {
      await tx.insert(saleReturnItems).values({
        returnId: ret.id,
        saleItemId: r.item.id,
        quantity: r.qty,
        refundAmount: r.amount,
      });
      await applyStockMovement(
        {
          productId: r.item.productId,
          type: "CUSTOMER_RETURN",
          quantity: r.qty,
          unitCost: r.item.unitCost,
          reference: `${sale.receiptNumber} return`,
          note: input.reason.trim(),
          employeeId: input.employeeId,
        },
        tx as unknown as typeof db,
      );
    }
    return { refundTotal };
  });
}

