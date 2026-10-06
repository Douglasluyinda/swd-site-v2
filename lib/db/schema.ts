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
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("admin"),
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
  reliabilityScore: numeric("reliability_score", { precision: 3, scale: 2 }),
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
  price: numeric("price", { precision: 10, scale: 2 }),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  currency: text("currency").default("UGX"),
  stock: integer("stock").default(0).notNull(),
  stockStatus: text("stock_status"),
  status: text("status").default("draft").notNull(),
  images: text("images"),
  videos: text("videos"),
  supplierSku: text("supplier_sku"),
  supplierCost: numeric("supplier_cost", { precision: 10, scale: 2 }),
  supplierShipping: numeric("supplier_shipping", { precision: 10, scale: 2 }),
  supplierStock: integer("supplier_stock"),
  supplierUrl: text("supplier_url"),
  processingTimeDays: integer("processing_time_days"),
  deliveryEstimateDays: text("delivery_estimate_days"),
  customerShipping: numeric("customer_shipping", { precision: 10, scale: 2 }),
  isDemo: boolean("is_demo").default(false),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),

  // DSers Mapping Columns
  dsersSku: text("dsers_sku"),
  dsersProductId: text("dsers_product_id"),
  supplierType: text("supplier_type").default("DSERS"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 6. PRODUCT VARIANTS
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  title: text("title"),
  sku: text("sku").notNull(),
  dsersVariantId: text("dsers_variant_id"),
  price: numeric("price", { precision: 10, scale: 2 }),
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
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. ORDERS
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("UGX").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  fulfillmentStatus: text("fulfillment_status").default("unfulfilled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. ORDER ITEMS
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  dsersSku: text("dsers_sku"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. PAYMENTS
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  provider: text("provider").default("DPO").notNull(),
  transactionToken: text("transaction_token"),
  reference: text("reference").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("UGX").notNull(),
  status: text("status").default("pending").notNull(),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. FULFILLMENT
export const fulfillments = pgTable("fulfillments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  status: text("status").default("pending").notNull(),
  dsersOrderId: text("dsers_order_id"),
  shippedAt: timestamp("shipped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. COUPONS
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. SHIPPING RATES
export const shippingRates = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  region: text("region").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
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