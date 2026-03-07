// src/database/drizzle/schema/daily-behavioral-metrics.schema.ts

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

export const dailyBehavioralMetrics = pgTable(
  'daily_behavioral_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    rageClickCount: integer('rage_click_count').notNull().default(0),
    rageClickSessions: integer('rage_click_sessions').notNull().default(0),
    affectedRageClickElements: integer('affected_rage_click_elements').notNull().default(0),

    exitIntentCount: integer('exit_intent_count').notNull().default(0),
    exitIntentSessions: integer('exit_intent_sessions').notNull().default(0),
    avgPageEarlyExitRate: doublePrecision('avg_page_early_exit_rate').notNull().default(0),
    affectedExitIntentPages: integer('affected_exit_intent_pages').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_behavioral').on(t.projectId, t.date),
    index('idx_daily_behavioral_project_date').on(t.projectId, t.date),
  ],
);

export type DailyBehavioralMetricsRow =
  typeof dailyBehavioralMetrics.$inferSelect;
export type NewDailyBehavioralMetricsRow =
  typeof dailyBehavioralMetrics.$inferInsert;