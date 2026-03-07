// src/database/drizzle/schema/evolution-jobs.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const evolutionJobs = pgTable(
  'evolution_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    instanceId: uuid('instance_id').notNull(),
    jobType: text('job_type').notNull(),

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
    index('idx_evolution_jobs_project_status').on(t.projectId, t.status),
    index('idx_evolution_jobs_instance').on(t.instanceId),
    index('idx_evolution_jobs_type').on(t.jobType, t.status),
    index('idx_evolution_jobs_next_retry').on(t.nextRetryAt),
    index('idx_evolution_jobs_pending').on(
      t.status,
      t.nextRetryAt,
      t.createdAt,
    ),
  ],
);

export type EvolutionJobRow = typeof evolutionJobs.$inferSelect;
export type NewEvolutionJobRow = typeof evolutionJobs.$inferInsert;