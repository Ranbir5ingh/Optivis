// src/database/drizzle/schema/ai-reasoning-cursor.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
  integer,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const aiReasoningCursor = pgTable(
  'ai_reasoning_cursor',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    processedHash: text('processed_hash').notNull(),

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
    unique('unique_ai_reasoning_cursor').on(t.projectId),
    index('idx_ai_reasoning_cursor_project').on(t.projectId),
  ],
);

export type AIReasoningCursorRow = typeof aiReasoningCursor.$inferSelect;
export type NewAIReasoningCursorRow = typeof aiReasoningCursor.$inferInsert;