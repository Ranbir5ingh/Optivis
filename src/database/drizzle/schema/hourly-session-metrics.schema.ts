// src/database/drizzle/schema/hourly-session-metrics.schema.ts

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

export const hourlySessionMetrics = pgTable(
  'hourly_session_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    hour: timestamp('hour', { withTimezone: true }).notNull(),

    sessions: integer('sessions').notNull().default(0),
    bouncedSessions: integer('bounced_sessions').notNull().default(0),
    bounceRate: doublePrecision('bounce_rate'),

    avgSessionDurationMs: doublePrecision('avg_session_duration_ms'),
    sessionDurationSum: doublePrecision('session_duration_sum').notNull().default(0),
    sessionDurationCount: integer('session_duration_count').notNull().default(0),

    newUsers: integer('new_users').notNull().default(0),
    returningUsers: integer('returning_users').notNull().default(0),
    powerUsers: integer('power_users').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_hourly_session').on(t.projectId, t.hour),
    index('idx_hourly_session_project_hour').on(t.projectId, t.hour),
  ]
);

export type HourlySessionMetricsRow = typeof hourlySessionMetrics.$inferSelect;
export type NewHourlySessionMetricsRow = typeof hourlySessionMetrics.$inferInsert;