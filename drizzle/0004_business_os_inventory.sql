CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_product_location_uq" UNIQUE("product_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"movement_type" text NOT NULL,
	"quantity_change" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"unit_cost" numeric(12, 2),
	"currency" text DEFAULT 'UGX' NOT NULL,
	"reference" text,
	"note" text,
	"employee_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "employee_number" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "staff_role" text DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reorder_level" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_admins_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Ledger immutability: movements can be inserted, never changed or removed.
CREATE FUNCTION "inventory_movements_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "inventory_movements_no_update_delete"
  BEFORE UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION "inventory_movements_immutable"();
--> statement-breakpoint
-- Opening balances: existing products.stock becomes ledger entries at the
-- default location, so the ledger reconciles with current stock from day one.
INSERT INTO "inventory_locations" ("name") VALUES ('Main shop') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "inventory_balances" ("product_id","location_id","quantity")
  SELECT p."id", l."id", p."stock" FROM "products" p, "inventory_locations" l
  WHERE l."name" = 'Main shop' AND p."stock" > 0 AND p."fulfillment_type" = 'inventory';
--> statement-breakpoint
INSERT INTO "inventory_movements" ("product_id","location_id","movement_type","quantity_change","balance_after","reference","note")
  SELECT p."id", l."id", 'ADJUSTMENT_IN', p."stock", p."stock", 'OPENING_BALANCE', 'Opening balance from products.stock at ledger introduction'
  FROM "products" p, "inventory_locations" l
  WHERE l."name" = 'Main shop' AND p."stock" > 0 AND p."fulfillment_type" = 'inventory';
