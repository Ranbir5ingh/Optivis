// src/database/drizzle/schema/aggregation-cursor.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { unique } from 'drizzle-orm/pg-core';

/**
 * Tracks aggregation progress per pipeline
 * Enables independent, idempotent aggregation jobs
 */
export const aggregationCursor = pgTable(
  'aggregation_cursor',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Pipeline name (replaces aggregationType)
    pipeline: text('pipeline').notNull(),
    // Values: 'hourly_summary', 'daily_component_metrics', 'daily_element_metrics', 
    //         'daily_session_metrics', 'daily_funnel_metrics'

    // The actual window that was processed (deterministic)
    processedWindow: timestamp('processed_window', { withTimezone: true }).notNull(),

    // Last timestamp we successfully processed up to
    lastProcessedAt: timestamp('last_processed_at', { withTimezone: true }).notNull(),

    // Retry tracking
    retryCount: integer('retry_count').notNull().default(0),

    // When this cursor was last updated
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_cursor_project_pipeline').on(t.projectId, t.pipeline),
    index('idx_cursor_window').on(t.processedWindow),
    unique('unique_cursor').on(t.projectId, t.pipeline), 
  ]
);

export type AggregationCursorRow = typeof aggregationCursor.$inferSelect;
export type NewAggregationCursorRow = typeof aggregationCursor.$inferInsert;