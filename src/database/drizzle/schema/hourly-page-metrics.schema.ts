// src/database/drizzle/schema/hourly-page-metrics.schema.ts

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

export const hourlyPageMetrics = pgTable(
  'hourly_page_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    hour: timestamp('hour', { withTimezone: true }).notNull(),
    path: text('path').notNull(),

    pageViews: integer('page_views').notNull().default(0),
    uniqueSessions: integer('unique_sessions').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),

    avgTimeOnPageMs: doublePrecision('avg_time_on_page_ms'),
    timeOnPageSum: doublePrecision('time_on_page_sum').notNull().default(0),
    timeOnPageCount: integer('time_on_page_count').notNull().default(0),

    bounceCount: integer('bounce_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_hourly_page').on(t.projectId, t.hour, t.path),
    index('idx_hourly_page_project_hour').on(t.projectId, t.hour),
    index('idx_hourly_page_path').on(t.projectId, t.path, t.hour),
  ]
);

export type HourlyPageMetricsRow = typeof hourlyPageMetrics.$inferSelect;
export type NewHourlyPageMetricsRow = typeof hourlyPageMetrics.$inferInsert;