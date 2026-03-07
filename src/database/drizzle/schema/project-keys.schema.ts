import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { relations, sql } from 'drizzle-orm';

export const projectKeys = pgTable(
  'project_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    key: text('key').notNull().unique(),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('project_keys_key_idx').on(t.key).where(sql`${t.isActive} = true`),
    index('project_keys_project_idx').on(t.projectId),
  ],
);

export const projectKeyRelations = relations(projectKeys, ({ one }) => ({
  project: one(projects, {
    fields: [projectKeys.projectId],
    references: [projects.id],
  }),
}));

export type ProjectKeyRow = typeof projectKeys.$inferSelect;
export type NewProjectKeyRow = typeof projectKeys.$inferInsert;