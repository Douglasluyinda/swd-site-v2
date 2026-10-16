// Dispatch layer + the specific order-lifecycle notifications the spec
// calls for. Every call site (checkout, webhook, admin actions) calls
// one of these named functions rather than building messages inline,
// so the copy stays consistent and the channel logic stays in one place.
//
// Email (Resend), SMS (Twilio), and WhatsApp (Twilio) channels are all
// registered below; each independently no-ops if its own env vars aren't
// set, so you can configure any subset of them.

import { emailChannel } from "./email";
import { smsChannel } from "./sms";
import { whatsappChannel } from "./whatsapp";
import type { NotificationChannel, NotificationInput } from "./types";
import type { orders } from "@/lib/db/schema";

const channels: NotificationChannel[] = [emailChannel, smsChannel, whatsappChannel];

async function dispatch(input: NotificationInput) {
  const configured = channels.filter((c) => c.isConfigured());
  if (configured.length === 0) {
    // No provider configured — this is expected pre-launch. Log the
    // intent so it's visible in deploy logs without failing anything.
    console.log(`[notification skipped, no channel configured] ${input.subject} -> ${input.to}`);
    return;
  }
  await Promise.all(configured.map((c) => c.send(input).catch((err) => {
    console.error(`Notification channel "${c.name}" failed:`, err);
  })));
}

type OrderLike = typeof orders.$inferSelect;

export async function notifyOrderReceived(order: OrderLike, items: { unitPrice: number; quantity: number }[]) {
  if (!order.email && !order.phone) return;
  await dispatch({
    to: order.email ?? "",
    toPhone: order.phone ?? undefined,
    subject: `SWD order ${order.orderNumber} received`,
    text:
      `Hi ${order.fullName ?? "there"},\n\nWe've received your order ${order.orderNumber} ` +
      `for ${order.currency} ${(order.total ?? 0).toFixed(2)} (${items.length} item(s)). ` +
      `You'll get another message once payment is confirmed.\n\n— SWD`,
  });
}

export async function notifyPaymentConfirmed(order: OrderLike) {
  if (!order.email && !order.phone) return;
  await dispatch({
    to: order.email ?? "",
    toPhone: order.phone ?? undefined,
    subject: `Payment confirmed — SWD order ${order.orderNumber}`,
    text:
      `Hi ${order.fullName ?? "there"},\n\nPayment for order ${order.orderNumber} is confirmed. ` +
      `We're preparing it for fulfillment.\n\n— SWD`,
  });
}

export async function notifyShipped(order: OrderLike, trackingNumber?: string | null, carrier?: string | null) {
  if (!order.email && !order.phone) return;
  await dispatch({
    to: order.email ?? "",
    toPhone: order.phone ?? undefined,
    subject: `Your SWD order ${order.orderNumber} has shipped`,
    text:
      `Hi ${order.fullName ?? "there"},\n\nOrder ${order.orderNumber} is on its way` +
      (trackingNumber ? ` — tracking: ${trackingNumber}${carrier ? ` (${carrier})` : ""}.` : ".") +
      `\n\n— SWD`,
  });
}

export async function notifyDelivered(order: OrderLike) {
  if (!order.email && !order.phone) return;
  await dispatch({
    to: order.email ?? "",
    toPhone: order.phone ?? undefined,
    subject: `SWD order ${order.orderNumber} delivered`,
    text: `Hi ${order.fullName ?? "there"},\n\nOrder ${order.orderNumber} has been delivered. Thanks for shopping with SWD.\n\n— SWD`,
  });
}
