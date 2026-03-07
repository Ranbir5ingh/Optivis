// src/database/drizzle/schema/daily-behavioral-page-metrics.schema.ts

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

export const dailyBehavioralPageMetrics = pgTable(
  'daily_behavioral_page_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    path: text('path').notNull(),

    exitIntentCount: integer('exit_intent_count').notNull().default(0),
    exitIntentSessions: integer('exit_intent_sessions').notNull().default(0),
    avgScrollDepthAtExit: doublePrecision('avg_scroll_depth_at_exit'),
    avgTimeOnPageAtExit: doublePrecision('avg_time_on_page_at_exit'),
    earlyExitRate: doublePrecision('early_exit_rate').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_behavioral_page').on(t.projectId, t.date, t.path),
    index('idx_behavioral_page_project_date').on(t.projectId, t.date),
    index('idx_behavioral_page_path').on(t.projectId, t.path, t.date),
  ],
);

export type DailyBehavioralPageMetricsRow =
  typeof dailyBehavioralPageMetrics.$inferSelect;
export type NewDailyBehavioralPageMetricsRow =
  typeof dailyBehavioralPageMetrics.$inferInsert;