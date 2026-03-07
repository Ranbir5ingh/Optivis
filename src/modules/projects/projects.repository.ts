// src/modules/projects/projects.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  NewProjectRow,
  ProjectRow,
  projects,
} from 'src/database/drizzle/schema';
import { ProjectStatus } from './domain/project.model';

@Injectable()
export class ProjectsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async findById(projectId: string): Promise<ProjectRow | null> {
    const [row] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    return row ?? null;
  }

  async findBySlugInOrg(
    organizationId: string,
    slug: string,
  ): Promise<ProjectRow | null> {
    const [row] = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(projects.slug, slug),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async createProject(
    data: NewProjectRow,
    tx: NodePgDatabase = this.db,
  ): Promise<ProjectRow> {
    const [created] = await tx.insert(projects).values(data).returning();
    return created;
  }

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      websiteUrl?: string;
      status?: ProjectStatus;
    },
  ): Promise<ProjectRow> {
    const [updated] = await this.db
      .update(projects)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.websiteUrl && { websiteUrl: data.websiteUrl }),
        ...(data.status && { status: data.status }),
        updatedAt: sql`now()`,
      })
      .where(eq(projects.id, projectId))
      .returning();

    return updated;
  }

  async listByOrganization(
    organizationId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: ProjectRow[]; total: number }> {
    const rows = await this.db
      .select({
        projects: projects,
        totalCount: sql<number>`COUNT(*) OVER()`.as('total_count'),
      })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map(({ projects: p }) => p),
      total: rows[0]?.totalCount ?? 0,
    };
  }

  async updateStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.db
      .update(projects)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(projects.id, projectId));
  }
}
