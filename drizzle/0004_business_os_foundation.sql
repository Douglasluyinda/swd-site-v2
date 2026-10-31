-- SWD Business OS — Phase 1 (Foundation): staff roles, activation, audit log.
-- Purely additive: three nullable/defaulted columns on the existing
-- `admins` table (no existing column touched or renamed) plus one new
-- append-only table. Every existing admin backfills to staff_role='OWNER',
-- active=true — i.e. unchanged effective access until an owner deliberately
-- assigns a narrower role via /admin/business-os/staff.

ALTER TABLE "admins" ADD COLUMN "employee_number" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "staff_role" text DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint

CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_admins_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;
