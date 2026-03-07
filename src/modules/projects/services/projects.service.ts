// src/modules/projects/projects.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { ProjectsRepository } from '../projects.repository';
import { ProjectRow, projectSettings } from 'src/database/drizzle/schema';
import { DomainError } from 'src/common/exceptions/domain-error';
import { ProjectModel, ProjectStatus } from '../domain/project.model';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { PaginatedResult } from 'src/shared/types/pagination';
import slugify from 'slugify';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import * as jwt from 'jsonwebtoken';
import { GithubRepoService } from '../../code-intelligence/services/github-repo.service';
import { ProjectKeysService } from '../../project-keys/project-keys.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from '../events/project-created.event';
import { SetupStatusDto } from '../dto/setup-status.dto';
import { TrackingRepository } from '../../tracking/repositories/tracking.repository';
import { CodeMetadataRepository } from '../../code-intelligence/repositories/code-metadata.repository';
import { ProjectGithubConnectionService } from '../../code-intelligence/services/project-github-connection.service';
import { OrgGithubInstallationsService } from '../../code-intelligence/services/org-github-installations.service';
import { UpdateProjectDto } from '../dto/update-project.dto';

interface GithubStatePayload {
  organizationId: string;
  userId: string;
}

export interface ProjectSummaryDto {
  projectId: string;
  sessionsLast7Days: number;
  insightsActive: number;
  recommendationsActive: number;
  healthScore: number;
  healthState: 'healthy' | 'moderate' | 'warning' | 'critical';
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    private readonly projectKeys: ProjectKeysService,
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly githubConnectionService: ProjectGithubConnectionService,
    private readonly orgInstallationsService: OrgGithubInstallationsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly trackingRepo: TrackingRepository,
    private readonly codeMetadataRepo: CodeMetadataRepository,
  ) {}

  private async generateUniqueSlug(
    organizationId: string,
    name: string,
  ): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });

    let slug = base;
    let counter = 1;

    while (await this.repo.findBySlugInOrg(organizationId, slug)) {
      counter++;
      slug = `${base}-${counter}`;
    }

    return slug;
  }

  private ensureActive(project: ProjectRow): void {
    if (project.status === 'archived') {
      throw new DomainError(
        'PROJECT_ARCHIVED',
        'Archived project cannot be modified',
        'conflict',
        { projectId: project.id },
      );
    }
  }

  private toModel(row: ProjectRow): ProjectModel {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      slug: row.slug,
      websiteUrl: row.websiteUrl,
      status: row.status as ProjectStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(params: {
    organizationId: string;
    name: string;
    websiteUrl: string;
  }): Promise<ProjectModel> {
    const slug = await this.generateUniqueSlug(
      params.organizationId,
      params.name,
    );

    return this.db.transaction(async (tx) => {
      const created = await this.repo.createProject({ ...params, slug }, tx);

      await this.projectKeys.createForProject(created.id, tx);

      await tx.insert(projectSettings).values({
        projectId: created.id,
        sessionSampleRate: 1,
        rawEventsRetentionDays: 30,
        sessionMetricsRetentionDays: 7,
        hourlySummariesRetentionDays: 90,
        enableAutoAggregation: true,
        enableInsights: true,
      });

      this.eventEmitter.emit(
        'project.created',
        new ProjectCreatedEvent(created.id),
      );

      return this.toModel(created);
    });
  }

  async getByIdOrThrow(projectId: string): Promise<ProjectModel> {
    const project = await this.repo.findById(projectId);

    if (!project) {
      throw new DomainError(
        'PROJECT_NOT_FOUND',
        'Project not found',
        'not_found',
        { projectId },
      );
    }

    return this.toModel(project);
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectModel> {
    const project = await this.repo.findById(projectId);

    if (!project) {
      throw new DomainError(
        'PROJECT_NOT_FOUND',
        'Project not found',
        'not_found',
        { projectId },
      );
    }

    if (dto.status === 'archived') {
      this.ensureActive(project);
    }

    const updated = await this.repo.updateProject(projectId, {
      name: dto.name,
      websiteUrl: dto.websiteUrl,
      status: dto.status,
    });

    return this.toModel(updated);
  }

  async list(
    organizationId: string,
    pagination: ListProjectsDto,
  ): Promise<PaginatedResult<ProjectModel>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const { total, items } = await this.repo.listByOrganization(
      organizationId,
      pagination.limit,
      offset,
    );

    return {
      items: items.map(this.toModel),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
    };
  }

  async archive(projectId: string): Promise<void> {
    const project = await this.repo.findById(projectId);

    if (!project) {
      throw new DomainError(
        'PROJECT_NOT_FOUND',
        'Project not found',
        'not_found',
        { projectId },
      );
    }

    this.ensureActive(project);
    await this.repo.updateStatus(projectId, 'archived');
  }

  createGithubState(payload: GithubStatePayload): string {
    const secret =
      process.env.GITHUB_APP_STATE_SECRET ||
      process.env.JWT_ACCESS_TOKEN_SECRET;

    if (!secret) {
      throw new Error('GITHUB_APP_STATE_SECRET not configured');
    }

    return jwt.sign(payload, secret, {
      expiresIn: '10m',
    });
  }

  verifyGithubState(state: string): GithubStatePayload {
    const secret =
      process.env.GITHUB_APP_STATE_SECRET ||
      process.env.JWT_ACCESS_TOKEN_SECRET;

    if (!secret) {
      throw new Error('GITHUB_APP_STATE_SECRET not configured');
    }

    try {
      return jwt.verify(state, secret) as GithubStatePayload;
    } catch (error) {
      throw new DomainError(
        'INVALID_GITHUB_STATE',
        'Invalid or expired GitHub state token',
        'unauthorized',
      );
    }
  }

  async storeGithubInstallation(
    organizationId: string,
    installationId: string,
  ): Promise<void> {
    await this.orgInstallationsService.storeInstallation(
      organizationId,
      installationId,
    );
  }

  async listRepositories(organizationId: string): Promise<
    Array<{
      id: number;
      name: string;
      fullName: string;
      defaultBranch: string;
      private: boolean;
      htmlUrl: string;
    }>
  > {
    return this.githubConnectionService.listRepositories(organizationId);
  }

  async listBranches(
    organizationId: string,
    owner: string,
    repo: string,
  ): Promise<
    Array<{
      name: string;
      isDefault: boolean;
      commitSha: string;
    }>
  > {
    return this.githubConnectionService.fetchBranches(
      organizationId,
      owner,
      repo,
    );
  }

  async selectRepository(
    projectId: string,
    organizationId: string,
    data: { owner: string; name: string; defaultBranch: string },
  ): Promise<void> {
    if (!data.owner || !data.name) {
      throw new DomainError(
        'INVALID_REPO_SELECTION',
        'Repository owner and name are required',
        'validation',
      );
    }

    await this.githubConnectionService.selectRepository(
      projectId,
      organizationId,
      data,
    );
  }

  async getGithubConnectionStatus(
    projectId: string,
    organizationId: string,
  ): Promise<{
    isInstallationConnected: boolean;
    hasRepositorySelected: boolean;
    repository: { owner: string; name: string; branch: string } | null;
  }> {
    return this.githubConnectionService.getConnectionStatus(
      projectId,
      organizationId,
    );
  }

  async getGithubConnection(projectId: string) {
    return this.githubConnectionService.getConnection(projectId);
  }

  async disconnectGithub(projectId: string): Promise<void> {
    await this.githubConnectionService.disconnectRepository(projectId);
  }

  async getSetupStatus(
    projectId: string,
    organizationId: string,
  ): Promise<SetupStatusDto> {
    const [hasSdkEvents, connectionStatus, hasCodeManifest] = await Promise.all(
      [
        this.trackingRepo.hasAnyEvent(projectId),
        this.githubConnectionService.getConnectionStatus(
          projectId,
          organizationId,
        ),
        this.codeMetadataRepo.getLatestForProject(projectId).then((m) => !!m),
      ],
    );

    const hasGithubRepo = connectionStatus.hasRepositorySelected;
    const hasMinimumSessions = false;
    const setupCompleted = hasSdkEvents && hasGithubRepo && hasCodeManifest;

    return {
      hasSdkEvents,
      hasGithubRepo,
      hasCodeManifest,
      hasMinimumSessions,
      setupCompleted,
    };
  }
}
