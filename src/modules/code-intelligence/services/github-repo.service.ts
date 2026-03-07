import { Injectable } from '@nestjs/common';
import { GithubAuthService } from './github-auth.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import { GitHubBranch } from '../domain/github.model';

/**
 * GitHub Repository Service
 *
 * Responsibility: Fetch code and repo info from GitHub using installation tokens
 * Does NOT store tokens - generates them on-demand
 * Always uses least-privilege scope (read-only)
 */
@Injectable()
export class GithubRepoService {
  constructor(private readonly githubAuth: GithubAuthService) {}

  /**
   * Fetch repository information from GitHub
   * Returns: owner, name, default branch
   */
  async fetchRepoInfo(installationId: string): Promise<{
    owner: string;
    name: string;
    defaultBranch: string;
  }> {
    try {
      const token = await this.githubAuth.getInstallationToken(installationId);

      // Get installation repositories
      const response = await fetch(
        'https://api.github.com/installation/repositories',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch repositories: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        repositories: Array<{
          owner: { login: string };
          name: string;
          default_branch: string;
        }>;
      };

      if (!data.repositories || data.repositories.length === 0) {
        throw new Error('No repositories found in GitHub installation');
      }

      // Return first repo (v1: one repo per project)
      const repo = data.repositories[0];

      return {
        owner: repo.owner.login,
        name: repo.name,
        defaultBranch: repo.default_branch || 'main',
      };
    } catch (error) {
      throw new DomainError(
        'GITHUB_REPO_FETCH_FAILED',
        `Failed to fetch GitHub repository info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }

  async listRepositories(installationId: string): Promise<
    Array<{
      id: number;
      name: string;
      fullName: string;
      defaultBranch: string;
      private: boolean;
      htmlUrl: string;
    }>
  > {
    try {
      const token = await this.githubAuth.getInstallationToken(installationId);

      const response = await fetch(
        'https://api.github.com/installation/repositories?per_page=100',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch repositories: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        repositories: Array<{
          id: number;
          name: string;
          full_name: string;
          default_branch: string;
          private: boolean;
          html_url: string;
        }>;
      };

      return data.repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: repo.private,
        htmlUrl: repo.html_url,
      }));
    } catch (error) {
      throw new DomainError(
        'GITHUB_REPOSITORIES_FETCH_FAILED',
        `Failed to fetch GitHub repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }


  async fetchBranches(
    installationId: string,
    owner: string,
    repo: string,
  ): Promise<GitHubBranch[]> {
    try {
      const token = await this.githubAuth.getInstallationToken(installationId);

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new DomainError(
            'REPO_NOT_FOUND',
            `Repository not found: ${owner}/${repo}`,
            'not_found',
          );
        }
        throw new Error(
          `Failed to fetch branches: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as Array<{
        name: string;
        commit: { sha: string };
        protected: boolean;
      }>;

      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from GitHub API');
      }

      return data.map((branch) => ({
        name: branch.name,
        isDefault: false,
        commitSha: branch.commit.sha,
      }));
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new DomainError(
        'GITHUB_BRANCHES_FETCH_FAILED',
        `Failed to fetch branches from GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }

  /**
   * Fetch single file from repository
   * Returns: file contents as string
   */
  async fetchFile(
    installationId: string,
    owner: string,
    repo: string,
    filePath: string,
    ref: string = 'HEAD',
  ): Promise<string> {
    try {
      const token = await this.githubAuth.getInstallationToken(installationId);

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.raw+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new DomainError(
            'FILE_NOT_FOUND',
            `File not found: ${filePath}`,
            'not_found',
          );
        }
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`,
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof DomainError) throw error;

      throw new DomainError(
        'GITHUB_FILE_FETCH_FAILED',
        `Failed to fetch file from GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }
}
