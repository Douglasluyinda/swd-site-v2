CREATE TABLE "repair_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"employee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2),
	"employee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text DEFAULT 'CASH' NOT NULL,
	"cash_session_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repair_payments_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "repair_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"device_type" text NOT NULL,
	"brand" text,
	"model" text,
	"imei" text,
	"issue" text NOT NULL,
	"intake_notes" text,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"technician_id" integer,
	"diagnosis" text,
	"quote_amount" numeric(12, 2),
	"quoted_at" timestamp,
	"approved_by" integer,
	"approved_at" timestamp,
	"approval_note" text,
	"external_technician" text,
	"external_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"qc_by" integer,
	"qc_at" timestamp,
	"collected_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repair_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
ALTER TABLE "repair_events" ADD CONSTRAINT "repair_events_ticket_id_repair_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."repair_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_events" ADD CONSTRAINT "repair_events_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_ticket_id_repair_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."repair_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_payments" ADD CONSTRAINT "repair_payments_ticket_id_repair_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."repair_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_payments" ADD CONSTRAINT "repair_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_payments" ADD CONSTRAINT "repair_payments_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_technician_id_admins_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_qc_by_admins_id_fk" FOREIGN KEY ("qc_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Repair history and payments are append-only. (drizzle-kit push does not
-- create triggers: run this block by hand after a push.)
CREATE FUNCTION "repair_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "repair_events_no_update_delete" BEFORE UPDATE OR DELETE ON "repair_events"
  FOR EACH ROW EXECUTE FUNCTION "repair_append_only"();
--> statement-breakpoint
CREATE TRIGGER "repair_payments_no_update_delete" BEFORE UPDATE OR DELETE ON "repair_payments"
  FOR EACH ROW EXECUTE FUNCTION "repair_append_only"();
