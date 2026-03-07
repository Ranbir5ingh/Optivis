// src/database/drizzle/schema/hourly-component-metrics.schema.ts

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

export const hourlyComponentMetrics = pgTable(
  'hourly_component_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    hour: timestamp('hour', { withTimezone: true }).notNull(),
    componentId: text('component_id').notNull(),

    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    rageClicks: integer('rage_clicks').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),

    avgVisibleTimeMs: doublePrecision('avg_visible_time_ms'),
    visibleTimeSum: doublePrecision('visible_time_sum').notNull().default(0),
    visibleTimeCount: integer('visible_time_count').notNull().default(0),

    scrollDepthP50: doublePrecision('scroll_depth_p50'),
    scrollDepthP90: doublePrecision('scroll_depth_p90'),
    scrollDepthP99: doublePrecision('scroll_depth_p99'),
    scrollDepthSampleSize: integer('scroll_depth_sample_size').notNull().default(0),

    visibleTimeP50: doublePrecision('visible_time_p50'),
    visibleTimeP90: doublePrecision('visible_time_p90'),
    visibleTimeSampleSize: integer('visible_time_sample_size').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_hourly_component').on(t.projectId, t.hour, t.componentId),
    index('idx_hourly_component_project_hour').on(t.projectId, t.hour),
    index('idx_hourly_component_id').on(t.projectId, t.componentId, t.hour),
  ]
);

export type HourlyComponentMetricsRow = typeof hourlyComponentMetrics.$inferSelect;
export type NewHourlyComponentMetricsRow = typeof hourlyComponentMetrics.$inferInsert;