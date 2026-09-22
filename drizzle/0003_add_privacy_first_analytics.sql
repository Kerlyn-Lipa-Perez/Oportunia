ALTER TABLE "events" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "engagement_ms" integer;--> statement-breakpoint
CREATE INDEX "events_content_session_created_at_idx" ON "events" USING btree ("content","session_id","created_at");--> statement-breakpoint
CREATE INDEX "events_session_name_created_at_idx" ON "events" USING btree ("session_id","name","created_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_engagement_ms_check" CHECK ("events"."engagement_ms" is null or "events"."engagement_ms" between 0 and 60000);