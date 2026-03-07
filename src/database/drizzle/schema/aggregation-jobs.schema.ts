// src/database/drizzle/schema/aggregation-jobs.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const aggregationJobs = pgTable(
  'aggregation_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    pipeline: text('pipeline').notNull(),

    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),

    status: text('status').notNull().default('pending'),

    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    lastError: text('last_error'),

    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_aggregation_jobs_project_status').on(t.projectId, t.status),
    index('idx_aggregation_jobs_pipeline').on(t.projectId, t.pipeline, t.status),
    index('idx_aggregation_jobs_next_retry').on(t.nextRetryAt),
    index('idx_aggregation_jobs_pending').on(t.status, t.nextRetryAt, t.createdAt),
  ],
);

export type AggregationJobRow = typeof aggregationJobs.$inferSelect;
export type NewAggregationJobRow = typeof aggregationJobs.$inferInsert;