CREATE TABLE "sop_acknowledgements" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sop_ack_version_employee_uq" UNIQUE("version_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "sop_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"sop_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_role" text NOT NULL,
	"applicable_roles" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sop_documents_sop_id_unique" UNIQUE("sop_id")
);
--> statement-breakpoint
CREATE TABLE "sop_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"purpose" text,
	"scope" text,
	"body" text DEFAULT '' NOT NULL,
	"exceptions" text,
	"escalation" text,
	"records" text,
	"change_note" text,
	"effective_date" text,
	"review_date" text,
	"authored_by" integer,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sop_versions_doc_version_uq" UNIQUE("document_id","version")
);
--> statement-breakpoint
ALTER TABLE "sop_acknowledgements" ADD CONSTRAINT "sop_acknowledgements_version_id_sop_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."sop_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_acknowledgements" ADD CONSTRAINT "sop_acknowledgements_employee_id_admins_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_document_id_sop_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."sop_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_authored_by_admins_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sop_one_approved_per_doc" ON "sop_versions" USING btree ("document_id") WHERE "sop_versions"."status" = 'APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "sop_one_draft_per_doc" ON "sop_versions" USING btree ("document_id") WHERE "sop_versions"."status" = 'DRAFT';--> statement-breakpoint
-- Acknowledgements are an audit record: insert-only. (drizzle-kit push does not
-- create triggers: run this block by hand after a push. Reuses repair_append_only
-- from migration 0008.)
CREATE TRIGGER "sop_acknowledgements_no_update_delete" BEFORE UPDATE OR DELETE ON "sop_acknowledgements"
  FOR EACH ROW EXECUTE FUNCTION "repair_append_only"();
