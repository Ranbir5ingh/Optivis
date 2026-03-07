// src/database/drizzle/schema/project-github-connections.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { orgGithubInstallations } from './org-github-installations.schema';
import { sql } from 'drizzle-orm';

export const projectGithubConnections = pgTable(
  'project_github_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),

    orgInstallationId: uuid('org_installation_id')
      .notNull()
      .references(() => orgGithubInstallations.id, { onDelete: 'cascade' }),

    repoOwner: text('repo_owner').notNull(),
    repoName: text('repo_name').notNull(),
    defaultBranch: text('default_branch').notNull().default('main'),

    connectedAt: timestamp('connected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_connection_project').on(t.projectId),
    index('idx_connection_org_installation').on(t.orgInstallationId),
    index('idx_connection_active')
      .on(t.projectId)
      .where(sql`${t.disconnectedAt} IS NULL`),
  ],
);

export type ProjectGithubConnectionRow =
  typeof projectGithubConnections.$inferSelect;
export type NewProjectGithubConnectionRow =
  typeof projectGithubConnections.$inferInsert;