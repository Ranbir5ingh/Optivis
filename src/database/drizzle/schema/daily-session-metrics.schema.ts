// src/database/drizzle/schema/daily-session-metrics.schema.ts

import {
  pgTable,
  uuid,
  integer,
  doublePrecision,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const dailySessionMetrics = pgTable(
  'daily_session_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    sessions: integer('sessions').notNull().default(0),
    avgSessionDurationMs: doublePrecision('avg_session_duration_ms'),
    bounceRate: doublePrecision('bounce_rate'),

    newUsers: integer('new_users').notNull().default(0),
    returningUsers: integer('returning_users').notNull().default(0),
    powerUsers: integer('power_users').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_session').on(t.projectId, t.date),
    index('idx_daily_session_project_date').on(t.projectId, t.date),
  ]
);

export type DailySessionMetricsRow = typeof dailySessionMetrics.$inferSelect;
export type NewDailySessionMetricsRow = typeof dailySessionMetrics.$inferInsert;