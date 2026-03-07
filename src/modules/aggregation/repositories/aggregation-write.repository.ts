// src/modules/aggregation/repositories/aggregation-write.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { sql } from 'drizzle-orm';
import {
  hourlyPageMetrics,
  NewHourlyPageMetricsRow,
  HourlyPageMetricsRow,
  hourlyComponentMetrics,
  NewHourlyComponentMetricsRow,
  HourlyComponentMetricsRow,
  hourlyElementMetrics,
  NewHourlyElementMetricsRow,
  HourlyElementMetricsRow,
  hourlySessionMetrics,
  NewHourlySessionMetricsRow,
  HourlySessionMetricsRow,
  dailyComponentMetrics,
  NewDailyComponentMetricsRow,
  DailyComponentMetricsRow,
  dailyElementMetrics,
  NewDailyElementMetricsRow,
  DailyElementMetricsRow,
  funnelMetrics,
  NewFunnelMetricsRow,
  FunnelMetricsRow,
  NewDailyPageMetricsRow,
  DailyPageMetricsRow,
  dailyPageMetrics,
  NewDailySessionMetricsRow,
  DailySessionMetricsRow,
  dailySessionMetrics,
  dailyPerformanceMetrics,
  NewDailyPerformanceMetricsRow,
  DailyPerformanceMetricsRow,
  dailyFormMetrics,
  NewDailyFormMetricsRow,
  DailyFormMetricsRow,
  NewDailyBehavioralMetricsRow,
  DailyBehavioralMetricsRow,
  dailyBehavioralMetrics,
  NewDailyBehavioralElementMetricsRow,
  DailyBehavioralElementMetricsRow,
  dailyBehavioralElementMetrics,
  NewDailyBehavioralPageMetricsRow,
  DailyBehavioralPageMetricsRow,
  dailyBehavioralPageMetrics,
} from 'src/database/drizzle/schema';

@Injectable()
export class AggregationWriteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async upsertHourlyPageMetricsBatch(
    rows: NewHourlyPageMetricsRow[],
  ): Promise<HourlyPageMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(hourlyPageMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          hourlyPageMetrics.projectId,
          hourlyPageMetrics.hour,
          hourlyPageMetrics.path,
        ],
        set: {
          pageViews: sql`EXCLUDED.page_views`,
          uniqueSessions: sql`EXCLUDED.unique_sessions`,
          uniqueVisitors: sql`EXCLUDED.unique_visitors`,
          avgTimeOnPageMs: sql`EXCLUDED.avg_time_on_page_ms`,
          timeOnPageSum: sql`EXCLUDED.time_on_page_sum`,
          timeOnPageCount: sql`EXCLUDED.time_on_page_count`,
          bounceCount: sql`EXCLUDED.bounce_count`,
        },
      })
      .returning();
  }

  async upsertHourlyComponentMetricsBatch(
    rows: NewHourlyComponentMetricsRow[],
  ): Promise<HourlyComponentMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(hourlyComponentMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          hourlyComponentMetrics.projectId,
          hourlyComponentMetrics.hour,
          hourlyComponentMetrics.componentId,
        ],
        set: {
          impressions: sql`EXCLUDED.impressions`,
          clicks: sql`EXCLUDED.clicks`,
          rageClicks: sql`EXCLUDED.rage_clicks`,
          uniqueVisitors: sql`EXCLUDED.unique_visitors`,
          avgVisibleTimeMs: sql`EXCLUDED.avg_visible_time_ms`,
          visibleTimeSum: sql`EXCLUDED.visible_time_sum`,
          visibleTimeCount: sql`EXCLUDED.visible_time_count`,
          scrollDepthP50: sql`EXCLUDED.scroll_depth_p50`,
          scrollDepthP90: sql`EXCLUDED.scroll_depth_p90`,
          scrollDepthP99: sql`EXCLUDED.scroll_depth_p99`,
          scrollDepthSampleSize: sql`EXCLUDED.scroll_depth_sample_size`,
          visibleTimeP50: sql`EXCLUDED.visible_time_p50`,
          visibleTimeP90: sql`EXCLUDED.visible_time_p90`,
          visibleTimeSampleSize: sql`EXCLUDED.visible_time_sample_size`,
        },
      })
      .returning();
  }

  async upsertHourlyElementMetricsBatch(
    rows: NewHourlyElementMetricsRow[],
  ): Promise<HourlyElementMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(hourlyElementMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          hourlyElementMetrics.projectId,
          hourlyElementMetrics.hour,
          hourlyElementMetrics.elementId,
        ],
        set: {
          componentId: sql`EXCLUDED.component_id`,
          impressions: sql`EXCLUDED.impressions`,
          clicks: sql`EXCLUDED.clicks`,
          ctr: sql`EXCLUDED.ctr`,
          avgClickX: sql`EXCLUDED.avg_click_x`,
          avgClickY: sql`EXCLUDED.avg_click_y`,
        },
      })
      .returning();
  }

  async upsertHourlySessionMetricsBatch(
    rows: NewHourlySessionMetricsRow[],
  ): Promise<HourlySessionMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(hourlySessionMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [hourlySessionMetrics.projectId, hourlySessionMetrics.hour],
        set: {
          sessions: sql`EXCLUDED.sessions`,
          bouncedSessions: sql`EXCLUDED.bounced_sessions`,
          bounceRate: sql`EXCLUDED.bounce_rate`,
          avgSessionDurationMs: sql`EXCLUDED.avg_session_duration_ms`,
          sessionDurationSum: sql`EXCLUDED.session_duration_sum`,
          sessionDurationCount: sql`EXCLUDED.session_duration_count`,
          newUsers: sql`EXCLUDED.new_users`,
          returningUsers: sql`EXCLUDED.returning_users`,
          powerUsers: sql`EXCLUDED.power_users`,
        },
      })
      .returning();
  }

  async upsertDailyPerformanceMetricsBatch(
    rows: NewDailyPerformanceMetricsRow[],
  ): Promise<DailyPerformanceMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyPerformanceMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyPerformanceMetrics.projectId,
          dailyPerformanceMetrics.date,
        ],
        set: {
          avgLcp: sql`EXCLUDED.avg_lcp`,
          avgCls: sql`EXCLUDED.avg_cls`,
          avgInp: sql`EXCLUDED.avg_inp`,
          avgTtfb: sql`EXCLUDED.avg_ttfb`,
          lcpP50: sql`EXCLUDED.lcp_p50`,
          lcpP90: sql`EXCLUDED.lcp_p90`,
          lcpP99: sql`EXCLUDED.lcp_p99`,
          clsP50: sql`EXCLUDED.cls_p50`,
          clsP90: sql`EXCLUDED.cls_p90`,
          clsP99: sql`EXCLUDED.cls_p99`,
          inpP50: sql`EXCLUDED.inp_p50`,
          inpP90: sql`EXCLUDED.inp_p90`,
          inpP99: sql`EXCLUDED.inp_p99`,
          ttfbP50: sql`EXCLUDED.ttfb_p50`,
          ttfbP90: sql`EXCLUDED.ttfb_p90`,
          ttfbP99: sql`EXCLUDED.ttfb_p99`,
          lcpSampleSize: sql`EXCLUDED.lcp_sample_size`,
          clsSampleSize: sql`EXCLUDED.cls_sample_size`,
          inpSampleSize: sql`EXCLUDED.inp_sample_size`,
          ttfbSampleSize: sql`EXCLUDED.ttfb_sample_size`,
        },
      })
      .returning();
  }

  async upsertDailyFormMetricsBatch(
    rows: NewDailyFormMetricsRow[],
  ): Promise<DailyFormMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyFormMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyFormMetrics.projectId,
          dailyFormMetrics.date,
          dailyFormMetrics.formId,
        ],
        set: {
          componentId: sql`EXCLUDED.component_id`,
          starts: sql`EXCLUDED.starts`,
          submits: sql`EXCLUDED.submits`,
          abandons: sql`EXCLUDED.abandons`,
          errors: sql`EXCLUDED.errors`,
          completionRate: sql`EXCLUDED.completion_rate`,
          abandonRate: sql`EXCLUDED.abandon_rate`,
          errorRate: sql`EXCLUDED.error_rate`,
          avgTimeToSubmitMs: sql`EXCLUDED.avg_time_to_submit_ms`,
          avgTimeToAbandonMs: sql`EXCLUDED.avg_time_to_abandon_ms`,
          avgFieldsInteracted: sql`EXCLUDED.avg_fields_interacted`,
          abandonRateP25: sql`EXCLUDED.abandon_rate_p25`,
          abandonRateP50: sql`EXCLUDED.abandon_rate_p50`,
          abandonRateP75: sql`EXCLUDED.abandon_rate_p75`,
          abandonRateP90: sql`EXCLUDED.abandon_rate_p90`,
          abandonRateP99: sql`EXCLUDED.abandon_rate_p99`,
          completionRateP25: sql`EXCLUDED.completion_rate_p25`,
          completionRateP50: sql`EXCLUDED.completion_rate_p50`,
          completionRateP75: sql`EXCLUDED.completion_rate_p75`,
          completionRateP90: sql`EXCLUDED.completion_rate_p90`,
          completionRateP99: sql`EXCLUDED.completion_rate_p99`,
        },
      })
      .returning();
  }

  async upsertDailyComponentMetricsBatch(
    rows: NewDailyComponentMetricsRow[],
  ): Promise<DailyComponentMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyComponentMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyComponentMetrics.projectId,
          dailyComponentMetrics.date,
          dailyComponentMetrics.componentId,
        ],
        set: {
          impressions: sql`EXCLUDED.impressions`,
          uniqueUsers: sql`EXCLUDED.unique_users`,
          totalClicks: sql`EXCLUDED.total_clicks`,
          avgTimeVisibleMs: sql`EXCLUDED.avg_time_visible_ms`,
          avgScrollDepthWhenVisible: sql`EXCLUDED.avg_scroll_depth_when_visible`,
          ctr: sql`EXCLUDED.ctr`,
          engagementScore: sql`EXCLUDED.engagement_score`,
          avgLcpImpact: sql`EXCLUDED.avg_lcp_impact`,
          prevDayEngagement: sql`EXCLUDED.prev_day_engagement`,
          trendPercent: sql`EXCLUDED.trend_percent`,
          scrollDepthP50: sql`EXCLUDED.scroll_depth_p50`,
          scrollDepthP90: sql`EXCLUDED.scroll_depth_p90`,
          scrollDepthP99: sql`EXCLUDED.scroll_depth_p99`,
          avgTimeVisibleP50: sql`EXCLUDED.avg_time_visible_p50`,
          avgTimeVisibleP90: sql`EXCLUDED.avg_time_visible_p90`,
          ctrP25: sql`EXCLUDED.ctr_p25`,
          ctrP50: sql`EXCLUDED.ctr_p50`,
          ctrP75: sql`EXCLUDED.ctr_p75`,
          ctrP90: sql`EXCLUDED.ctr_p90`,
          ctrP99: sql`EXCLUDED.ctr_p99`,
          engagementP25: sql`EXCLUDED.engagement_p25`,
          engagementP50: sql`EXCLUDED.engagement_p50`,
          engagementP75: sql`EXCLUDED.engagement_p75`,
          engagementP90: sql`EXCLUDED.engagement_p90`,
          engagementP99: sql`EXCLUDED.engagement_p99`,
          timeVisibleP25: sql`EXCLUDED.time_visible_p25`,
          timeVisibleP50: sql`EXCLUDED.time_visible_p50`,
          timeVisibleP75: sql`EXCLUDED.time_visible_p75`,
          timeVisibleP90: sql`EXCLUDED.time_visible_p90`,
          timeVisibleP99: sql`EXCLUDED.time_visible_p99`,
        },
      })
      .returning();
  }

  async upsertDailyElementMetricsBatch(
    rows: NewDailyElementMetricsRow[],
  ): Promise<DailyElementMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyElementMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyElementMetrics.projectId,
          dailyElementMetrics.date,
          dailyElementMetrics.elementId,
        ],
        set: {
          componentId: sql`EXCLUDED.component_id`,
          totalClicks: sql`EXCLUDED.total_clicks`,
          impressions: sql`EXCLUDED.impressions`,
          ctr: sql`EXCLUDED.ctr`,
          avgClickX: sql`EXCLUDED.avg_click_x`,
          avgClickY: sql`EXCLUDED.avg_click_y`,
          prevDayClicks: sql`EXCLUDED.prev_day_clicks`,
          trendPercent: sql`EXCLUDED.trend_percent`,
        },
      })
      .returning();
  }

  async upsertDailyFunnelBatch(
    rows: NewFunnelMetricsRow[],
  ): Promise<FunnelMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(funnelMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          funnelMetrics.projectId,
          funnelMetrics.date,
          funnelMetrics.funnelName,
          funnelMetrics.stepIndex,
        ],
        set: {
          stepName: sql`EXCLUDED.step_name`,
          enteredCount: sql`EXCLUDED.entered_count`,
          completedCount: sql`EXCLUDED.completed_count`,
          dropOffRate: sql`EXCLUDED.drop_off_rate`,
          avgTimeMs: sql`EXCLUDED.avg_time_ms`,
        },
      })
      .returning();
  }

  async upsertDailyPageMetricsBatch(
    rows: NewDailyPageMetricsRow[],
  ): Promise<DailyPageMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyPageMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyPageMetrics.projectId,
          dailyPageMetrics.date,
          dailyPageMetrics.path,
        ],
        set: {
          pageViews: sql`EXCLUDED.page_views`,
          uniqueSessions: sql`EXCLUDED.unique_sessions`,
          avgTimeOnPageMs: sql`EXCLUDED.avg_time_on_page_ms`,
          bounceRate: sql`EXCLUDED.bounce_rate`,
        },
      })
      .returning();
  }

  async upsertDailySessionMetricsBatch(
    rows: NewDailySessionMetricsRow[],
  ): Promise<DailySessionMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailySessionMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [dailySessionMetrics.projectId, dailySessionMetrics.date],
        set: {
          sessions: sql`EXCLUDED.sessions`,
          avgSessionDurationMs: sql`EXCLUDED.avg_session_duration_ms`,
          bounceRate: sql`EXCLUDED.bounce_rate`,
          newUsers: sql`EXCLUDED.new_users`,
          returningUsers: sql`EXCLUDED.returning_users`,
          powerUsers: sql`EXCLUDED.power_users`,
        },
      })
      .returning();
  }

  async upsertDailyBehavioralMetricsBatch(
    rows: NewDailyBehavioralMetricsRow[],
  ): Promise<DailyBehavioralMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyBehavioralMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [dailyBehavioralMetrics.projectId, dailyBehavioralMetrics.date],
        set: {
          rageClickCount: sql`EXCLUDED.rage_click_count`,
          rageClickSessions: sql`EXCLUDED.rage_click_sessions`,
          affectedRageClickElements: sql`EXCLUDED.affected_rage_click_elements`,
          exitIntentCount: sql`EXCLUDED.exit_intent_count`,
          exitIntentSessions: sql`EXCLUDED.exit_intent_sessions`,
          avgPageEarlyExitRate: sql`EXCLUDED.avg_page_early_exit_rate`,
          affectedExitIntentPages: sql`EXCLUDED.affected_exit_intent_pages`,
        },
      })
      .returning();
  }

  async upsertDailyBehavioralElementMetricsBatch(
    rows: NewDailyBehavioralElementMetricsRow[],
  ): Promise<DailyBehavioralElementMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyBehavioralElementMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyBehavioralElementMetrics.projectId,
          dailyBehavioralElementMetrics.date,
          dailyBehavioralElementMetrics.elementId,
        ],
        set: {
          componentId: sql`EXCLUDED.component_id`,
          rageClickCount: sql`EXCLUDED.rage_click_count`,
          rageClickSessions: sql`EXCLUDED.rage_click_sessions`,
        },
      })
      .returning();
  }

  async upsertDailyBehavioralPageMetricsBatch(
    rows: NewDailyBehavioralPageMetricsRow[],
  ): Promise<DailyBehavioralPageMetricsRow[]> {
    if (rows.length === 0) return [];

    return this.db
      .insert(dailyBehavioralPageMetrics)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          dailyBehavioralPageMetrics.projectId,
          dailyBehavioralPageMetrics.date,
          dailyBehavioralPageMetrics.path,
        ],
        set: {
          exitIntentCount: sql`EXCLUDED.exit_intent_count`,
          exitIntentSessions: sql`EXCLUDED.exit_intent_sessions`,
          avgScrollDepthAtExit: sql`EXCLUDED.avg_scroll_depth_at_exit`,
          avgTimeOnPageAtExit: sql`EXCLUDED.avg_time_on_page_at_exit`,
          earlyExitRate: sql`EXCLUDED.early_exit_rate`,
        },
      })
      .returning();
  }
}
