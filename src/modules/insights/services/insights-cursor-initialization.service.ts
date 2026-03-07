// src/modules/insights/services/insights-cursor-initialization.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InsightsCursorRepository } from '../repositories/insights-cursor.repository';
 

@Injectable()
export class InsightsCursorInitializationService {
  private readonly logger = new Logger(InsightsCursorInitializationService.name);

  constructor(
    private readonly cursorRepo: InsightsCursorRepository,
  ) {}

  /**
   * Initialize insights cursor within a transaction
   * @param projectId - Project ID
   * @param tx - Optional transaction context. If provided, operations run within the transaction.
   *            If not provided, operations run independently.
   */
  async initializeProjectCursor(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    try {
      const now = new Date();
      await this.cursorRepo.initializeCursor(projectId, tx);
      this.logger.log(`✅ Initialized insights cursor for project ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize insights cursor for project ${projectId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}