// POST /api/webhooks/dsers
//
// DSers calls this when fulfillment status changes on their side (order
// shipped, tracking number assigned, delivered, etc). We verify the shared
// secret header, look up the order by the DSers order id we stored during
// sync-order, upsert tracking details into `fulfillments`, and flip the
// order to fulfilled.
//
// The header name and payload field names here are a reasonable default —
// confirm them against DSers' actual webhook docs for your account/partner
// tier before relying on this in production (see lib/dsers.ts for where to
// adjust them).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { fulfillments, orders, trackingEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { mapDsersStatus, verifyDsersWebhookSignature } from "@/lib/dsers";

type DsersWebhookPayload = {
  dsers_order_id?: string;
  order_id?: string;
  tracking_number?: string;
  carrier?: string;
  tracking_url?: string;
  status?: string;
};

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-dsers-webhook-secret");
  if (!verifyDsersWebhookSignature(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: DsersWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const dsersOrderId = payload.dsers_order_id ?? payload.order_id;
  if (!dsersOrderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const [fulfillment] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.dsersOrderId, dsersOrderId))
    .limit(1);

  if (!fulfillment) {
    // Unknown order on our side — acknowledge so DSers doesn't retry this
    // delivery forever, but don't pretend we processed it.
    return NextResponse.json({ received: true, matched: false });
  }

  const { fulfillmentStatus, orderStatus } = mapDsersStatus(payload.status);
  const nextTrackingNumber = payload.tracking_number ?? fulfillment.trackingNumber;

  // Idempotent: a retried/duplicate webhook delivery that changes nothing
  // is a no-op, so tracking history doesn't accumulate duplicate events.
  const unchanged =
    fulfillment.status === fulfillmentStatus && fulfillment.trackingNumber === nextTrackingNumber;

  if (!unchanged) {
    await db
      .update(fulfillments)
      .set({
        trackingNumber: nextTrackingNumber,
        carrier: payload.carrier ?? fulfillment.carrier,
        trackingUrl: payload.tracking_url ?? fulfillment.trackingUrl,
        status: fulfillmentStatus,
        shippedAt: fulfillment.shippedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, fulfillment.id));

    // Per the DSers integration contract, any webhook update with tracking
    // info marks the order fulfilled; `status` keeps the fuller lifecycle
    // (SHIPPED/DELIVERED/CANCELLED) in sync too.
    await db
      .update(orders)
      .set({ status: orderStatus, fulfillmentStatus: "fulfilled", updatedAt: new Date() })
      .where(eq(orders.id, fulfillment.orderId));

    await db.insert(trackingEvents).values({
      orderId: fulfillment.orderId,
      status: orderStatus === "DELIVERED" ? "delivered" : "shipped",
      note: nextTrackingNumber ? `Tracking: ${nextTrackingNumber}` : undefined,
    });
  }

  return NextResponse.json({ received: true, matched: true });
}
