CREATE TABLE "offline_sync_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"employee_id" integer NOT NULL,
	"terminal_id" text,
	"reason" text NOT NULL,
	"payload" text NOT NULL,
	"occurred_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE "pos_terminals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"registered_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deactivated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "offline_terminal_id" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "offline_sync_failures" ADD CONSTRAINT "offline_sync_failures_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_failures" ADD CONSTRAINT "offline_sync_failures_resolved_by_admins_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminals" ADD CONSTRAINT "pos_terminals_registered_by_admins_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_one_active_terminal" ON "pos_terminals" USING btree ("active") WHERE "pos_terminals"."active" = true;