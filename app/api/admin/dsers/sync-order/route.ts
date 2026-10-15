// POST /api/admin/dsers/sync-order
//
// Admin-triggered: pushes a paid order's shipping + item details to DSers
// so the supplier side can pick it up for fulfillment. This never touches
// payment — by the time an order can be synced it has already been paid
// through SWD's own Flutterwave checkout (merchant-of-record architecture:
// DSers only ever receives fulfillment data, never a payment instruction).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { fulfillments, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { sendOrderToDsers, type DsersOrderItem } from "@/lib/dsers";

type SyncOrderBody = {
  orderId?: number | string;
};

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyncOrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orderId = Number(body.orderId);
  if (!body.orderId || Number.isNaN(orderId)) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only sync orders SWD has actually been paid for.
  if (order.status === "NEW" || order.status === "PAYMENT_PENDING") {
    return NextResponse.json(
      { error: `Order ${order.orderNumber} has not been paid yet (status: ${order.status})` },
      { status: 409 },
    );
  }

  // Idempotency: don't re-send an order DSers already has a record of.
  const [existingFulfillment] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId))
    .limit(1);
  if (existingFulfillment?.dsersOrderId) {
    return NextResponse.json({
      alreadySynced: true,
      orderNumber: order.orderNumber,
      dsersOrderId: existingFulfillment.dsersOrderId,
    });
  }

  const items = await db
    .select({
      quantity: orderItems.quantity,
      itemDsersSku: orderItems.dsersSku,
      productDsersProductId: products.dsersProductId,
      productDsersSku: products.dsersSku,
      variantDsersVariantId: productVariants.dsersVariantId,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    return NextResponse.json({ error: "Order has no items" }, { status: 400 });
  }

  const unmapped = items.filter((item) => !item.productDsersProductId);
  if (unmapped.length > 0) {
    return NextResponse.json(
      {
        error:
          "One or more products on this order have no dsers_product_id mapping yet — map them in the product admin before syncing.",
      },
      { status: 422 },
    );
  }

  const dsersItems: DsersOrderItem[] = items.map((item) => ({
    dsersProductId: item.productDsersProductId as string,
    dsersVariantId: item.variantDsersVariantId ?? undefined,
    dsersSku: item.itemDsersSku ?? item.productDsersSku ?? undefined,
    quantity: item.quantity,
  }));

  const result = await sendOrderToDsers({
    orderNumber: order.orderNumber,
    shippingAddress: {
      fullName: order.fullName ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
      country: order.country ?? "",
      city: order.city ?? "",
      address: order.address ?? "",
      deliveryInstructions: order.deliveryInstructions ?? undefined,
    },
    items: dsersItems,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "DSers order sync failed", details: result.raw },
      { status: 502 },
    );
  }

  if (existingFulfillment) {
    await db
      .update(fulfillments)
      .set({ dsersOrderId: result.dsersOrderId, status: "sent", updatedAt: new Date() })
      .where(eq(fulfillments.id, existingFulfillment.id));
  } else {
    await db.insert(fulfillments).values({
      orderId,
      dsersOrderId: result.dsersOrderId,
      status: "sent",
    });
  }

  await db
    .update(orders)
    .set({ status: "SUPPLIER_ORDERED", fulfillmentStatus: "processing", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  return NextResponse.json({
    success: true,
    orderNumber: order.orderNumber,
    dsersOrderId: result.dsersOrderId,
  });
}
