import { Injectable } from '@nestjs/common';
import { CodeMetadataRepository } from '../repositories/code-metadata.repository';
import { GithubRepoService } from './github-repo.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import type { CodeMetadataRow } from 'src/database/drizzle/schema';
import { ProjectGithubConnectionRepository } from '../repositories/project-github-connections.repository';

/**
 * Component source code with metadata
 */
export interface ComponentCode {
  componentId: string;
  name: string;
  filepath: string;
  code: string;
  lineStart?: number;
  lineEnd?: number;
  language: string;
}

/**
 * Code Fetch Service
 * ✅ FIXED: Uses correct manifest structure
 *
 * Responsibility: Fetch component source code from GitHub
 *
 * Architecture:
 * 1. Resolve componentId → file path (from manifest)
 * 2. Get GitHub repo connection
 * 3. Fetch file from GitHub using installation token
 * 4. Extract component excerpt (optional line range trimming)
 *
 * Security:
 * - Validates project access via GitHub connection
 * - Uses short-lived installation tokens (auto-generated)
 * - Enforces project-level permissions
 *
 * Performance:
 * - No caching (GitHub API is fast enough)
 * - Trimming to line ranges reduces payload size
 * - Fail-fast on missing manifests or connections
 */
@Injectable()
export class CodeFetchService {
  constructor(
    private readonly codeMetadataRepo: CodeMetadataRepository,
    private readonly connectionRepo: ProjectGithubConnectionRepository,
    private readonly githubRepoService: GithubRepoService,
  ) {}

  /**
   * Fetch component source code by ID
   *
   * @param projectId - Project UUID
   * @param componentId - Component ID (wb_c_[hash])
   * @returns Component code with metadata
   *
   * @throws DomainError - MANIFEST_NOT_FOUND, COMPONENT_NOT_FOUND,
   *                       GITHUB_NOT_CONNECTED, CODE_FETCH_FAILED
   */
  async fetchComponentCode(
    projectId: string,
    componentId: string,
  ): Promise<ComponentCode> {
    // Step 1: Resolve componentId → file path
    const manifest = await this.getManifestOrThrow(projectId);
    const component = this.getComponentOrThrow(manifest, componentId);

    // Step 2: Get GitHub repo connection
    const repo = await this.getGithubRepoOrThrow(projectId);

    // Step 3: Fetch file from GitHub
    const fileContent = await this.fetchFileFromGithub(
      repo.installationId,
      repo.repoOwner,
      repo.repoName,
      component.file,
      manifest.commitSha,
      projectId,
      componentId,
    );

    // Step 4: Extract component excerpt
    const excerpt = this.extractComponentExcerpt(
      fileContent,
      component.lineStart,
      component.lineEnd,
    );

    return {
      componentId,
      name: component.name,
      filepath: component.file,
      code: excerpt,
      lineStart: component.lineStart,
      lineEnd: component.lineEnd,
      language: this.detectLanguage(component.file),
    };
  }

  /**
   * Fetch multiple components in parallel
   */
  async fetchMultipleComponents(
    projectId: string,
    componentIds: string[],
  ): Promise<ComponentCode[]> {
    const results = await Promise.allSettled(
      componentIds.map((id) => this.fetchComponentCode(projectId, id)),
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<ComponentCode>).value);
  }

  /**
   * Get manifest or throw error
   */
  private async getManifestOrThrow(
    projectId: string,
  ): Promise<CodeMetadataRow> {
    const manifest = await this.codeMetadataRepo.getLatestForProject(projectId);

    if (!manifest) {
      throw new DomainError(
        'MANIFEST_NOT_FOUND',
        'No code manifest found for this project. Please ensure build plugin has uploaded manifest.',
        'not_found',
        { projectId },
      );
    }

    return manifest;
  }

  /**
   * Get component from manifest or throw error
   */
  private getComponentOrThrow(
    manifest: CodeMetadataRow,
    componentId: string,
  ): {
    name: string;
    file: string;
    lineStart?: number;
    lineEnd?: number;
  } {
    const component = manifest.components[componentId];

    if (!component) {
      throw new DomainError(
        'COMPONENT_NOT_FOUND',
        `Component ${componentId} not found in manifest. It may have been removed or renamed.`,
        'not_found',
        { componentId, projectId: manifest.projectId },
      );
    }

    return component;
  }

  /**
   * Get GitHub repo connection or throw error
   */
  private async getGithubRepoOrThrow(projectId: string) {
    const repo =
      await this.connectionRepo.getActiveForProjectWithInstallation(projectId);

    if (!repo) {
      throw new DomainError(
        'GITHUB_NOT_CONNECTED',
        'GitHub repository is not connected to this project. Please connect via dashboard.',
        'forbidden',
        { projectId },
      );
    }

    return repo;
  }

  /**
   * Fetch file from GitHub with error handling
   */
  private async fetchFileFromGithub(
    installationId: string,
    owner: string,
    repo: string,
    filePath: string,
    commitSha: string,
    projectId: string,
    componentId: string,
  ): Promise<string> {
    try {
      return await this.githubRepoService.fetchFile(
        installationId,
        owner,
        repo,
        filePath,
        commitSha,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('404')) {
        throw new DomainError(
          'FILE_NOT_FOUND',
          `Source file not found in GitHub repository: ${filePath}. The file may have been moved or deleted.`,
          'not_found',
          { projectId, componentId, filePath, commitSha },
        );
      }

      throw new DomainError(
        'CODE_FETCH_FAILED',
        `Failed to fetch source code from GitHub: ${errorMessage}`,
        'unexpected',
        { projectId, componentId, filePath, commitSha },
      );
    }
  }

  /**
   * Extract component excerpt from full file
   */
  private extractComponentExcerpt(
    fileContent: string,
    lineStart?: number,
    lineEnd?: number,
  ): string {
    if (!lineStart || !lineEnd) {
      return fileContent;
    }

    const lines = fileContent.split('\n');

    if (lineStart < 1 || lineEnd > lines.length || lineStart > lineEnd) {
      return fileContent;
    }

    const excerpt = lines.slice(lineStart - 1, lineEnd);
    return excerpt.join('\n');
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filepath: string): string {
    const extension = filepath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
    };

    return languageMap[extension || ''] || 'plaintext';
  }
}
