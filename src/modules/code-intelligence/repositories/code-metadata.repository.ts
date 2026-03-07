import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  codeMetadata,
  CodeMetadataRow,
  NewCodeMetadataRow,
} from 'src/database/drizzle/schema';

@Injectable()
export class CodeMetadataRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  /**
   * Store code metadata manifest
   * Idempotent: same commit = no duplicate
   */
  async upsert(data: NewCodeMetadataRow): Promise<CodeMetadataRow> {
    const [row] = await this.db
      .insert(codeMetadata)
      .values(data)
      .onConflictDoNothing()
      .returning();

    if (!row) {
      const [existing] = await this.db
        .select()
        .from(codeMetadata)
        .where(
          and(
            eq(codeMetadata.projectId, data.projectId),
            eq(codeMetadata.commitSha, data.commitSha),
          ),
        )
        .limit(1);

      return existing!;
    }

    return row;
  }

  /**
   * Get latest manifest for project
   */
  async getLatestForProject(
    projectId: string,
  ): Promise<CodeMetadataRow | null> {
    const [row] = await this.db
      .select()
      .from(codeMetadata)
      .where(eq(codeMetadata.projectId, projectId))
      .orderBy(desc(codeMetadata.uploadedAt))
      .limit(1);

    return row ?? null;
  }

  /**
   * Get manifest by commit
   */
  async getByCommit(
    projectId: string,
    commitSha: string,
  ): Promise<CodeMetadataRow | null> {
    const [row] = await this.db
      .select()
      .from(codeMetadata)
      .where(
        and(
          eq(codeMetadata.projectId, projectId),
          eq(codeMetadata.commitSha, commitSha),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Resolve component ID to file path
   * Returns file path from latest manifest
   */
  async resolveComponentFile(
    projectId: string,
    componentId: string,
  ): Promise<string | null> {
    const manifest = await this.getLatestForProject(projectId);
    if (!manifest) return null;

    const component = manifest.components[componentId];
    return component?.file ?? null;
  }

  /**
   * Resolve element ID to component and JSX path
   */
  async resolveElement(
    projectId: string,
    elementId: string,
  ): Promise<{
    componentId: string;
    jsxPath: string;
    type: string;
  } | null> {
    const manifest = await this.getLatestForProject(projectId);
    if (!manifest) return null;

    const element = manifest.elements[elementId];
    if (!element) return null;

    return {
      componentId: element.componentId,
      jsxPath: element.jsxPath,
      type: element.type,
    };
  }
}
