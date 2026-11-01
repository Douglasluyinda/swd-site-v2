import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  goodsReceiptItems, goodsReceipts, poCounters, purchaseOrderItems, purchaseOrders,
  supplierInvoices, supplierPayments, suppliers,
} from "@/lib/db/schema";
import { applyStockMovement } from "@/lib/inventory";
import {
  canApprovePo, poNumber, poTotal, remainingToReceive, statusAfterReceipt, supplierBalance,
  validatePayment, validatePoLines, validateReceiptLine,
} from "@/lib/purchasing";

// Inside transactions use `tx`, never the global `db` (single-connection pool).
type Tx = typeof db;

export async function createPurchaseOrder(input: {
  supplierId: number; createdBy: number; note?: string | null;
  lines: { productId: number; quantity: number; unitCost: number }[];
}) {
  const err = validatePoLines(input.lines);
  if (err) throw new Error(err);
  return db.transaction(async (tx) => {
    const [sup] = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!sup) throw new Error("Choose a supplier.");
    if (sup.status && sup.status !== "active") throw new Error("That supplier is not active.");

    const year = new Date().getFullYear();
    const [c] = await tx
      .insert(poCounters).values({ year, seq: 1 })
      .onConflictDoUpdate({ target: poCounters.year, set: { seq: sql`${poCounters.seq} + 1` } })
      .returning({ seq: poCounters.seq });
    const number = poNumber(year, c.seq);

    const [po] = await tx.insert(purchaseOrders).values({
      poNumber: number, supplierId: input.supplierId, status: "PENDING_APPROVAL",
      total: poTotal(input.lines), note: input.note?.trim() || null, createdBy: input.createdBy,
    }).returning({ id: purchaseOrders.id });
    await tx.insert(purchaseOrderItems).values(input.lines.map((l) => ({ poId: po.id, ...l })));
    return { poNumber: number };
  });
}

export async function approvePurchaseOrder(input: {
  poNumber: string; approverId: number; approverRole: string; hasPermission: boolean;
}) {
  return db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, input.poNumber)).for("update");
    if (!po || po.status !== "PENDING_APPROVAL") throw new Error("That order is not awaiting approval.");
    const err = canApprovePo({
      approverId: input.approverId, approverRole: input.approverRole, creatorId: po.createdBy,
      total: po.total, hasPermission: input.hasPermission,
    });
    if (err) throw new Error(err);
    await tx.update(purchaseOrders)
      .set({ status: "APPROVED", approvedBy: input.approverId, approvedAt: new Date() })
      .where(eq(purchaseOrders.id, po.id));
  });
}

export async function cancelPurchaseOrder(poNumberInput: string) {
  return db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumberInput)).for("update");
    if (!po) throw new Error("Order not found.");
    if (po.status !== "PENDING_APPROVAL" && po.status !== "APPROVED") {
      throw new Error("Only orders with nothing received yet can be cancelled.");
    }
    await tx.update(purchaseOrders).set({ status: "CANCELLED" }).where(eq(purchaseOrders.id, po.id));
  });
}

// Goods receipt: the ONLY thing that raises stock for a purchase. Locks the PO
// so two people receiving at once can't both exceed the ordered quantity.
export async function receiveGoods(input: {
  poNumber: string; receivedBy: number; note?: string | null;
  lines: { poItemId: number; accepted: number; rejected: number; rejectionNote?: string | null }[];
}) {
  return db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, input.poNumber)).for("update");
    if (!po) throw new Error("Order not found.");
    if (po.status !== "APPROVED" && po.status !== "PARTIALLY_RECEIVED") {
      throw new Error("Only approved orders can receive goods.");
    }

    const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, po.id));
    const got = await tx
      .select({ poItemId: goodsReceiptItems.poItemId, qty: sql<number>`sum(${goodsReceiptItems.quantityAccepted})::int` })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptItems.receiptId))
      .where(eq(goodsReceipts.poId, po.id))
      .groupBy(goodsReceiptItems.poItemId);
    const accepted = new Map(got.map((g) => [g.poItemId, g.qty]));

    const todo = input.lines.filter((l) => l.accepted > 0 || l.rejected > 0);
    if (todo.length === 0) throw new Error("Enter at least one received or rejected quantity.");
    for (const l of todo) {
      const item = items.find((i) => i.id === l.poItemId);
      if (!item) throw new Error("A line does not belong to this order.");
      const err = validateReceiptLine({
        remaining: remainingToReceive(item.quantity, accepted.get(item.id) ?? 0),
        accepted: l.accepted, rejected: l.rejected, note: l.rejectionNote,
      });
      if (err) throw new Error(err);
    }

    const [receipt] = await tx.insert(goodsReceipts)
      .values({ poId: po.id, receivedBy: input.receivedBy, note: input.note?.trim() || null })
      .returning({ id: goodsReceipts.id });

    for (const l of todo) {
      const item = items.find((i) => i.id === l.poItemId)!;
      await tx.insert(goodsReceiptItems).values({
        receiptId: receipt.id, poItemId: item.id, quantityAccepted: l.accepted,
        quantityRejected: l.rejected, rejectionNote: l.rejectionNote?.trim() || null,
      });
      if (l.accepted > 0) {
        await applyStockMovement({
          productId: item.productId, type: "PURCHASE_RECEIPT", quantity: l.accepted,
          unitCost: item.unitCost, reference: po.poNumber, employeeId: input.receivedBy,
        }, tx as unknown as Tx);
        accepted.set(item.id, (accepted.get(item.id) ?? 0) + l.accepted);
      }
    }

    const status = statusAfterReceipt(items.map((i) => ({ ordered: i.quantity, accepted: accepted.get(i.id) ?? 0 })));
    await tx.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, po.id));
    return { status };
  });
}

export async function recordSupplierInvoice(input: {
  supplierId: number; poNumber?: string | null; invoiceNumber: string; amount: number; dueDate?: Date | null; createdBy: number;
}) {
  if (!input.invoiceNumber.trim()) throw new Error("Invoice number is required.");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("Amount must be a positive whole number.");
  return db.transaction(async (tx) => {
    let poId: number | null = null;
    if (input.poNumber) {
      const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, input.poNumber)).limit(1);
      if (!po || po.supplierId !== input.supplierId) throw new Error("That order is not from this supplier.");
      poId = po.id;
    }
    try {
      await tx.insert(supplierInvoices).values({
        supplierId: input.supplierId, poId, invoiceNumber: input.invoiceNumber.trim(),
        amount: input.amount, dueDate: input.dueDate ?? null, createdBy: input.createdBy,
      });
    } catch {
      throw new Error("That invoice number is already recorded for this supplier.");
    }
  });
}

export async function getSupplierBalance(executor: Tx, supplierId: number) {
  const [{ v: invoiced }] = await executor
    .select({ v: sql<number>`coalesce(sum(${supplierInvoices.amount}),0)::float` })
    .from(supplierInvoices).where(eq(supplierInvoices.supplierId, supplierId));
  const [{ v: paid }] = await executor
    .select({ v: sql<number>`coalesce(sum(${supplierPayments.amount}),0)::float` })
    .from(supplierPayments).where(eq(supplierPayments.supplierId, supplierId));
  return { invoiced, paid, balance: supplierBalance(invoiced, paid) };
}

// Supplier payment is an SWD-controlled operation recorded here — it never
// flows through the customer payment gateway.
export async function recordSupplierPayment(input: {
  supplierId: number; amount: number; method: string; reference?: string | null; paidBy: number;
}) {
  if (!input.method.trim()) throw new Error("Payment method is required.");
  return db.transaction(async (tx) => {
    // Serialise payments per supplier so two can't both pass the balance check.
    await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).for("update");
    const { balance } = await getSupplierBalance(tx as unknown as Tx, input.supplierId);
    const err = validatePayment({ amount: input.amount, balance });
    if (err) throw new Error(err);
    await tx.insert(supplierPayments).values({
      supplierId: input.supplierId, amount: input.amount, method: input.method.trim(),
      reference: input.reference?.trim() || null, paidBy: input.paidBy,
    });
  });
}
