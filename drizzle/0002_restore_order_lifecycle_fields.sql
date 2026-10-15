CREATE TABLE "order_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "discount_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "discount_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'flutterwave';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "percent_off" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "amount_off" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "supplier_order_ref" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "supplier_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_supplier_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_instructions" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" text DEFAULT 'NEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_total" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_total" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tx_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_tx_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "raw_payload" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "price_delta" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tx_ref_unique" UNIQUE("tx_ref");