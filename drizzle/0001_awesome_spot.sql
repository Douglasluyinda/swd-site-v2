CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"alt_text" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"cost" numeric(10, 2) NOT NULL,
	"estimated_days" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_counters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracking_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE "order_counters" CASCADE;--> statement-breakpoint
DROP TABLE "tracking_events" CASCADE;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_tx_ref_unique";--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_sku_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_slug_unique";--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "order_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "order_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "variant_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'UGX';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "order_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'DPO';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'UGX';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "product_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "stock" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "images" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_sku" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_cost" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_shipping" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_shipping" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_stock" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "supplier_stock" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "processing_time_days" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "processing_time_days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "delivery_estimate_days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "selling_price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "selling_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'UGX';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "customer_shipping" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "customer_shipping" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "customer_shipping" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stock_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stock_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "is_demo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "window_start" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "window_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "api_capable" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "blind_dropshipping" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "processing_time_days" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "processing_time_days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "reliability_score" SET DATA TYPE numeric(3, 2);--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "reliability_score" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "reliability_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "created_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "discount_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "discount_value" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "dsers_order_id" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "shipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "dsers_sku" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" text DEFAULT 'unfulfilled';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transaction_token" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reference" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "raw_response" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "dsers_variant_id" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "dsers_sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "dsers_product_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_type" text DEFAULT 'DSERS';--> statement-breakpoint
ALTER TABLE "rate_limits" ADD COLUMN "reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "type" text DEFAULT 'DSERS' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "percent_off";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "amount_off";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "active";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "fulfillments" DROP COLUMN "supplier_order_ref";--> statement-breakpoint
ALTER TABLE "fulfillments" DROP COLUMN "supplier_cost";--> statement-breakpoint
ALTER TABLE "fulfillments" DROP COLUMN "tracking_url";--> statement-breakpoint
ALTER TABLE "fulfillments" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "unit_supplier_cost";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_instructions";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "subtotal";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "shipping_total";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "discount_total";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "total";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "tx_ref";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "provider_tx_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "fee_amount";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "verified_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "raw_payload";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "price_delta";