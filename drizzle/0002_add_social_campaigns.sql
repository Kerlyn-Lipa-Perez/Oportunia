CREATE TABLE "social_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"platform" text DEFAULT 'tiktok' NOT NULL,
	"code" text NOT NULL,
	"hook" text NOT NULL,
	"script" text NOT NULL,
	"cover_text" text NOT NULL,
	"caption" text NOT NULL,
	"published_url" text,
	"published_at" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewer" text,
	"approved_at" text,
	"failure_reason" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "social_campaigns_code_unique" UNIQUE("code"),
	CONSTRAINT "social_campaigns_platform_check" CHECK ("social_campaigns"."platform" = 'tiktok'),
	CONSTRAINT "social_campaigns_status_check" CHECK ("social_campaigns"."status" in ('draft', 'approved', 'queued', 'published', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_campaigns_opportunity_id_idx" ON "social_campaigns" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "social_campaigns_status_idx" ON "social_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_content_name_created_at_idx" ON "events" USING btree ("content","name","created_at");