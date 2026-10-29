ALTER TABLE "product_variants" ALTER COLUMN "price_delta" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fulfillment_type" text DEFAULT 'inventory' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "affiliate_url" text;