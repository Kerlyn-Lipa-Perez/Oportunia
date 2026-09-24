ALTER TABLE "app_profiles" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "app_profiles_role_suspended_idx" ON "app_profiles" USING btree ("role","suspended");--> statement-breakpoint
ALTER TABLE "app_profiles" ADD CONSTRAINT "app_profiles_role_check" CHECK ("app_profiles"."role" in ('admin', 'editor'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "ensure_active_admin_remains"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (
		TG_OP = 'DELETE'
		AND OLD."role" = 'admin'
		AND OLD."suspended" = false
	) OR (
		TG_OP = 'UPDATE'
		AND OLD."role" = 'admin'
		AND OLD."suspended" = false
		AND (NEW."role" <> 'admin' OR NEW."suspended" = true)
	) THEN
		PERFORM pg_advisory_xact_lock(72681425);
		IF NOT EXISTS (
			SELECT 1
			FROM "app_profiles"
			WHERE "user_id" <> OLD."user_id"
				AND "role" = 'admin'
				AND "suspended" = false
		) THEN
			RAISE EXCEPTION 'at least one active administrator is required'
				USING ERRCODE = '23514', CONSTRAINT = 'app_profiles_last_active_admin_check';
		END IF;
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "app_profiles_preserve_active_admin"
BEFORE UPDATE OF "role", "suspended" OR DELETE ON "app_profiles"
FOR EACH ROW EXECUTE FUNCTION "ensure_active_admin_remains"();
