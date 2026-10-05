"use server";

import { db } from "@/lib/db/client";
import { fulfillments, orders, trackingEvents, products, suppliers, categories, admins, coupons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyDelivered, notifyShipped } from "@/lib/notifications";
import { hashPassword } from "@/lib/admin-auth";

const trackingStatusByOrderStatus: Record<string, string | undefined> = {
  SUPPLIER_ORDER_PENDING: "supplier_processing",
  SUPPLIER_ORDERED: "supplier_processing",
  PROCESSING: "supplier_processing",
  SHIPPED: "shipped",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
};

export async function updateOrderStatus(orderId: string, status: string) {
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));

  const trackingStatus = trackingStatusByOrderStatus[status];
  if (trackingStatus) {
    await db.insert(trackingEvents).values({ orderId, status: trackingStatus });
  }

  if (status === "DELIVERED") {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (order) await notifyDelivered(order);
  }

  revalidatePath("/admin/orders");
}

export async function sendToSupplier(orderId: string, supplierOrderRef: string, supplierCost: number) {
  const [existing] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId))
    .limit(1);

  if (existing) {
    await db
      .update(fulfillments)
      .set({ supplierOrderRef, supplierCost, status: "sent", updatedAt: new Date() })
      .where(eq(fulfillments.id, existing.id));
  } else {
    await db.insert(fulfillments).values({ orderId, supplierOrderRef, supplierCost, status: "sent" });
  }

  await db
    .update(orders)
    .set({ status: "SUPPLIER_ORDERED", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(trackingEvents).values({ orderId, status: "supplier_processing" });

  revalidatePath("/admin/orders");
}

export async function addTrackingInfo(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl: string,
) {
  const [existing] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId))
    .limit(1);

  if (existing) {
    await db
      .update(fulfillments)
      .set({ trackingNumber, carrier, trackingUrl, status: "confirmed", updatedAt: new Date() })
      .where(eq(fulfillments.id, existing.id));
  } else {
    await db
      .insert(fulfillments)
      .values({ orderId, trackingNumber, carrier, trackingUrl, status: "confirmed" });
  }

  await db
    .update(orders)
    .set({ status: "SHIPPED", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(trackingEvents).values({ orderId, status: "shipped" });

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order) await notifyShipped(order, trackingNumber, carrier);

  revalidatePath("/admin/orders");
}

export async function toggleProductStatus(productId: string, status: string) {
  await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, productId));
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function createProduct(formData: FormData) {
  const title = formData.get("title") as string;
  const slug = (formData.get("slug") as string) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  await db.insert(products).values({
    sku: formData.get("sku") as string,
    title,
    slug,
    description: formData.get("description") as string,
    categoryId: formData.get("categoryId") as string,
    images: JSON.stringify([(formData.get("image") as string) || "/demo/portable-blender-1.svg"]),
    supplierId: formData.get("supplierId") as string,
    supplierSku: formData.get("supplierSku") as string,
    supplierCost: parseFloat(formData.get("supplierCost") as string),
    supplierShipping: parseFloat(formData.get("supplierShipping") as string),
    supplierStock: parseInt(formData.get("supplierStock") as string, 10) || 0,
    deliveryEstimateDays: (formData.get("deliveryEstimateDays") as string) || "7-14",
    sellingPrice: parseFloat(formData.get("sellingPrice") as string),
    customerShipping: parseFloat(formData.get("customerShipping") as string) || 0,
    status: "draft",
  });

  revalidatePath("/admin/products");
}

export async function createSupplier(formData: FormData) {
  await db.insert(suppliers).values({
    name: formData.get("name") as string,
    country: formData.get("country") as string,
    contact: formData.get("contact") as string,
    website: formData.get("website") as string,
    processingTimeDays: parseInt(formData.get("processingTimeDays") as string, 10) || 3,
    returnPolicy: formData.get("returnPolicy") as string,
    status: "active",
  });

  revalidatePath("/admin/suppliers");
}

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await db.insert(categories).values({ name, slug });
  revalidatePath("/admin/products");
}

export async function createAdmin(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string) || email;

  if (!email || !password || password.length < 8) {
    throw new Error("Email and an 8+ character password are required.");
  }

  const passwordHash = await hashPassword(password);
  await db.insert(admins).values({ email, passwordHash, name, role: "admin" });
  revalidatePath("/admin/settings");
}

export async function createCoupon(formData: FormData) {
  const code = (formData.get("code") as string).trim().toUpperCase();
  const percentOffRaw = formData.get("percentOff") as string;
  const amountOffRaw = formData.get("amountOff") as string;
  const expiresAtRaw = formData.get("expiresAt") as string;

  if (!code) throw new Error("Coupon code is required.");

  await db.insert(coupons).values({
    code,
    percentOff: percentOffRaw ? parseInt(percentOffRaw, 10) : null,
    amountOff: amountOffRaw ? parseFloat(amountOffRaw) : null,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    active: true,
  });

  revalidatePath("/admin/coupons");
}

export async function toggleCouponActive(couponId: string, active: boolean) {
  await db.update(coupons).set({ active }).where(eq(coupons.id, couponId));
  revalidatePath("/admin/coupons");
}
