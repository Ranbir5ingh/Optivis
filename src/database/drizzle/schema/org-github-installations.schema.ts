// src/database/drizzle/schema/org-github-installations.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations.schema';
import { sql } from 'drizzle-orm';

export const orgGithubInstallations = pgTable(
  'org_github_installations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id')
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    installationId: text('installation_id').notNull(),

    connectedAt: timestamp('connected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  },
  (t) => [
    unique('unique_org_installation').on(t.organizationId),
    index('idx_org_installation_org').on(t.organizationId),
    index('idx_org_installation_active')
      .on(t.organizationId)
      .where(sql`${t.disconnectedAt} IS NULL`),
  ],
);

export type OrgGithubInstallationRow =
  typeof orgGithubInstallations.$inferSelect;
export type NewOrgGithubInstallationRow =
  typeof orgGithubInstallations.$inferInsert;