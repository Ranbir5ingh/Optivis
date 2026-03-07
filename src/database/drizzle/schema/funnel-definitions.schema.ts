import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export interface FunnelStep {
  index: number;
  name: string;
  paths: string[];
  timeoutMinutes?: number;
}

export const funnelDefinitions = pgTable(
  'funnel_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),

    // Array of funnel steps
    steps: jsonb('steps').$type<FunnelStep[]>().notNull(),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_funnel_def_project').on(t.projectId, t.isActive),
    index('idx_funnel_def_name').on(t.projectId, t.name),
  ]
);

export type FunnelDefinitionRow = typeof funnelDefinitions.$inferSelect;
export type NewFunnelDefinitionRow = typeof funnelDefinitions.$inferInsert;