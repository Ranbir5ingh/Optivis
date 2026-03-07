import {
  pgTable,
  uuid,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const projectSettings = pgTable(
  'project_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Sampling configuration
    sessionSampleRate: doublePrecision('session_sample_rate')
      .notNull()
      .default(1), // 100% default

    // Retention configuration (days)
    rawEventsRetentionDays: integer('raw_events_retention_days')
      .notNull()
      .default(30),
    
    sessionMetricsRetentionDays: integer('session_metrics_retention_days')
      .notNull()
      .default(7),
    
    hourlySummariesRetentionDays: integer('hourly_summaries_retention_days')
      .notNull()
      .default(90),

    // Feature flags
    enableAutoAggregation: boolean('enable_auto_aggregation')
      .notNull()
      .default(true),
    
    enableInsights: boolean('enable_insights')
      .notNull()
      .default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_project_settings_project').on(t.projectId),
  ]
);

export type ProjectSettingsRow = typeof projectSettings.$inferSelect;
export type NewProjectSettingsRow = typeof projectSettings.$inferInsert;