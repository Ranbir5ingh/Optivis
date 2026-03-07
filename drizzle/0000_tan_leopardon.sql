CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'user' NOT NULL,
	"google_id" text,
	"github_id" text,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website_url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_member" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"component_id" text,
	"element_id" text,
	"path" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "project_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"entry_path" text,
	"exit_path" text,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"max_scroll_depth" double precision DEFAULT 0 NOT NULL,
	"has_scrolled" boolean DEFAULT false NOT NULL,
	"bounced" boolean DEFAULT false NOT NULL,
	"device_type" text,
	"user_cohort" text,
	"forms_started" integer DEFAULT 0,
	"forms_completed" integer DEFAULT 0,
	"form_abandons" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_session_per_project" UNIQUE("project_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "session_page_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"page_visits" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_session_sequence" UNIQUE("project_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "hourly_page_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"path" text NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"unique_sessions" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"avg_time_on_page_ms" double precision,
	"time_on_page_sum" double precision DEFAULT 0 NOT NULL,
	"time_on_page_count" integer DEFAULT 0 NOT NULL,
	"bounce_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_hourly_page" UNIQUE("project_id","hour","path")
);
--> statement-breakpoint
CREATE TABLE "hourly_component_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"component_id" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"rage_clicks" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"avg_visible_time_ms" double precision,
	"visible_time_sum" double precision DEFAULT 0 NOT NULL,
	"visible_time_count" integer DEFAULT 0 NOT NULL,
	"scroll_depth_p50" double precision,
	"scroll_depth_p90" double precision,
	"scroll_depth_p99" double precision,
	"scroll_depth_sample_size" integer DEFAULT 0 NOT NULL,
	"visible_time_p50" double precision,
	"visible_time_p90" double precision,
	"visible_time_sample_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_hourly_component" UNIQUE("project_id","hour","component_id")
);
--> statement-breakpoint
CREATE TABLE "hourly_element_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"element_id" text NOT NULL,
	"component_id" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"ctr" double precision DEFAULT 0 NOT NULL,
	"avg_click_x" double precision,
	"avg_click_y" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_hourly_element" UNIQUE("project_id","hour","element_id")
);
--> statement-breakpoint
CREATE TABLE "hourly_session_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"bounced_sessions" integer DEFAULT 0 NOT NULL,
	"bounce_rate" double precision,
	"avg_session_duration_ms" double precision,
	"session_duration_sum" double precision DEFAULT 0 NOT NULL,
	"session_duration_count" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"returning_users" integer DEFAULT 0 NOT NULL,
	"power_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_hourly_session" UNIQUE("project_id","hour")
);
--> statement-breakpoint
CREATE TABLE "daily_page_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"path" text NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"unique_sessions" integer DEFAULT 0 NOT NULL,
	"avg_time_on_page_ms" double precision,
	"bounce_rate" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_page" UNIQUE("project_id","date","path")
);
--> statement-breakpoint
CREATE TABLE "daily_session_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"avg_session_duration_ms" double precision,
	"bounce_rate" double precision,
	"new_users" integer DEFAULT 0 NOT NULL,
	"returning_users" integer DEFAULT 0 NOT NULL,
	"power_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_session" UNIQUE("project_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_component_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"component_id" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"avg_time_visible_ms" double precision NOT NULL,
	"avg_scroll_depth_when_visible" double precision,
	"ctr" double precision NOT NULL,
	"engagement_score" double precision NOT NULL,
	"avg_lcp_impact" double precision,
	"prev_day_engagement" double precision,
	"trend_percent" double precision,
	"scroll_depth_p50" double precision,
	"scroll_depth_p90" double precision,
	"scroll_depth_p99" double precision,
	"avg_time_visible_p50" double precision,
	"avg_time_visible_p90" double precision,
	"ctr_p25" double precision,
	"ctr_p50" double precision,
	"ctr_p75" double precision,
	"ctr_p90" double precision,
	"ctr_p99" double precision,
	"engagement_p25" double precision,
	"engagement_p50" double precision,
	"engagement_p75" double precision,
	"engagement_p90" double precision,
	"engagement_p99" double precision,
	"time_visible_p25" double precision,
	"time_visible_p50" double precision,
	"time_visible_p75" double precision,
	"time_visible_p90" double precision,
	"time_visible_p99" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_component_metrics" UNIQUE("project_id","date","component_id")
);
--> statement-breakpoint
CREATE TABLE "daily_element_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"element_id" text NOT NULL,
	"component_id" text,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" double precision NOT NULL,
	"avg_click_x" double precision,
	"avg_click_y" double precision,
	"prev_day_clicks" integer DEFAULT 0,
	"trend_percent" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_element_metrics" UNIQUE("project_id","date","element_id")
);
--> statement-breakpoint
CREATE TABLE "daily_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"avg_lcp" double precision,
	"avg_cls" double precision,
	"avg_inp" double precision,
	"avg_ttfb" double precision,
	"lcp_p50" double precision,
	"lcp_p90" double precision,
	"lcp_p99" double precision,
	"cls_p50" double precision,
	"cls_p90" double precision,
	"cls_p99" double precision,
	"inp_p50" double precision,
	"inp_p90" double precision,
	"inp_p99" double precision,
	"ttfb_p50" double precision,
	"ttfb_p90" double precision,
	"ttfb_p99" double precision,
	"lcp_sample_size" integer DEFAULT 0 NOT NULL,
	"cls_sample_size" integer DEFAULT 0 NOT NULL,
	"inp_sample_size" integer DEFAULT 0 NOT NULL,
	"ttfb_sample_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_performance" UNIQUE("project_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_form_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"form_id" text NOT NULL,
	"component_id" text,
	"starts" integer DEFAULT 0 NOT NULL,
	"submits" integer DEFAULT 0 NOT NULL,
	"abandons" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"completion_rate" double precision NOT NULL,
	"abandon_rate" double precision NOT NULL,
	"error_rate" double precision NOT NULL,
	"avg_time_to_submit_ms" double precision,
	"avg_time_to_abandon_ms" double precision,
	"avg_fields_interacted" double precision,
	"abandon_rate_p25" double precision,
	"abandon_rate_p50" double precision,
	"abandon_rate_p75" double precision,
	"abandon_rate_p90" double precision,
	"abandon_rate_p99" double precision,
	"completion_rate_p25" double precision,
	"completion_rate_p50" double precision,
	"completion_rate_p75" double precision,
	"completion_rate_p90" double precision,
	"completion_rate_p99" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_form" UNIQUE("project_id","date","form_id")
);
--> statement-breakpoint
CREATE TABLE "funnel_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"funnel_name" text NOT NULL,
	"step_index" integer NOT NULL,
	"step_name" text NOT NULL,
	"entered_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"drop_off_rate" double precision NOT NULL,
	"avg_time_ms" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_funnel_metrics" UNIQUE("project_id","date","funnel_name","step_index")
);
--> statement-breakpoint
CREATE TABLE "aggregation_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"pipeline" text NOT NULL,
	"processed_window" timestamp with time zone NOT NULL,
	"last_processed_at" timestamp with time zone NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_cursor" UNIQUE("project_id","pipeline")
);
--> statement-breakpoint
CREATE TABLE "aggregation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"pipeline" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
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
CREATE TABLE "funnel_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"session_sample_rate" double precision DEFAULT 1 NOT NULL,
	"raw_events_retention_days" integer DEFAULT 30 NOT NULL,
	"session_metrics_retention_days" integer DEFAULT 7 NOT NULL,
	"hourly_summaries_retention_days" integer DEFAULT 90 NOT NULL,
	"enable_auto_aggregation" boolean DEFAULT true NOT NULL,
	"enable_insights" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_settings_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_github_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"org_installation_id" uuid NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	CONSTRAINT "project_github_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "org_github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	CONSTRAINT "org_github_installations_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "unique_org_installation" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "code_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"framework" text DEFAULT 'nextjs' NOT NULL,
	"components" jsonb NOT NULL,
	"elements" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_manifest_per_commit" UNIQUE("project_id","commit_sha")
);
--> statement-breakpoint
CREATE TABLE "detected_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"component_id" text,
	"element_id" text,
	"flag" text NOT NULL,
	"severity" text NOT NULL,
	"reason" text NOT NULL,
	"value" double precision,
	"baseline" double precision,
	"percentage_change" double precision,
	"confidence" double precision,
	"z_score" double precision,
	"p_value" double precision,
	"confidence_metadata" jsonb,
	"baseline_type" text,
	"baseline_window_days" double precision,
	"comparison" jsonb,
	"context" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"first_detected_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"acted_upon_at" timestamp with time zone,
	"acted_upon_by" text,
	"action_taken" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"regressed_at" timestamp with time zone,
	"regressed_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
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
CREATE TABLE "insights_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"processed_window" timestamp with time zone NOT NULL,
	"last_processed_at" timestamp with time zone NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_insights_cursor" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"recommendations" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"reasoning_version" text NOT NULL,
	"commit_sha" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_behavioral_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"rage_click_count" integer DEFAULT 0 NOT NULL,
	"rage_click_sessions" integer DEFAULT 0 NOT NULL,
	"affected_rage_click_elements" integer DEFAULT 0 NOT NULL,
	"exit_intent_count" integer DEFAULT 0 NOT NULL,
	"exit_intent_sessions" integer DEFAULT 0 NOT NULL,
	"avg_page_early_exit_rate" double precision DEFAULT 0 NOT NULL,
	"affected_exit_intent_pages" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_behavioral" UNIQUE("project_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_behavioral_element_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"element_id" text NOT NULL,
	"component_id" text,
	"rage_click_count" integer DEFAULT 0 NOT NULL,
	"rage_click_sessions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_behavioral_element" UNIQUE("project_id","date","element_id")
);
--> statement-breakpoint
CREATE TABLE "daily_behavioral_page_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"path" text NOT NULL,
	"exit_intent_count" integer DEFAULT 0 NOT NULL,
	"exit_intent_sessions" integer DEFAULT 0 NOT NULL,
	"avg_scroll_depth_at_exit" double precision,
	"avg_time_on_page_at_exit" double precision,
	"early_exit_rate" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_behavioral_page" UNIQUE("project_id","date","path")
);
--> statement-breakpoint
CREATE TABLE "ai_reasoning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_type" text NOT NULL,
	"insight_snapshot_hash" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reasoning_cursor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"processed_hash" text NOT NULL,
	"last_processed_at" timestamp with time zone NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_ai_reasoning_cursor" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_keys" ADD CONSTRAINT "project_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_metrics" ADD CONSTRAINT "session_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_page_sequence" ADD CONSTRAINT "session_page_sequence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_page_metrics" ADD CONSTRAINT "hourly_page_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_component_metrics" ADD CONSTRAINT "hourly_component_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_element_metrics" ADD CONSTRAINT "hourly_element_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_session_metrics" ADD CONSTRAINT "hourly_session_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_page_metrics" ADD CONSTRAINT "daily_page_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_session_metrics" ADD CONSTRAINT "daily_session_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_component_metrics" ADD CONSTRAINT "daily_component_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_element_metrics" ADD CONSTRAINT "daily_element_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_performance_metrics" ADD CONSTRAINT "daily_performance_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_form_metrics" ADD CONSTRAINT "daily_form_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_metrics" ADD CONSTRAINT "funnel_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregation_cursor" ADD CONSTRAINT "aggregation_cursor_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregation_jobs" ADD CONSTRAINT "aggregation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_definitions" ADD CONSTRAINT "funnel_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_org_installation_id_org_github_installations_id_fk" FOREIGN KEY ("org_installation_id") REFERENCES "public"."org_github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_github_installations" ADD CONSTRAINT "org_github_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_metadata" ADD CONSTRAINT "code_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_insights" ADD CONSTRAINT "detected_insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights_jobs" ADD CONSTRAINT "insights_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights_cursor" ADD CONSTRAINT "insights_cursor_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_behavioral_metrics" ADD CONSTRAINT "daily_behavioral_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_behavioral_element_metrics" ADD CONSTRAINT "daily_behavioral_element_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_behavioral_page_metrics" ADD CONSTRAINT "daily_behavioral_page_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reasoning_jobs" ADD CONSTRAINT "ai_reasoning_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reasoning_cursor" ADD CONSTRAINT "ai_reasoning_cursor_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_owner_id_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_org_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "org_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "org_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_project_time" ON "tracking_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_visitor" ON "tracking_events" USING btree ("visitor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_visitor_project" ON "tracking_events" USING btree ("project_id","visitor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_session" ON "tracking_events" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_session_project" ON "tracking_events" USING btree ("project_id","session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_type" ON "tracking_events" USING btree ("project_id","type","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_rage_click" ON "tracking_events" USING btree ("project_id","type","occurred_at") WHERE "tracking_events"."type" = 'rage_click';--> statement-breakpoint
CREATE INDEX "idx_tracking_exit_intent" ON "tracking_events" USING btree ("project_id","type","occurred_at") WHERE "tracking_events"."type" = 'exit_intent';--> statement-breakpoint
CREATE INDEX "idx_tracking_form_events" ON "tracking_events" USING btree ("project_id","type","occurred_at") WHERE "tracking_events"."type" IN ('form_start', 'form_abandon', 'form_submit', 'form_error');--> statement-breakpoint
CREATE INDEX "idx_tracking_component_id" ON "tracking_events" USING btree ("project_id","component_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_element_id" ON "tracking_events" USING btree ("project_id","element_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_component_element" ON "tracking_events" USING btree ("project_id","component_id","element_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_path" ON "tracking_events" USING btree ("project_id","path","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_metadata" ON "tracking_events" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX "idx_tracking_occurred_at" ON "tracking_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_received_at" ON "tracking_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_component_clicks" ON "tracking_events" USING btree ("project_id","component_id","type","occurred_at") WHERE "tracking_events"."type" = 'click';--> statement-breakpoint
CREATE INDEX "idx_tracking_component_visibility" ON "tracking_events" USING btree ("project_id","component_id","type","occurred_at") WHERE "tracking_events"."type" = 'visibility';--> statement-breakpoint
CREATE INDEX "idx_tracking_element_forms" ON "tracking_events" USING btree ("project_id","element_id","type","occurred_at") WHERE "tracking_events"."type" IN ('form_start', 'form_abandon', 'form_submit', 'form_error');--> statement-breakpoint
CREATE INDEX "project_keys_key_idx" ON "project_keys" USING btree ("key") WHERE "project_keys"."is_active" = true;--> statement-breakpoint
CREATE INDEX "project_keys_project_idx" ON "project_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_session_project_id" ON "session_metrics" USING btree ("project_id","session_id");--> statement-breakpoint
CREATE INDEX "idx_session_visitor_id" ON "session_metrics" USING btree ("project_id","visitor_id");--> statement-breakpoint
CREATE INDEX "idx_session_ended_at" ON "session_metrics" USING btree ("project_id","ended_at");--> statement-breakpoint
CREATE INDEX "idx_session_cohort" ON "session_metrics" USING btree ("project_id","user_cohort");--> statement-breakpoint
CREATE INDEX "idx_session_seq_project" ON "session_page_sequence" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_session_seq_session" ON "session_page_sequence" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_hourly_page_project_hour" ON "hourly_page_metrics" USING btree ("project_id","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_page_path" ON "hourly_page_metrics" USING btree ("project_id","path","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_component_project_hour" ON "hourly_component_metrics" USING btree ("project_id","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_component_id" ON "hourly_component_metrics" USING btree ("project_id","component_id","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_element_project_hour" ON "hourly_element_metrics" USING btree ("project_id","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_element_id" ON "hourly_element_metrics" USING btree ("project_id","element_id","hour");--> statement-breakpoint
CREATE INDEX "idx_hourly_session_project_hour" ON "hourly_session_metrics" USING btree ("project_id","hour");--> statement-breakpoint
CREATE INDEX "idx_daily_page_project_date" ON "daily_page_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_page_path" ON "daily_page_metrics" USING btree ("project_id","path","date");--> statement-breakpoint
CREATE INDEX "idx_daily_session_project_date" ON "daily_session_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_component_metrics_project_date" ON "daily_component_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_component_metrics_component" ON "daily_component_metrics" USING btree ("project_id","component_id","date");--> statement-breakpoint
CREATE INDEX "idx_component_metrics_engagement" ON "daily_component_metrics" USING btree ("project_id","engagement_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_element_metrics_project_date" ON "daily_element_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_element_metrics_element" ON "daily_element_metrics" USING btree ("project_id","element_id","date");--> statement-breakpoint
CREATE INDEX "idx_element_metrics_ctr" ON "daily_element_metrics" USING btree ("project_id","ctr" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_daily_performance_project_date" ON "daily_performance_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_form_project_date" ON "daily_form_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_form_id" ON "daily_form_metrics" USING btree ("project_id","form_id","date");--> statement-breakpoint
CREATE INDEX "idx_funnel_metrics_project" ON "funnel_metrics" USING btree ("project_id","funnel_name","date");--> statement-breakpoint
CREATE INDEX "idx_funnel_metrics_step" ON "funnel_metrics" USING btree ("project_id","funnel_name","step_index","date");--> statement-breakpoint
CREATE INDEX "idx_cursor_project_pipeline" ON "aggregation_cursor" USING btree ("project_id","pipeline");--> statement-breakpoint
CREATE INDEX "idx_cursor_window" ON "aggregation_cursor" USING btree ("processed_window");--> statement-breakpoint
CREATE INDEX "idx_aggregation_jobs_project_status" ON "aggregation_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_aggregation_jobs_pipeline" ON "aggregation_jobs" USING btree ("project_id","pipeline","status");--> statement-breakpoint
CREATE INDEX "idx_aggregation_jobs_next_retry" ON "aggregation_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_aggregation_jobs_pending" ON "aggregation_jobs" USING btree ("status","next_retry_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_funnel_def_project" ON "funnel_definitions" USING btree ("project_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_funnel_def_name" ON "funnel_definitions" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_project_settings_project" ON "project_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_connection_project" ON "project_github_connections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_connection_org_installation" ON "project_github_connections" USING btree ("org_installation_id");--> statement-breakpoint
CREATE INDEX "idx_connection_active" ON "project_github_connections" USING btree ("project_id") WHERE "project_github_connections"."disconnected_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_org_installation_org" ON "org_github_installations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_installation_active" ON "org_github_installations" USING btree ("organization_id") WHERE "org_github_installations"."disconnected_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_metadata_project" ON "code_metadata" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_metadata_commit" ON "code_metadata" USING btree ("project_id","commit_sha");--> statement-breakpoint
CREATE INDEX "idx_metadata_latest" ON "code_metadata" USING btree ("project_id","uploaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_insight" ON "detected_insights" USING btree ("project_id","flag","component_id","element_id") WHERE "detected_insights"."status" != 'resolved';--> statement-breakpoint
CREATE INDEX "idx_detected_insights_project" ON "detected_insights" USING btree ("project_id","first_detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_detected_insights_component" ON "detected_insights" USING btree ("component_id","first_detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_detected_insights_flag" ON "detected_insights" USING btree ("flag","project_id","first_detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_detected_insights_severity" ON "detected_insights" USING btree ("severity","project_id","first_detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_detected_insights_status" ON "detected_insights" USING btree ("project_id","status","first_detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_insights_jobs_project_status" ON "insights_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_insights_jobs_next_retry" ON "insights_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_insights_jobs_pending" ON "insights_jobs" USING btree ("status","next_retry_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_insights_cursor_project" ON "insights_cursor" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_insights_cursor_window" ON "insights_cursor" USING btree ("processed_window");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_project" ON "ai_recommendations" USING btree ("project_id","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_version" ON "ai_recommendations" USING btree ("reasoning_version");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_commit" ON "ai_recommendations" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "idx_daily_behavioral_project_date" ON "daily_behavioral_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_behavioral_element_project_date" ON "daily_behavioral_element_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_behavioral_element_component" ON "daily_behavioral_element_metrics" USING btree ("project_id","component_id","date");--> statement-breakpoint
CREATE INDEX "idx_behavioral_page_project_date" ON "daily_behavioral_page_metrics" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "idx_behavioral_page_path" ON "daily_behavioral_page_metrics" USING btree ("project_id","path","date");--> statement-breakpoint
CREATE INDEX "idx_ai_reasoning_jobs_project_status" ON "ai_reasoning_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_ai_reasoning_jobs_next_retry" ON "ai_reasoning_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_ai_reasoning_jobs_pending" ON "ai_reasoning_jobs" USING btree ("status","next_retry_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_reasoning_cursor_project" ON "ai_reasoning_cursor" USING btree ("project_id");