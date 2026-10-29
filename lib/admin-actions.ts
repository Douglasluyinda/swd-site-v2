"use server";

import { db } from "@/lib/db/client";
import { fulfillments, orders, trackingEvents, products, suppliers, categories, admins, coupons, shippingRates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyDelivered, notifyShipped } from "@/lib/notifications";
import { hashPassword } from "@/lib/admin-auth";
import { uploadProductImage } from "@/lib/blob";
import { validateProductFulfillment } from "@/lib/product-fulfillment";

const trackingStatusByOrderStatus: Record<string, string | undefined> = {
  SUPPLIER_ORDER_PENDING: "supplier_processing",
  SUPPLIER_ORDERED: "supplier_processing",
  PROCESSING: "supplier_processing",
  SHIPPED: "shipped",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
};

export async function updateOrderStatus(orderIdInput: string, status: string) {
  const orderId = Number(orderIdInput);
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

export async function sendToSupplier(orderIdInput: string, supplierOrderRef: string, supplierCost: number) {
  const orderId = Number(orderIdInput);
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
  orderIdInput: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl: string,
) {
  const orderId = Number(orderIdInput);
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

export async function toggleProductStatus(productIdInput: string, status: string) {
  const productId = Number(productIdInput);
  await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, productId));
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function createProduct(formData: FormData) {
  const title = formData.get("title") as string;
  const slug = (formData.get("slug") as string) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const categoryIdRaw = formData.get("categoryId") as string;
  const supplierIdRaw = formData.get("supplierId") as string;
  const brand = ((formData.get("brand") as string) || "").trim() || null;
  const fulfillmentType = (formData.get("fulfillmentType") as string) === "affiliate" ? "affiliate" : "inventory";
  const affiliateUrl = ((formData.get("affiliateUrl") as string) || "").trim() || null;

  const fulfillmentError = validateProductFulfillment({
    fulfillmentType,
    affiliateUrl,
    supplierId: supplierIdRaw ? Number(supplierIdRaw) : null,
  });
  if (fulfillmentError) throw new Error(fulfillmentError);

  // Prefer an uploaded photo (stored in Vercel Blob) over a pasted URL;
  // fall back to the placeholder only if neither is given.
  const imageFile = formData.get("imageFile");
  const imageUrlInput = (formData.get("image") as string) ?? "";
  let imageUrl = imageUrlInput || "/demo/portable-blender-1.svg";
  if (imageFile instanceof File && imageFile.size > 0) {
    imageUrl = await uploadProductImage(imageFile);
  }

  await db.insert(products).values({
    sku: formData.get("sku") as string,
    title,
    slug,
    description: formData.get("description") as string,
    categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
    images: JSON.stringify([imageUrl]),
    brand,
    fulfillmentType,
    affiliateUrl,
    supplierId: supplierIdRaw ? Number(supplierIdRaw) : null,
    supplierSku: (formData.get("supplierSku") as string) || null,
    supplierCost: parseFloat(formData.get("supplierCost") as string) || null,
    supplierShipping: parseFloat(formData.get("supplierShipping") as string) || null,
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

export async function toggleCouponActive(couponIdInput: string, active: boolean) {
  const couponId = Number(couponIdInput);
  await db.update(coupons).set({ active }).where(eq(coupons.id, couponId));
  revalidatePath("/admin/coupons");
}

// Region names are matched case-insensitively against the customer's
// entered city, then country, at checkout (lib/delivery.ts) — "Entebbe"
// matches an order with city "Entebbe", "Uganda" matches any order in
// Uganda whose city has no more specific rate configured.
export async function createShippingRate(formData: FormData) {
  const region = ((formData.get("region") as string) || "").trim();
  const costRaw = formData.get("cost") as string;
  const estimatedDays = ((formData.get("estimatedDays") as string) || "").trim() || null;

  if (!region) throw new Error("Region is required.");
  const cost = parseFloat(costRaw);
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Cost must be a non-negative number.");

  await db.insert(shippingRates).values({ region, cost, estimatedDays });
  revalidatePath("/admin/shipping");
}

export async function deleteShippingRate(rateIdInput: string) {
  const rateId = Number(rateIdInput);
  await db.delete(shippingRates).where(eq(shippingRates.id, rateId));
  revalidatePath("/admin/shipping");
}
