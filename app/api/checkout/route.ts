// POST /api/checkout
// Recomputes pricing server-side from the database (never trusts cart
// prices sent by the client), creates the customer/order/order-items/
// payment rows, then asks the configured payment provider to initiate a
// hosted checkout session and returns the URL to redirect the browser to.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { customers, orderItems, orders, payments, productVariants, products, trackingEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nextOrderNumber } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyOrderReceived } from "@/lib/notifications";
import { computeUnitPrice, sumCart } from "@/lib/checkout-pricing";
import { computeDiscount, getValidCoupon } from "@/lib/coupons";

type CheckoutBody = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  deliveryInstructions?: string;
  couponCode?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`checkout:${ip}`, 20, 10 * 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.fullName || !body.email || !body.phone || !body.address || !body.items?.length) {
    return NextResponse.json({ error: "Missing required checkout fields" }, { status: 400 });
  }

  // Re-price every line item from the database.
  const resolvedItems: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    unitSupplierCost: number;
    customerShipping: number;
  }[] = [];

  for (const item of body.items) {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!product || product.status !== "published") {
      return NextResponse.json({ error: `Product unavailable: ${item.productId}` }, { status: 400 });
    }
    if (product.stockStatus === "out_of_stock") {
      return NextResponse.json({ error: `Out of stock: ${product.title}` }, { status: 409 });
    }

    let priceDelta = 0;
    if (item.variantId) {
      const [variant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      if (!variant) {
        return NextResponse.json({ error: "Invalid product variant" }, { status: 400 });
      }
      priceDelta = variant.priceDelta;
    }

    const unitPrice = computeUnitPrice(product.sellingPrice, priceDelta);
    resolvedItems.push({
      productId: product.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      unitSupplierCost: product.supplierCost,
      customerShipping: product.customerShipping,
    });
  }

  const { subtotal, shippingTotal, total: preDiscountTotal } = sumCart(resolvedItems);

  let discountTotal = 0;
  if (body.couponCode) {
    const coupon = await getValidCoupon(body.couponCode);
    if (!coupon) {
      return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 400 });
    }
    discountTotal = computeDiscount(coupon, subtotal);
  }
  const total = Math.max(0, preDiscountTotal - discountTotal);

  // Find or create the customer record.
  let [customer] = await db.select().from(customers).where(eq(customers.email, body.email)).limit(1);
  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({ fullName: body.fullName, email: body.email, phone: body.phone })
      .returning();
  }

  const orderNumber = await nextOrderNumber();

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerId: customer.id,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      country: body.country,
      city: body.city,
      address: body.address,
      deliveryInstructions: body.deliveryInstructions,
      status: "PAYMENT_PENDING",
      subtotal,
      shippingTotal,
      discountTotal,
      total,
      currency: "USD",
    })
    .returning();

  for (const item of resolvedItems) {
    const { customerShipping, ...orderItemFields } = item;
    void customerShipping; // used only for the sumCart() totals above
    await db.insert(orderItems).values({ orderId: order.id, ...orderItemFields });
  }

  await db.insert(trackingEvents).values({ orderId: order.id, status: "order_received" });
  await notifyOrderReceived(order, resolvedItems);

  const txRef = `${orderNumber}-${Date.now()}`;
  await db.insert(payments).values({
    orderId: order.id,
    provider: "flutterwave",
    txRef,
    status: "initiated",
    amount: total,
    currency: "USD",
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

  try {
    const provider = getPaymentProvider("flutterwave");
    const { checkoutUrl } = await provider.initiate({
      txRef,
      amount: total,
      currency: "USD",
      customerEmail: body.email,
      customerName: body.fullName,
      customerPhone: body.phone,
      redirectUrl: `${siteUrl}/order/${orderNumber}`,
      meta: { orderNumber },
    });

    return NextResponse.json({ orderNumber, checkoutUrl });
  } catch (err) {
    // Payment initiation failed (e.g. gateway credentials not configured
    // yet) — the order still exists as PAYMENT_PENDING so it can be
    // retried, but we surface the error clearly rather than pretending
    // checkout succeeded.
    return NextResponse.json(
      {
        orderNumber,
        error:
          err instanceof Error
            ? err.message
            : "Payment provider is not configured yet.",
      },
      { status: 502 },
    );
  }
}
