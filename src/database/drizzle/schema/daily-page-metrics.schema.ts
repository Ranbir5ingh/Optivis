// src/database/drizzle/schema/daily-page-metrics.schema.ts

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

export const dailyPageMetrics = pgTable(
  'daily_page_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),
    path: text('path').notNull(),

    pageViews: integer('page_views').notNull().default(0),
    uniqueSessions: integer('unique_sessions').notNull().default(0),
    avgTimeOnPageMs: doublePrecision('avg_time_on_page_ms'),
    bounceRate: doublePrecision('bounce_rate'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_page').on(t.projectId, t.date, t.path),
    index('idx_daily_page_project_date').on(t.projectId, t.date),
    index('idx_daily_page_path').on(t.projectId, t.path, t.date),
  ]
);

export type DailyPageMetricsRow = typeof dailyPageMetrics.$inferSelect;
export type NewDailyPageMetricsRow = typeof dailyPageMetrics.$inferInsert;