// src/modules/aggregation/repositories/funnels.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  funnelDefinitions,
  FunnelDefinitionRow,
} from 'src/database/drizzle/schema';

/**
 * Funnels Repository (Aggregation Module)
 * 
 * Read-only access to funnel definitions
 * Used by DailyFunnelAggregatorService to know which funnels to compute
 */
@Injectable()
export class FunnelsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  /**
   * Get active funnel definitions for a project
   */
  async findByProjectId(projectId: string): Promise<FunnelDefinitionRow[]> {
    return this.db
      .select()
      .from(funnelDefinitions)
      .where(
        and(
          eq(funnelDefinitions.projectId, projectId),
          eq(funnelDefinitions.isActive, true)
        )
      );
  }
}