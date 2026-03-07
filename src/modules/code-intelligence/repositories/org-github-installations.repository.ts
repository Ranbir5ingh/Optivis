// src/modules/code-intelligence/repositories/org-github-installations.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  orgGithubInstallations,
  OrgGithubInstallationRow,
  NewOrgGithubInstallationRow,
} from 'src/database/drizzle/schema';

@Injectable()
export class OrgGithubInstallationsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(
    data: NewOrgGithubInstallationRow,
  ): Promise<OrgGithubInstallationRow> {
    const [row] = await this.db
      .insert(orgGithubInstallations)
      .values(data)
      .returning();
    return row;
  }

  async getActiveForOrg(
    organizationId: string,
  ): Promise<OrgGithubInstallationRow | null> {
    const [row] = await this.db
      .select()
      .from(orgGithubInstallations)
      .where(
        and(
          eq(orgGithubInstallations.organizationId, organizationId),
          isNull(orgGithubInstallations.disconnectedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getByOrganizationId(
    organizationId: string,
  ): Promise<OrgGithubInstallationRow | null> {
    const [row] = await this.db
      .select()
      .from(orgGithubInstallations)
      .where(eq(orgGithubInstallations.organizationId, organizationId))
      .limit(1);
    return row ?? null;
  }

  async disconnect(organizationId: string): Promise<void> {
    await this.db
      .update(orgGithubInstallations)
      .set({ disconnectedAt: new Date() })
      .where(eq(orgGithubInstallations.organizationId, organizationId));
  }
}