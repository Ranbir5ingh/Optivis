// src/database/drizzle/schema/daily-form-metrics.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const dailyFormMetrics = pgTable(
  'daily_form_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    formId: text('form_id').notNull(),

    componentId: text('component_id'),

    starts: integer('starts').notNull().default(0),
    submits: integer('submits').notNull().default(0),
    abandons: integer('abandons').notNull().default(0),
    errors: integer('errors').notNull().default(0),

    completionRate: doublePrecision('completion_rate').notNull(),
    abandonRate: doublePrecision('abandon_rate').notNull(),
    errorRate: doublePrecision('error_rate').notNull(),

    avgTimeToSubmitMs: doublePrecision('avg_time_to_submit_ms'),
    avgTimeToAbandonMs: doublePrecision('avg_time_to_abandon_ms'),

    avgFieldsInteracted: doublePrecision('avg_fields_interacted'),

    abandonRateP25: doublePrecision('abandon_rate_p25'),
    abandonRateP50: doublePrecision('abandon_rate_p50'),
    abandonRateP75: doublePrecision('abandon_rate_p75'),
    abandonRateP90: doublePrecision('abandon_rate_p90'),
    abandonRateP99: doublePrecision('abandon_rate_p99'),

    completionRateP25: doublePrecision('completion_rate_p25'),
    completionRateP50: doublePrecision('completion_rate_p50'),
    completionRateP75: doublePrecision('completion_rate_p75'),
    completionRateP90: doublePrecision('completion_rate_p90'),
    completionRateP99: doublePrecision('completion_rate_p99'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_form').on(t.projectId, t.date, t.formId),
    index('idx_daily_form_project_date').on(t.projectId, t.date),
    index('idx_daily_form_id').on(t.projectId, t.formId, t.date),
  ]
);

export type DailyFormMetricsRow = typeof dailyFormMetrics.$inferSelect;
export type NewDailyFormMetricsRow = typeof dailyFormMetrics.$inferInsert;