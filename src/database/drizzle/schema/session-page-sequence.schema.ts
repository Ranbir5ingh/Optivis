// src/database/drizzle/schema/session-page-sequence.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export interface PageVisit {
  path: string;
  occurredAt: string;
}

export const sessionPageSequence = pgTable(
  'session_page_sequence',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    sessionId: text('session_id').notNull(),
    visitorId: text('visitor_id').notNull(),

    pageVisits: jsonb('page_visits').$type<PageVisit[]>().notNull(),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_session_sequence').on(t.projectId, t.sessionId),
    index('idx_session_seq_project').on(t.projectId, t.startedAt),
    index('idx_session_seq_session').on(t.sessionId),
  ]
);

export type SessionPageSequenceRow = typeof sessionPageSequence.$inferSelect;
export type NewSessionPageSequenceRow = typeof sessionPageSequence.$inferInsert;