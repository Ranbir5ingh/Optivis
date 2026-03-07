// src/modules/evolution/services/github-integration.service.ts
// ✅ FIXED: Replace entire files instead of parsing diffs

import { Injectable, Logger } from '@nestjs/common';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';
import { ProjectGithubConnectionService } from 'src/modules/code-intelligence/services/project-github-connection.service';
import { GithubAuthService } from 'src/modules/code-intelligence/services/github-auth.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import { RecommendationInstanceRow } from 'src/database/drizzle/schema';

interface FileUpdate {
  filePath: string;
  updatedContent: string;
}

@Injectable()
export class GithubIntegrationService {
  private readonly logger = new Logger(GithubIntegrationService.name);

  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly jobsRepo: EvolutionJobsRepository,
    private readonly connectionService: ProjectGithubConnectionService,
    private readonly githubAuth: GithubAuthService,
  ) {}

  /**
   * Create a pull request with the generated patch
   *
   * ✅ FIXED: Uses full file replacement instead of diff parsing
   *
   * Flow:
   * 1. Get file updates from stored patch (JSON format)
   * 2. Create/verify branch exists
   * 3. Replace each file atomically using GitHub Contents API
   * 4. Create PR pointing to the updated branch
   */
  async createPullRequest(instanceId: string): Promise<void> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    if (instance.status !== 'patch_generated') {
      throw new DomainError(
        'INVALID_STATUS',
        `Cannot create PR in ${instance.status} status`,
        'conflict',
      );
    }

    if (!instance.diffContent) {
      throw new DomainError(
        'NO_PATCH',
        'No patch available for PR creation',
        'validation',
      );
    }

    const connection =
      await this.connectionService.getConnectionWithInstallation(
        instance.projectId,
      );

    if (!connection) {
      throw new DomainError(
        'GITHUB_NOT_CONNECTED',
        'GitHub repository not connected',
        'forbidden',
      );
    }

    try {
      // Parse the file updates from stored patch (JSON format)
      const fileUpdates = this.parseFileUpdates(instance.diffContent);

      const branchName = `webruit/rec-${instance.id.substring(0, 8)}`;
      const title = `[Webruit] Apply Recommendation - ${instance.recommendationSnapshot.title}`;
      const body = this.buildPRBody(instance);

      const token = await this.githubAuth.getInstallationToken(
        connection.installationId,
      );

      // Create or verify branch exists
      await this.ensureBranchExists(
        token,
        connection.repoOwner,
        connection.repoName,
        branchName,
        connection.defaultBranch,
      );

      // Replace each file atomically
      for (const file of fileUpdates) {
        await this.replaceFile(
          token,
          connection.repoOwner,
          connection.repoName,
          branchName,
          file.filePath,
          file.updatedContent,
        );
      }

      // Create the pull request
      const prData = await this.createPRRequest(
        token,
        connection.repoOwner,
        connection.repoName,
        connection.defaultBranch,
        branchName,
        title,
        body,
      );

      await this.instancesRepo.updateStatus(instanceId, 'pr_created', {
        prCreatedAt: new Date(),
        prUrl: prData.htmlUrl,
        prNumber: String(prData.number),
      });

      this.logger.log(
        `✅ Created PR for instance ${instanceId}: ${prData.htmlUrl}`,
      );
    } catch (error) {
      throw new DomainError(
        'PR_CREATION_FAILED',
        `Failed to create PR: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'unexpected',
      );
    }
  }

  /**
   * Parse file updates from stored JSON patch
   */
  private parseFileUpdates(diffContent: string): FileUpdate[] {
    try {
      const parsed = JSON.parse(diffContent);
      return parsed.files || [];
    } catch (error) {
      throw new Error(
        `Failed to parse file updates: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Ensure branch exists, create if it doesn't
   * ✅ IDEMPOTENT: Safely handles retries
   */
  private async ensureBranchExists(
    token: string,
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string,
  ): Promise<void> {
    // Check if branch already exists
    const branchExists = await this.branchExists(
      token,
      owner,
      repo,
      branchName,
    );

    if (branchExists) {
      this.logger.debug(
        `Branch ${branchName} already exists, skipping creation`,
      );
      return;
    }

    // Get the latest commit SHA from base branch
    const baseSha = await this.getLatestCommitSha(
      token,
      owner,
      repo,
      baseBranch,
    );

    // Create the branch
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Failed to create branch: ${response.status} - ${errorData}`,
      );
    }

    this.logger.debug(`Created branch ${branchName}`);
  }

  /**
   * Check if a branch exists
   * ✅ IDEMPOTENT: Returns false for 404
   */
  private async branchExists(
    token: string,
    owner: string,
    repo: string,
    branchName: string,
  ): Promise<boolean> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 404) return false;
    if (!response.ok) {
      throw new Error(`Failed to check branch: ${response.status}`);
    }

    return true;
  }

  /**
   * Replace entire file on GitHub
   * ✅ SAFE: Full file replacement via Contents API
   * ✅ IDEMPOTENT: Handles retries by fetching current SHA
   */
  private async replaceFile(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    newContent: string,
  ): Promise<void> {
    // Get current file SHA (if it exists)
    const currentSha = await this.getFileSha(
      token,
      owner,
      repo,
      branch,
      filePath,
    );

    const base64Content = Buffer.from(newContent).toString('base64');

    const body: Record<string, unknown> = {
      message: `Apply recommendation: ${filePath}`,
      content: base64Content,
      branch,
    };

    // Include SHA for update (omit for new file)
    if (currentSha) {
      body.sha = currentSha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Failed to update file ${filePath}: ${response.status} - ${errorData}`,
      );
    }

    this.logger.debug(`Updated file ${filePath}`);
  }

  /**
   * Get file SHA if it exists
   * Returns null for new files
   */
  private async getFileSha(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<string | null> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 404) {
      return null; // file does not exist
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch file SHA: ${response.status}`);
    }

    const data = (await response.json()) as { sha: string };
    return data.sha;
  }

  /**
   * Get latest commit SHA for a branch
   */
  private async getLatestCommitSha(
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch commit: ${response.status}`);
    }

    const data = (await response.json()) as { sha: string };
    return data.sha;
  }

  /**
   * Create pull request
   */
  private async createPRRequest(
    token: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    title: string,
    body: string,
  ): Promise<{ htmlUrl: string; number: number }> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title,
          body,
          head: headBranch,
          base: baseBranch,
          draft: false,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorData}`);
    }

    const prData = (await response.json()) as {
      html_url: string;
      number: number;
    };

    return {
      htmlUrl: prData.html_url,
      number: prData.number,
    };
  }

  /**
   * Build PR body with details about the recommendation
   */
  private buildPRBody(instance: RecommendationInstanceRow): string {
    const evaluationDays = instance.metadata.evaluationWindowDays;
    const rec = instance.recommendationSnapshot;

    return `# Webruit Recommendation Applied

This pull request applies a recommendation from Webruit's AI Reasoning engine.

## Recommendation Details
- **ID**: ${instance.id}
- **Title**: ${rec.title}
- **Explanation**: ${rec.explanation}

## Implementation
- **Action Type**: ${rec.actionType}
- **Risk Level**: ${rec.riskLevel}
- **Confidence**: ${(rec.confidence * 100).toFixed(0)}%

## Evaluation Plan
After merge, this change will be evaluated over **${evaluationDays} days** to measure impact on:
- **Metric**: ${instance.metadata.metricType}
- **Expected Impact**: ${rec.expectedImpact}
- **Success Criteria**: ${instance.metadata.successCriteria}

## Files Modified
${rec.scope.files.map((f) => `- ${f}`).join('\n')}

---
*Generated by Webruit Evolution Engine*
*Please review carefully before merging.*`;
  }
}
