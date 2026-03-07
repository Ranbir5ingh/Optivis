// src/database/drizzle/schema/ai-reasoning-jobs.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const aiReasoningJobs = pgTable(
  'ai_reasoning_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    status: text('status').notNull().default('pending'),

    triggerType: text('trigger_type').notNull(),

    insightSnapshotHash: text('insight_snapshot_hash').notNull(),

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
    index('idx_ai_reasoning_jobs_project_status').on(t.projectId, t.status),
    index('idx_ai_reasoning_jobs_next_retry').on(t.nextRetryAt),
    index('idx_ai_reasoning_jobs_pending').on(t.status, t.nextRetryAt, t.createdAt),
  ],
);

export type AIReasoningJobRow = typeof aiReasoningJobs.$inferSelect;
export type NewAIReasoningJobRow = typeof aiReasoningJobs.$inferInsert;