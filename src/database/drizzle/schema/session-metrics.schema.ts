// src/database/drizzle/schema/session-metrics.schema.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const sessionMetrics = pgTable(
  'session_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id').notNull(),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    durationMs: integer('duration_ms').notNull(),

    pageCount: integer('page_count').notNull().default(1),
    entryPath: text('entry_path'),
    exitPath: text('exit_path'),

    totalClicks: integer('total_clicks').notNull().default(0),
    maxScrollDepth: doublePrecision('max_scroll_depth').notNull().default(0),
    hasScrolled: boolean('has_scrolled').notNull().default(false),

    bounced: boolean('bounced').notNull().default(false),

    deviceType: text('device_type'),
    userCohort: text('user_cohort'),

    formsStarted: integer('forms_started').default(0),
    formsCompleted: integer('forms_completed').default(0),
    formAbandons: integer('form_abandons').default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_session_per_project').on(t.projectId, t.sessionId),
    index('idx_session_project_id').on(t.projectId, t.sessionId),
    index('idx_session_visitor_id').on(t.projectId, t.visitorId),
    index('idx_session_ended_at').on(t.projectId, t.endedAt),
    index('idx_session_cohort').on(t.projectId, t.userCohort),
  ]
);

export type SessionMetricsRow = typeof sessionMetrics.$inferSelect;
export type NewSessionMetricsRow = typeof sessionMetrics.$inferInsert;