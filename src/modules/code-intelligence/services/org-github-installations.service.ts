// src/modules/code-intelligence/services/org-github-installations.service.ts

import { Injectable } from '@nestjs/common';
import { OrgGithubInstallationsRepository } from '../repositories/org-github-installations.repository';
import { DomainError } from 'src/common/exceptions/domain-error';

export interface OrgGithubInstallation {
  id: string;
  organizationId: string;
  installationId: string;
  connectedAt: Date;
}

@Injectable()
export class OrgGithubInstallationsService {
  constructor(
    private readonly repo: OrgGithubInstallationsRepository,
  ) {}

  private toModel(
    row: typeof import('src/database/drizzle/schema').orgGithubInstallations.$inferSelect,
  ): OrgGithubInstallation {
    return {
      id: row.id,
      organizationId: row.organizationId,
      installationId: row.installationId,
      connectedAt: row.connectedAt,
    };
  }

  async storeInstallation(
    organizationId: string,
    installationId: string,
  ): Promise<OrgGithubInstallation> {
    const existing = await this.repo.getActiveForOrg(organizationId);

    if (existing) {
      return this.toModel(existing);
    }

    const created = await this.repo.create({
      organizationId,
      installationId,
    });

    return this.toModel(created);
  }

  async getActiveInstallation(
    organizationId: string,
  ): Promise<OrgGithubInstallation | null> {
    const row = await this.repo.getActiveForOrg(organizationId);
    return row ? this.toModel(row) : null;
  }

  async assertInstallationExists(organizationId: string): Promise<void> {
    const installation = await this.repo.getActiveForOrg(organizationId);

    if (!installation) {
      throw new DomainError(
        'GITHUB_NOT_INSTALLED',
        'GitHub App is not installed for this organization',
        'validation',
        { organizationId },
      );
    }
  }

  async disconnectInstallation(organizationId: string): Promise<void> {
    const installation = await this.repo.getByOrganizationId(organizationId);

    if (!installation) {
      throw new DomainError(
        'INSTALLATION_NOT_FOUND',
        'Installation not found for organization',
        'not_found',
        { organizationId },
      );
    }

    await this.repo.disconnect(organizationId);
  }
}