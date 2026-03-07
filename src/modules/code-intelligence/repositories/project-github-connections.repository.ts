// src/modules/code-intelligence/repositories/project-github-connections.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  projectGithubConnections,
  ProjectGithubConnectionRow,
  NewProjectGithubConnectionRow,
  orgGithubInstallations,
} from 'src/database/drizzle/schema';

export interface ProjectGithubConnectionWithInstallation {
  id: string;
  projectId: string;
  orgInstallationId: string;
  installationId: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  connectedAt: Date;
}

@Injectable()
export class ProjectGithubConnectionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(
    data: NewProjectGithubConnectionRow,
  ): Promise<ProjectGithubConnectionRow> {
    const [row] = await this.db
      .insert(projectGithubConnections)
      .values(data)
      .returning();
    return row;
  }

  async getActiveForProject(
    projectId: string,
  ): Promise<ProjectGithubConnectionRow | null> {
    console.log(projectId)
    const [row] = await this.db
      .select()
      .from(projectGithubConnections)
      .where(
        and(
          eq(projectGithubConnections.projectId, projectId),
          isNull(projectGithubConnections.disconnectedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getActiveForProjectWithInstallation(
    projectId: string,
  ): Promise<ProjectGithubConnectionWithInstallation | null> {
    const [row] = await this.db
      .select({
        id: projectGithubConnections.id,
        projectId: projectGithubConnections.projectId,
        orgInstallationId: projectGithubConnections.orgInstallationId,
        installationId: orgGithubInstallations.installationId,
        repoOwner: projectGithubConnections.repoOwner,
        repoName: projectGithubConnections.repoName,
        defaultBranch: projectGithubConnections.defaultBranch,
        connectedAt: projectGithubConnections.connectedAt,
      })
      .from(projectGithubConnections)
      .innerJoin(
        orgGithubInstallations,
        eq(
          projectGithubConnections.orgInstallationId,
          orgGithubInstallations.id,
        ),
      )
      .where(
        and(
          eq(projectGithubConnections.projectId, projectId),
          isNull(projectGithubConnections.disconnectedAt),
          isNull(orgGithubInstallations.disconnectedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async updateRepositorySelection(
    projectId: string,
    data: {
      repoOwner: string;
      repoName: string;
      defaultBranch: string;
    },
  ): Promise<void> {
    await this.db
      .update(projectGithubConnections)
      .set(data)
      .where(eq(projectGithubConnections.projectId, projectId));
  }

  async disconnect(projectId: string): Promise<void> {
    await this.db
      .update(projectGithubConnections)
      .set({ disconnectedAt: new Date() })
      .where(eq(projectGithubConnections.projectId, projectId));
  }
}