import { Injectable } from '@nestjs/common';
import { ProjectKeysRepository } from './project-keys.repository';
import { ProjectKey } from './domain/project-key.model';
import { ProjectKeyRow } from 'src/database/drizzle/schema/project-keys.schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class ProjectKeysService {
  constructor(private readonly repo: ProjectKeysRepository) {}

  private toModel(row: ProjectKeyRow): ProjectKey {
    return {
      id: row.id,
      projectId: row.projectId,
      key: row.key,
      isActive: row.isActive,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt ?? undefined,
    };
  }

  /**
   * Create a new project key
   */
  async createForProject(projectId: string, tx?: NodePgDatabase): Promise<ProjectKey> {
    const row = await this.repo.create(projectId, tx);
    return this.toModel(row);
  }

  /**
   * Resolve projectId from an active project key
   * Returns null if invalid or revoked
   */
  async resolveProjectId(key: string): Promise<string | null> {
    const row = await this.repo.findActiveByKey(key);
    return row ? row.projectId : null;
  }

  /**
   * Get all keys for a project
   */
  async listForProject(projectId: string): Promise<ProjectKey[]> {
    const rows = await this.repo.findByProject(projectId);
    return rows.map(this.toModel);
  }

  /**
   * Revoke a key
   */
  async revoke(keyId: string): Promise<void> {
    await this.repo.revoke(keyId);
  }
}