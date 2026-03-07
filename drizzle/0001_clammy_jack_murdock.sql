CREATE TABLE "recommendation_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"recommendation_hash" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"recommendation_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"patch_generated_at" timestamp with time zone,
	"patch_hash" text,
	"diff_content" text,
	"pr_created_at" timestamp with time zone,
	"pr_url" text,
	"pr_number" text,
	"merged_at" timestamp with time zone,
	"commit_sha" text,
	"evaluation_window_ends_at" timestamp with time zone,
	"impact_evaluated_at" timestamp with time zone,
	"baseline_metric_value" double precision,
	"post_metric_value" double precision,
	"impact_score" double precision,
	"metadata" jsonb NOT NULL,
	"expired_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_instance" UNIQUE("project_id","recommendation_hash")
);
--> statement-breakpoint
CREATE TABLE "evolution_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"pipeline" text NOT NULL,
	"processed_window" timestamp with time zone NOT NULL,
	"last_processed_at" timestamp with time zone NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_evolution_cursor" UNIQUE("project_id","pipeline")
);
--> statement-breakpoint
ALTER TABLE "recommendation_instances" ADD CONSTRAINT "recommendation_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_jobs" ADD CONSTRAINT "evolution_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_cursor" ADD CONSTRAINT "evolution_cursor_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_instances_project" ON "recommendation_instances" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_instances_project_hash" ON "recommendation_instances" USING btree ("project_id","recommendation_hash");--> statement-breakpoint
CREATE INDEX "idx_instances_status" ON "recommendation_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_instances_evaluation_window" ON "recommendation_instances" USING btree ("project_id","evaluation_window_ends_at");--> statement-breakpoint
CREATE INDEX "idx_evolution_jobs_project_status" ON "evolution_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_evolution_jobs_instance" ON "evolution_jobs" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_evolution_jobs_type" ON "evolution_jobs" USING btree ("job_type","status");--> statement-breakpoint
CREATE INDEX "idx_evolution_jobs_next_retry" ON "evolution_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_evolution_jobs_pending" ON "evolution_jobs" USING btree ("status","next_retry_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_evolution_cursor_project" ON "evolution_cursor" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_evolution_cursor_window" ON "evolution_cursor" USING btree ("processed_window");