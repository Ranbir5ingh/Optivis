// src/database/drizzle/schema/insights-cursor.schema.ts

import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
  integer,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const insightsCursor = pgTable(
  'insights_cursor',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    processedWindow: timestamp('processed_window', { withTimezone: true }).notNull(),

    lastProcessedAt: timestamp('last_processed_at', { withTimezone: true }).notNull(),

    retryCount: integer('retry_count').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_insights_cursor').on(t.projectId),
    index('idx_insights_cursor_project').on(t.projectId),
    index('idx_insights_cursor_window').on(t.processedWindow),
  ]
);

export type InsightsCursorRow = typeof insightsCursor.$inferSelect;
export type NewInsightsCursorRow = typeof insightsCursor.$inferInsert;