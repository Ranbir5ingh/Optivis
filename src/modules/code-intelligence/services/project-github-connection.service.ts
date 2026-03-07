// src/modules/code-intelligence/services/project-github-connection.service.ts
import { Injectable } from '@nestjs/common';
import { GithubRepoService } from './github-repo.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import { ProjectGithubConnectionRepository } from '../repositories/project-github-connections.repository';
import { GithubAuthService } from './github-auth.service';
import {
  GitHubBranch,
  ProjectGithubConnection,
  ProjectGithubConnectionStatus,
} from '../domain/github.model';
import { OrgGithubInstallationsService } from './org-github-installations.service';
import { OrgGithubInstallationsRepository } from '../repositories/org-github-installations.repository';
import { ProjectGithubConnectionRow } from 'src/database/drizzle/schema';

@Injectable()
export class ProjectGithubConnectionService {
  constructor(
    private readonly connectionRepo: ProjectGithubConnectionRepository,
    private readonly orgInstallationsService: OrgGithubInstallationsService,
    private readonly orgInstallationsRepo: OrgGithubInstallationsRepository,
    private readonly githubRepoService: GithubRepoService,
    private readonly githubAuth: GithubAuthService,
  ) {}

  private toModel(row: ProjectGithubConnectionRow): ProjectGithubConnection {
    return {
      id: row.id,
      projectId: row.projectId,
      orgInstallationId: row.orgInstallationId,
      repoOwner: row.repoOwner,
      repoName: row.repoName,
      defaultBranch: row.defaultBranch,
      connectedAt: row.connectedAt,
    };
  }

  async selectRepository(
    projectId: string,
    organizationId: string,
    data: {
      owner: string;
      name: string;
      defaultBranch: string;
    },
  ): Promise<ProjectGithubConnection> {
    const orgInstallation =
      await this.orgInstallationsService.getActiveInstallation(organizationId);

    if (!orgInstallation) {
      throw new DomainError(
        'NO_ORG_INSTALLATION',
        'GitHub App not installed for organization. Please install it first.',
        'validation',
        { organizationId },
      );
    }

    let connection = await this.connectionRepo.getActiveForProject(projectId);

    if (!connection) {
      connection = await this.connectionRepo.create({
        projectId,
        orgInstallationId: orgInstallation.id,
        repoOwner: '',
        repoName: '',
        defaultBranch: 'main',
      });
    } else if (connection.orgInstallationId !== orgInstallation.id) {
      await this.connectionRepo.disconnect(projectId);
      connection = await this.connectionRepo.create({
        projectId,
        orgInstallationId: orgInstallation.id,
        repoOwner: '',
        repoName: '',
        defaultBranch: 'main',
      });
    }

    const repositories = await this.githubRepoService.listRepositories(
      orgInstallation.installationId,
    );

    const selectedRepo = repositories.find(
      (r) => r.fullName === `${data.owner}/${data.name}`,
    );

    if (!selectedRepo) {
      throw new DomainError(
        'REPOSITORY_NOT_FOUND',
        'Repository not found in GitHub installation',
        'not_found',
        { owner: data.owner, name: data.name },
      );
    }

    await this.connectionRepo.updateRepositorySelection(projectId, {
      repoOwner: data.owner,
      repoName: data.name,
      defaultBranch: data.defaultBranch || 'main',
    });

    const updated = await this.connectionRepo.getActiveForProject(projectId);

    if (!updated) {
      throw new DomainError(
        'UPDATE_FAILED',
        'Failed to update repository selection',
        'unexpected',
      );
    }

    return this.toModel(updated);
  }

  async getConnectionStatus(
    projectId: string,
    organizationId: string,
  ): Promise<ProjectGithubConnectionStatus> {
    const connection = await this.connectionRepo.getActiveForProject(projectId);
    const orgInstallation =
      await this.orgInstallationsService.getActiveInstallation(organizationId);

    const isInstallationConnected = !!orgInstallation;
    const hasRepositorySelected =
      !!connection &&
      !!connection.repoOwner &&
      !!connection.repoName &&
      connection.repoOwner.length > 0 &&
      connection.repoName.length > 0;

    return {
      isInstallationConnected,
      hasRepositorySelected,
      repository: hasRepositorySelected
        ? {
            owner: connection!.repoOwner,
            name: connection!.repoName,
            branch: connection!.defaultBranch,
          }
        : null,
    };
  }

  async getConnection(
    projectId: string,
  ): Promise<ProjectGithubConnection | null> {
    const connection = await this.connectionRepo.getActiveForProject(projectId);
    return connection ? this.toModel(connection) : null;
  }

  async getConnectionWithInstallation(projectId: string) {
    return this.connectionRepo.getActiveForProjectWithInstallation(projectId);
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
    const orgInstallation =
      await this.orgInstallationsService.getActiveInstallation(organizationId);

    if (!orgInstallation) {
      throw new DomainError(
        'NO_ORG_INSTALLATION',
        'GitHub App not installed for organization',
        'validation',
      );
    }

    return this.githubRepoService.listRepositories(
      orgInstallation.installationId,
    );
  }

  async fetchBranches(
    organizationId: string,
    owner: string,
    repo: string,
  ): Promise<GitHubBranch[]> {
    const orgInstallation =
      await this.orgInstallationsService.getActiveInstallation(organizationId);

    if (!orgInstallation) {
      throw new DomainError(
        'GITHUB_NOT_INSTALLED',
        'GitHub App not installed for organization',
        'validation',
      );
    }

    const branches = await this.githubRepoService.fetchBranches(
      orgInstallation.installationId,
      owner,
      repo,
    );

    return branches;
  }

  async disconnectRepository(projectId: string): Promise<void> {
    await this.connectionRepo.disconnect(projectId);
  }
}
