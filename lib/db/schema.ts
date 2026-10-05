// SWD commerce platform — Drizzle schema (PostgreSQL).
//
// Local dev connects to a local Postgres instance; production points
// DATABASE_URL at a managed Postgres (Neon, Supabase, Vercel Postgres,
// etc.) — no code change needed, just the connection string. See
// DELIVERY.md for setup instructions.

import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const customers = pgTable("customers", {
  id: id(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  createdAt: timestamps.createdAt,
});

export const admins = pgTable("admins", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("admin"), // admin | staff
  createdAt: timestamps.createdAt,
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const suppliers = pgTable("suppliers", {
  id: id(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  contact: text("contact"),
  website: text("website"),
  apiCapable: boolean("api_capable").notNull().default(false),
  blindDropshipping: boolean("blind_dropshipping").notNull().default(false),
  processingTimeDays: integer("processing_time_days").notNull().default(3),
  shippingOptions: text("shipping_options"), // JSON string
  returnPolicy: text("return_policy"),
  reliabilityScore: integer("reliability_score").notNull().default(3), // 1-5
  status: text("status").notNull().default("active"), // active | paused | removed
  createdAt: timestamps.createdAt,
});

export const products = pgTable("products", {
  id: id(),
  sku: text("sku").notNull().unique(), // SWD SKU
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  images: text("images").notNull(), // JSON array of URLs
  videos: text("videos"), // JSON array of URLs

  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  supplierSku: text("supplier_sku").notNull(),
  supplierCost: real("supplier_cost").notNull(), // per unit
  supplierShipping: real("supplier_shipping").notNull(), // per order
  supplierStock: integer("supplier_stock").notNull().default(0),
  supplierUrl: text("supplier_url"),
  processingTimeDays: integer("processing_time_days").notNull().default(3),
  deliveryEstimateDays: text("delivery_estimate_days").notNull(), // e.g. "7-14"

  sellingPrice: real("selling_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  customerShipping: real("customer_shipping").notNull().default(0),

  stockStatus: text("stock_status").notNull().default("in_stock"), // in_stock | low_stock | out_of_stock
  status: text("status").notNull().default("draft"), // draft | published | archived
  isDemo: boolean("is_demo").notNull().default(false),

  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const productVariants = pgTable("product_variants", {
  id: id(),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(), // e.g. "Color: Black"
  sku: text("sku").notNull().unique(),
  priceDelta: real("price_delta").notNull().default(0),
  stock: integer("stock").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull().unique(), // SWD-2026-000001

  customerId: uuid("customer_id").notNull().references(() => customers.id),

  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  deliveryInstructions: text("delivery_instructions"),

  // NEW | PAYMENT_PENDING | PAID | SUPPLIER_ORDER_PENDING | SUPPLIER_ORDERED
  // PROCESSING | SHIPPED | IN_TRANSIT | DELIVERED | CANCELLED
  // REFUND_PENDING | REFUNDED | FULFILLMENT_DELAYED | OUT_OF_STOCK
  status: text("status").notNull().default("NEW"),

  subtotal: real("subtotal").notNull(),
  shippingTotal: real("shipping_total").notNull(),
  discountTotal: real("discount_total").notNull().default(0),
  total: real("total").notNull(),
  currency: text("currency").notNull().default("USD"),

  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),

  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(), // snapshot at time of order
  unitSupplierCost: real("unit_supplier_cost").notNull(), // snapshot at time of order
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),

  provider: text("provider").notNull(), // "flutterwave"
  txRef: text("tx_ref").notNull().unique(), // our reference sent to gateway
  providerTxId: text("provider_tx_id"), // gateway's id, filled on verification
  status: text("status").notNull().default("initiated"), // initiated | successful | failed
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  feeAmount: real("fee_amount"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rawPayload: text("raw_payload"), // JSON snapshot, for audit

  createdAt: timestamps.createdAt,
});

// ---------------------------------------------------------------------------
// Fulfillment & shipping
// ---------------------------------------------------------------------------

export const fulfillments = pgTable("fulfillments", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),

  supplierOrderRef: text("supplier_order_ref"),
  supplierCost: real("supplier_cost"),
  status: text("status").notNull().default("pending"), // pending | sent | confirmed | failed
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingUrl: text("tracking_url"),

  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const trackingEvents = pgTable("tracking_events", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),

  status: text("status").notNull(),
  // order_received | payment_confirmed | supplier_processing | shipped |
  // in_transit | out_for_delivery | delivered
  note: text("note"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Marketing / audit (Phase 4 groundwork)
// ---------------------------------------------------------------------------

export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  seq: integer("seq").notNull().default(0),
});

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  percentOff: integer("percent_off"),
  amountOff: real("amount_off"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actor: text("actor").notNull(), // admin email or "system"
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"), // JSON
  createdAt: timestamps.createdAt,
});

// ---------------------------------------------------------------------------
// Rate limiting (fixed-window counters, since Vercel serverless functions
// share no in-memory state across invocations)
// ---------------------------------------------------------------------------

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), // e.g. "checkout:1.2.3.4" or "admin-login:1.2.3.4"
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
});
