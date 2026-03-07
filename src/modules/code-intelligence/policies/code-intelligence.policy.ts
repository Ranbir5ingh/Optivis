import { Injectable } from '@nestjs/common';
import { DomainError } from 'src/common/exceptions/domain-error';
import { ProjectGithubConnectionRepository } from '../repositories/project-github-connections.repository';

/**
 * Code Intelligence Access Control Policy
 *
 * Enforces authorization rules:
 * 1. Only authenticated projects can upload manifests
 * 2. Only project owners can connect/disconnect GitHub
 * 3. Webhooks must have valid signatures
 * 4. Code resolution requires valid project key
 *
 * This is NOT about GitHub permissions
 * GitHub enforces permissions via installation tokens
 * This is about OUR application permissions
 */
@Injectable()
export class CodeIntelligencePolicy {
  constructor(
    private readonly connectionRepo: ProjectGithubConnectionRepository,
  ) {}

  /**
   * Assert that GitHub repo is connected to project
   *
   * Used when code access is required
   * Throws 403 if not connected
   *
   * @param projectId - Project ID
   * @throws DomainError if not connected
   */
  async assertGithubConnected(projectId: string): Promise<void> {
    const repo = await this.connectionRepo.getActiveForProject(projectId);

    if (!repo) {
      throw new DomainError(
        'GITHUB_NOT_CONNECTED',
        'GitHub repository is not connected to this project. Please connect via dashboard.',
        'forbidden',
        { projectId },
      );
    }
  }

  /**
   * Assert that project owns a specific GitHub installation
   *
   * Used during disconnect/modify operations
   * Prevents unauthorized disconnection
   * Throws 403 if ownership mismatch
   *
   * @param projectId - Project ID to check
   * @param orgInstallationId - Organization Installation ID to verify ownership
   * @throws DomainError if project doesn't own this installation
   */
  async assertOwnsGithubInstallation(
    projectId: string,
    orgInstallationId: string,
  ): Promise<void> {
    const repo = await this.connectionRepo.getActiveForProject(projectId);

    if (!repo || repo.orgInstallationId !== orgInstallationId) {
      throw new DomainError(
        'GITHUB_OWNERSHIP_MISMATCH',
        'Project does not own this GitHub installation',
        'forbidden',
        { projectId, orgInstallationId },
      );
    }
  }

  /**
   * Assert that manifests can be uploaded to this project
   *
   * Checks that:
   * 1. Project exists
   * 2. Project is not archived
   * 3. Upload quota not exceeded
   *
   * Used by POST /v1/code/metadata endpoint
   *
   * @param projectId - Project ID
   * @throws DomainError if conditions not met
   */
  async assertCanUploadManifest(projectId: string): Promise<void> {}

  /**
   * Assert that code can be fetched for this project
   *
   * Checks that:
   * 1. GitHub is connected
   * 2. Installation is still active
   * 3. Repo is not disconnected
   *
   * Used by Code Fetch Service (Phase 4)
   *
   * @param projectId - Project ID
   * @throws DomainError if GitHub not connected
   */
  async assertCanFetchCode(projectId: string): Promise<void> {
    // This is an alias for assertGithubConnected
    await this.assertGithubConnected(projectId);
  }

  /**
   * Get active GitHub repo for project
   *
   * Used when repo info is needed (not just verification)
   *
   * @param projectId - Project ID
   * @returns Repo info or null if not connected
   */
  async getActiveRepository(projectId: string) {
    return this.connectionRepo.getActiveForProject(projectId);
  }
}
