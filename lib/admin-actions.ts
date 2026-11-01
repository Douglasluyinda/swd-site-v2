"use server";

import { db } from "@/lib/db/client";
import { fulfillments, orders, trackingEvents, products, suppliers, categories, admins, coupons, shippingRates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyDelivered, notifyShipped } from "@/lib/notifications";
import { getCurrentStaffSession, hashPassword } from "@/lib/admin-auth";
import { uploadProductImage } from "@/lib/blob";
import { validateProductFulfillment } from "@/lib/product-fulfillment";
import { hasPermission, isValidStaffRole } from "@/lib/rbac";
import { recordAuditEvent } from "@/lib/audit";
import { createSale, refundSale } from "@/lib/sales";
import { applyStockMovement } from "@/lib/inventory";
import { MANUAL_MOVEMENT_TYPES, isMovementType } from "@/lib/inventory-ledger";

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

// --- SWD Business OS: staff management -------------------------------
// Every mutation here is gated server-side by `staff.manage` (never just a
// hidden button) and recorded to the append-only audit log, per the
// Business OS spec's "role assignment changes are themselves audited" and
// "server-side RBAC, default deny" rules.

async function requireStaffManage() {
  const session = await getCurrentStaffSession();
  if (!session) throw new Error("Not signed in.");
  if (!hasPermission(session.staffRole, "staff.manage")) {
    throw new Error("You do not have permission to manage staff.");
  }
  return session;
}

export async function createStaffAccount(formData: FormData) {
  const session = await requireStaffManage();

  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const password = (formData.get("password") as string) || "";
  const employeeNumber = ((formData.get("employeeNumber") as string) || "").trim() || null;
  const staffRole = (formData.get("staffRole") as string) || "";

  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!isValidStaffRole(staffRole)) throw new Error("Invalid role.");

  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (existing) throw new Error("An account with that email already exists.");

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(admins)
    .values({ name, email, passwordHash, employeeNumber, staffRole, active: true })
    .returning({ id: admins.id });

  await recordAuditEvent({
    actorId: Number(session.adminId),
    actorEmail: session.email,
    action: "staff.create",
    entityType: "admin",
    entityId: created.id,
    metadata: { email, staffRole, employeeNumber },
  });

  revalidatePath("/admin/business-os/staff");
}

export async function setStaffRole(staffIdInput: string, staffRole: string) {
  const session = await requireStaffManage();
  const staffId = Number(staffIdInput);
  if (!isValidStaffRole(staffRole)) throw new Error("Invalid role.");

  // An owner can't lock themselves (or the only owner) out by accident —
  // require at least one other active OWNER before demoting this one.
  const [target] = await db.select().from(admins).where(eq(admins.id, staffId)).limit(1);
  if (!target) throw new Error("Employee not found.");
  if (target.staffRole === "OWNER" && staffRole !== "OWNER") {
    const owners = await db.select({ id: admins.id }).from(admins).where(eq(admins.staffRole, "OWNER"));
    const otherActiveOwners = owners.filter((o) => o.id !== staffId);
    if (otherActiveOwners.length === 0) {
      throw new Error("At least one Owner account must remain.");
    }
  }

  await db.update(admins).set({ staffRole }).where(eq(admins.id, staffId));

  await recordAuditEvent({
    actorId: Number(session.adminId),
    actorEmail: session.email,
    action: "staff.role_changed",
    entityType: "admin",
    entityId: staffId,
    metadata: { from: target.staffRole, to: staffRole },
  });

  revalidatePath("/admin/business-os/staff");
}

export async function setStaffActive(staffIdInput: string, active: boolean) {
  const session = await requireStaffManage();
  const staffId = Number(staffIdInput);

  if (!active && staffId === Number(session.adminId)) {
    throw new Error("You cannot deactivate your own account.");
  }

  const [target] = await db.select().from(admins).where(eq(admins.id, staffId)).limit(1);
  if (!target) throw new Error("Employee not found.");

  await db.update(admins).set({ active }).where(eq(admins.id, staffId));

  await recordAuditEvent({
    actorId: Number(session.adminId),
    actorEmail: session.email,
    action: active ? "staff.reactivated" : "staff.deactivated",
    entityType: "admin",
    entityId: staffId,
  });

  revalidatePath("/admin/business-os/staff");
}

// --- SWD Business OS: inventory ---------------------------------------

export async function recordStockMovement(formData: FormData) {
  const session = await getCurrentStaffSession();
  if (!session) throw new Error("Not signed in.");
  if (!hasPermission(session.staffRole, "inventory.manage")) {
    throw new Error("You do not have permission to change stock.");
  }

  const productId = Number(formData.get("productId"));
  const type = (formData.get("movementType") as string) || "";
  const quantity = Number(formData.get("quantity"));
  const unitCostRaw = ((formData.get("unitCost") as string) || "").trim();
  const reference = ((formData.get("reference") as string) || "").trim() || null;
  const note = ((formData.get("note") as string) || "").trim() || null;

  if (!Number.isInteger(productId) || productId <= 0) throw new Error("Choose a product.");
  if (!isMovementType(type) || !MANUAL_MOVEMENT_TYPES.includes(type)) {
    throw new Error("Invalid movement type.");
  }
  const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    throw new Error("Unit cost must be a non-negative number.");
  }

  const { balanceAfter } = await applyStockMovement({
    productId,
    type,
    quantity,
    unitCost,
    reference,
    note,
    employeeId: Number(session.adminId),
  });

  // Stock changes are audit-relevant per the Business OS spec.
  await recordAuditEvent({
    actorId: Number(session.adminId),
    actorEmail: session.email,
    action: "inventory.movement",
    entityType: "product",
    entityId: productId,
    metadata: { type, quantity, balanceAfter, reference, note },
  });

  revalidatePath("/admin/business-os/inventory");
}

// --- SWD Business OS: POS -----------------------------------------------

export async function completeSale(payload: {
  idempotencyKey: string;
  lines: { productId: number; quantity: number }[];
  discountPercent: number;
  tendered: number;
  customerName?: string;
  customerPhone?: string;
}): Promise<{ ok: true; receiptNumber: string } | { ok: false; error: string }> {
  const session = await getCurrentStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!hasPermission(session.staffRole, "pos.sell")) {
    return { ok: false, error: "You do not have permission to make sales." };
  }
  try {
    const r = await createSale({
      ...payload,
      employeeId: Number(session.adminId),
      role: session.staffRole,
    });
    if (!r.duplicate) {
      await recordAuditEvent({
        actorId: Number(session.adminId),
        actorEmail: session.email,
        action: "pos.sale",
        entityType: "sale",
        entityId: r.receiptNumber,
        metadata: { discountPercent: payload.discountPercent, lines: payload.lines.length },
      });
    }
    revalidatePath("/admin/business-os/inventory");
    return { ok: true, receiptNumber: r.receiptNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sale failed." };
  }
}

export async function processReturn(formData: FormData) {
  const session = await getCurrentStaffSession();
  if (!session) throw new Error("Not signed in.");
  if (!hasPermission(session.staffRole, "pos.refund")) {
    throw new Error("Only a manager or owner can process returns and refunds.");
  }
  const receiptNumber = (formData.get("receiptNumber") as string) || "";
  const reason = (formData.get("reason") as string) || "";
  const quantities: Record<number, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("qty_")) quantities[Number(k.slice(4))] = Number(v) || 0;
  }
  const { refundTotal } = await refundSale({
    receiptNumber,
    employeeId: Number(session.adminId),
    reason,
    quantities,
  });
  await recordAuditEvent({
    actorId: Number(session.adminId),
    actorEmail: session.email,
    action: "pos.refund",
    entityType: "sale",
    entityId: receiptNumber,
    metadata: { refundTotal, reason },
  });
  revalidatePath(`/admin/business-os/pos/receipt/${receiptNumber}`);
}
