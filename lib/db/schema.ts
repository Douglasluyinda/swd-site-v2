import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// 1. ADMINS
// Doubles as the SWD Business OS employee/staff table (not duplicated —
// per the Business OS build rule "reuse existing entities"). `role` is the
// pre-existing storefront-admin label (kept for backward compatibility);
// `staffRole` is the separate Business OS RBAC role (OWNER/MANAGER/
// CASHIER/TECHNICIAN) checked by lib/rbac.ts for POS/inventory/repair/cash
// module access. `active` lets a deactivated employee's session keep
// failing auth even if their cookie hasn't expired yet.
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("admin"),
  employeeNumber: text("employee_number"),
  staffRole: text("staff_role").default("OWNER").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 1b. AUDIT LOGS — append-only record of sensitive Business OS actions
// (role changes, staff activation/deactivation, and, as later modules are
// built, discounts, refunds, stock adjustments, cash corrections). Never
// updated or deleted from application code.
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => admins.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. RATE LIMITS
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStart: timestamp("window_start"),
  resetAt: timestamp("reset_at"),
});

// 3. CATEGORIES
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. SUPPLIERS
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contact: text("contact"),
  phone: text("phone"),
  country: text("country"),
  website: text("website"),
  type: text("type").default("DSERS").notNull(),
  apiCapable: boolean("api_capable").default(false),
  blindDropshipping: boolean("blind_dropshipping").default(false),
  processingTimeDays: integer("processing_time_days"),
  shippingOptions: text("shipping_options"),
  returnPolicy: text("return_policy"),
  reliabilityScore: numeric("reliability_score", { precision: 3, scale: 2, mode: "number" }),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. PRODUCTS
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  slug: text("slug"),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2, mode: "number" }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2, mode: "number" }),
  currency: text("currency").default("UGX"),
  stock: integer("stock").default(0).notNull(),
  stockStatus: text("stock_status"),
  status: text("status").default("draft").notNull(),
  images: text("images"),
  videos: text("videos"),
  supplierSku: text("supplier_sku"),
  supplierCost: numeric("supplier_cost", { precision: 10, scale: 2, mode: "number" }),
  supplierShipping: numeric("supplier_shipping", { precision: 10, scale: 2, mode: "number" }),
  supplierStock: integer("supplier_stock"),
  supplierUrl: text("supplier_url"),
  processingTimeDays: integer("processing_time_days"),
  deliveryEstimateDays: text("delivery_estimate_days"),
  customerShipping: numeric("customer_shipping", { precision: 10, scale: 2, mode: "number" }),
  isDemo: boolean("is_demo").default(false),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),

  // DSers Mapping Columns
  dsersSku: text("dsers_sku"),
  dsersProductId: text("dsers_product_id"),
  supplierType: text("supplier_type").default("DSERS"),

  // Brand + fulfilment mode. `brand` is free text (not a separate table —
  // SWD currently carries one brand, Oraimo; normalize later if that grows).
  // `fulfillmentType` distinguishes SWD-owned inventory (sold and shipped
  // through SWD's own checkout/fulfillment, the default) from an affiliate
  // listing (an outbound link to a verified affiliate program — never
  // processed as SWD stock or added to SWD's own cart/checkout).
  brand: text("brand"),
  fulfillmentType: text("fulfillment_type").default("inventory").notNull(),
  affiliateUrl: text("affiliate_url"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 6. PRODUCT VARIANTS
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  title: text("title"),
  name: text("name"),
  sku: text("sku").notNull(),
  dsersVariantId: text("dsers_variant_id"),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }),
  priceDelta: numeric("price_delta", { precision: 10, scale: 2, mode: "number" }).default(0),
  stock: integer("stock").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// 7. PRODUCT IMAGES
export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. CUSTOMERS
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. ORDERS
// Order lifecycle lives in `status` (see STATUS values below). `paymentStatus`
// / `fulfillmentStatus` are kept as simpler derived flags for integrations
// (e.g. the DSers webhook) that only care about "paid or not" / "fulfilled
// or not" rather than the full lifecycle.
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),

  // Customer-entered checkout details, snapshotted at order time so a later
  // change to the customer record never rewrites history on past orders.
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  city: text("city"),
  address: text("address"),
  deliveryInstructions: text("delivery_instructions"),

  // Order lifecycle. One of: NEW, PAYMENT_PENDING, PAID,
  // SUPPLIER_ORDER_PENDING, SUPPLIER_ORDERED, PROCESSING, SHIPPED,
  // IN_TRANSIT, DELIVERED, CANCELLED, REFUND_PENDING, REFUNDED,
  // FULFILLMENT_DELAYED, OUT_OF_STOCK.
  status: text("status").default("NEW").notNull(),

  subtotal: numeric("subtotal", { precision: 10, scale: 2, mode: "number" }),
  shippingTotal: numeric("shipping_total", { precision: 10, scale: 2, mode: "number" }),
  discountTotal: numeric("discount_total", { precision: 10, scale: 2, mode: "number" }),
  total: numeric("total", { precision: 10, scale: 2, mode: "number" }),

  totalAmount: numeric("total_amount", { precision: 10, scale: 2, mode: "number" }),
  currency: text("currency").default("UGX").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  fulfillmentStatus: text("fulfillment_status").default("unfulfilled"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 9b. ORDER COUNTERS — atomic per-year sequence used to mint order numbers
// (SWD-<year>-<seq>) via INSERT ... ON CONFLICT DO UPDATE, so concurrent
// checkouts can never collide on the same number.
export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  seq: integer("seq").default(0).notNull(),
});

// 10. ORDER ITEMS
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  unitSupplierCost: numeric("unit_supplier_cost", { precision: 10, scale: 2, mode: "number" }),
  dsersSku: text("dsers_sku"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. PAYMENTS
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  provider: text("provider").default("flutterwave").notNull(),
  transactionToken: text("transaction_token"),
  reference: text("reference"),
  txRef: text("tx_ref").unique(),
  providerTxId: text("provider_tx_id"),
  amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
  feeAmount: numeric("fee_amount", { precision: 10, scale: 2, mode: "number" }),
  currency: text("currency").default("UGX").notNull(),
  status: text("status").default("pending").notNull(),
  rawResponse: text("raw_response"),
  rawPayload: text("raw_payload"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. FULFILLMENT
export const fulfillments = pgTable("fulfillments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  carrier: text("carrier"),
  status: text("status").default("pending").notNull(),
  supplierOrderRef: text("supplier_order_ref"),
  supplierCost: numeric("supplier_cost", { precision: 10, scale: 2, mode: "number" }),
  dsersOrderId: text("dsers_order_id"),
  shippedAt: timestamp("shipped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 12b. TRACKING EVENTS — append-only timeline shown on the order detail
// page and the customer-facing order status page.
export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

// 13. COUPONS
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2, mode: "number" }),
  percentOff: numeric("percent_off", { precision: 5, scale: 2, mode: "number" }),
  amountOff: numeric("amount_off", { precision: 10, scale: 2, mode: "number" }),
  active: boolean("active").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. SHIPPING RATES
export const shippingRates = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  region: text("region").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2, mode: "number" }).notNull(),
  estimatedDays: text("estimated_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. MARKETING CAMPAIGNS
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 16. SETTINGS
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});