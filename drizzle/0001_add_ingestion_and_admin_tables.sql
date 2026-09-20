CREATE TABLE "app_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approved_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "approved_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "opportunity_provenance" (
	"opportunity_id" text PRIMARY KEY NOT NULL,
	"original_official_url" text NOT NULL,
	"normalized_official_url" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text,
	"ingestion_run_id" text,
	"captured_at" text NOT NULL,
	CONSTRAINT "opportunity_provenance_normalized_official_url_unique" UNIQUE("normalized_official_url")
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_approved_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."approved_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_provenance" ADD CONSTRAINT "opportunity_provenance_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_provenance" ADD CONSTRAINT "opportunity_provenance_source_id_approved_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."approved_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_provenance" ADD CONSTRAINT "opportunity_provenance_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE no action ON UPDATE no action;