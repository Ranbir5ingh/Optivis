import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { organizations } from 'src/database/drizzle/schema';
import {
  NewOrganizationMemberRow,
  OrganizationMemberRow,
  organizationMembers,
} from 'src/database/drizzle/schema/organization-members.schema';

@Injectable()
export class OrganizationMembersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async addMember(
    data: NewOrganizationMemberRow,
    tx: NodePgDatabase = this.db,
  ): Promise<void> {
    await tx.insert(organizationMembers).values(data);
  }

  async findMembership(
    orgId: string,
    userId: string,
  ): Promise<OrganizationMemberRow | null> {
    const [row] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listOrganizationsForUser(
    userId: string,
    limit: number,
    offset: number,
  ) {
    const rows = await this.db
      .select({
        org: organizations,
        role: organizationMembers.role,
        totalCount: sql<number>`COUNT(*) OVER()`.as('total_count'),
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(eq(organizationMembers.userId, userId))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map(({ org, role }) => ({ org, role })),
      total: rows[0]?.totalCount ?? 0,
    };
  }
}
