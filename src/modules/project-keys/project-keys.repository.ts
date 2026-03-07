import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  projectKeys,
  ProjectKeyRow,
  NewProjectKeyRow,
} from 'src/database/drizzle/schema/project-keys.schema';
import { randomBytes } from 'crypto';

@Injectable()
export class ProjectKeysRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  /**
   * Generate a secure random project key
   */
  generateKey(prefix: string = 'pk_live'): string {
    const random = randomBytes(32).toString('base64url');
    return `${prefix}_${random}`;
  }

  /**
   * Create a new project key
   */
  async create(projectId: string, tx: NodePgDatabase = this.db): Promise<ProjectKeyRow> {
    const key = this.generateKey();

    const [created] = await tx
      .insert(projectKeys)
      .values({
        projectId,
        key,
        isActive: true,
      })
      .returning();

    return created;
  }

  /**
   * Find active key by key string
   */
  async findActiveByKey(key: string): Promise<ProjectKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(projectKeys)
      .where(
        and(
          eq(projectKeys.key, key),
          eq(projectKeys.isActive, true),
          isNull(projectKeys.revokedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Get all keys for a project
   */
  async findByProject(projectId: string): Promise<ProjectKeyRow[]> {
    return this.db
      .select()
      .from(projectKeys)
      .where(eq(projectKeys.projectId, projectId));
  }

  /**
   * Revoke a key
   */
  async revoke(keyId: string): Promise<void> {
    await this.db
      .update(projectKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(eq(projectKeys.id, keyId));
  }
}