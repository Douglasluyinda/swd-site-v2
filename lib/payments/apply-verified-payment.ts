// Shared by the Flutterwave webhook and the order-page verify-on-return
// check. Idempotent: re-running it for an already-successful payment is a
// no-op, so it's safe to call from both places.

import { getPaymentProvider } from "@/lib/payments";
import { db } from "@/lib/db/client";
import { orders, payments, trackingEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyPaymentConfirmed } from "@/lib/notifications";

export async function applyVerifiedPayment(providerTxId: string) {
  const provider = getPaymentProvider("flutterwave");
  const result = await provider.verify(providerTxId);

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.txRef, result.txRef))
    .limit(1);
  if (!payment) return { ok: false, reason: "unknown_tx_ref" as const };

  if (payment.status === "successful") {
    return { ok: true, alreadyProcessed: true, orderId: payment.orderId };
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  if (!order) return { ok: false, reason: "unknown_order" as const };

  if (!result.success || Math.round(result.amount) < Math.round(payment.amount)) {
    await db
      .update(payments)
      .set({
        status: "failed",
        providerTxId: result.providerTxId,
        rawPayload: JSON.stringify(result.raw),
      })
      .where(eq(payments.id, payment.id));
    return { ok: false, reason: "verification_failed" as const };
  }

  await db
    .update(payments)
    .set({
      status: "successful",
      providerTxId: result.providerTxId,
      feeAmount: result.feeAmount,
      verifiedAt: new Date(),
      rawPayload: JSON.stringify(result.raw),
    })
    .where(eq(payments.id, payment.id));

  await db
    .update(orders)
    .set({ status: "PAID", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  await db.insert(trackingEvents).values({ orderId: order.id, status: "payment_confirmed" });
  await notifyPaymentConfirmed(order);

  return { ok: true, alreadyProcessed: false, orderId: order.id };
}
