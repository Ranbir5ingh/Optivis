// src/database/drizzle/schema/evolution-cursor.schema.ts

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

export const evolutionCursor = pgTable(
  'evolution_cursor',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    pipeline: text('pipeline').notNull(),

    processedWindow: timestamp('processed_window', { withTimezone: true })
      .notNull(),

    lastProcessedAt: timestamp('last_processed_at', { withTimezone: true })
      .notNull(),

    retryCount: integer('retry_count').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_evolution_cursor').on(t.projectId, t.pipeline),
    index('idx_evolution_cursor_project').on(t.projectId),
    index('idx_evolution_cursor_window').on(t.processedWindow),
  ],
);

export type EvolutionCursorRow = typeof evolutionCursor.$inferSelect;
export type NewEvolutionCursorRow = typeof evolutionCursor.$inferInsert;