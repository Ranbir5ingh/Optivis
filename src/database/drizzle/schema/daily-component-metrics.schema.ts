// src/database/drizzle/schema/daily-component-metrics.schema.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const dailyComponentMetrics = pgTable(
  'daily_component_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),
    componentId: text('component_id').notNull(),

    impressions: integer('impressions').notNull().default(0),
    uniqueUsers: integer('unique_users').notNull().default(0),

    totalClicks: integer('total_clicks').notNull().default(0),
    avgTimeVisibleMs: doublePrecision('avg_time_visible_ms').notNull(),
    avgScrollDepthWhenVisible: doublePrecision('avg_scroll_depth_when_visible'),

    ctr: doublePrecision('ctr').notNull(),
    engagementScore: doublePrecision('engagement_score').notNull(),

    avgLcpImpact: doublePrecision('avg_lcp_impact'),

    prevDayEngagement: doublePrecision('prev_day_engagement'),
    trendPercent: doublePrecision('trend_percent'),

    scrollDepthP50: doublePrecision('scroll_depth_p50'),
    scrollDepthP90: doublePrecision('scroll_depth_p90'),
    scrollDepthP99: doublePrecision('scroll_depth_p99'),

    avgTimeVisibleP50: doublePrecision('avg_time_visible_p50'),
    avgTimeVisibleP90: doublePrecision('avg_time_visible_p90'),

    ctrP25: doublePrecision('ctr_p25'),
    ctrP50: doublePrecision('ctr_p50'),
    ctrP75: doublePrecision('ctr_p75'),
    ctrP90: doublePrecision('ctr_p90'),
    ctrP99: doublePrecision('ctr_p99'),

    engagementP25: doublePrecision('engagement_p25'),
    engagementP50: doublePrecision('engagement_p50'),
    engagementP75: doublePrecision('engagement_p75'),
    engagementP90: doublePrecision('engagement_p90'),
    engagementP99: doublePrecision('engagement_p99'),

    timeVisibleP25: doublePrecision('time_visible_p25'),
    timeVisibleP50: doublePrecision('time_visible_p50'),
    timeVisibleP75: doublePrecision('time_visible_p75'),
    timeVisibleP90: doublePrecision('time_visible_p90'),
    timeVisibleP99: doublePrecision('time_visible_p99'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_component_metrics').on(t.projectId, t.date, t.componentId),
    index('idx_component_metrics_project_date').on(t.projectId, t.date),
    index('idx_component_metrics_component').on(t.projectId, t.componentId, t.date),
    index('idx_component_metrics_engagement').on(
      t.projectId,
      t.engagementScore.desc(),
    ),
  ],
);

export type DailyComponentMetricsRow = typeof dailyComponentMetrics.$inferSelect;
export type NewDailyComponentMetricsRow = typeof dailyComponentMetrics.$inferInsert;