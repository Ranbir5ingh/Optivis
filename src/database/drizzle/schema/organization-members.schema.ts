import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.schema";
import { users } from "./users.schema";
import { text } from "drizzle-orm/pg-core";
import { unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";


export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    role: text('role').notNull(), // owner | admin | member (enum later)

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
     unique("unique_member").on(t.organizationId, t.userId),
     index("org_members_org_user_idx").on(
      t.organizationId,
      t.userId
     ),
     index("org_members_user_idx").on(
      t.userId
     ),
  ],
);

export const organizationMemberRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);

export type NewOrganizationMemberRow = typeof organizationMembers.$inferInsert
export type OrganizationMemberRow = typeof organizationMembers.$inferSelect
