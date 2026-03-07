// src/database/drizzle/schema/funnel-metrics.schema.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision, 
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { unique } from 'drizzle-orm/pg-core';

export const funnelMetrics = pgTable(
  'funnel_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    funnelName: text('funnel_name').notNull(),
    stepIndex: integer('step_index').notNull(),
    stepName: text('step_name').notNull(),

    // Journey metrics
    enteredCount: integer('entered_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    dropOffRate: doublePrecision('drop_off_rate').notNull(), // ✅ CHANGED

    avgTimeMs: doublePrecision('avg_time_ms'), // ✅ CHANGED

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_funnel_metrics').on(
      t.projectId,
      t.date,
      t.funnelName,
      t.stepIndex,
    ),
    index('idx_funnel_metrics_project').on(t.projectId, t.funnelName, t.date),
    index('idx_funnel_metrics_step').on(
      t.projectId,
      t.funnelName,
      t.stepIndex,
      t.date,
    ),
  ],
);

export type FunnelMetricsRow = typeof funnelMetrics.$inferSelect;
export type NewFunnelMetricsRow = typeof funnelMetrics.$inferInsert;
