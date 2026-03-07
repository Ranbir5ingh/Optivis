// src/modules/evolution/services/evolution-cursor-initialization.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { EvolutionCursorRepository } from '../repositories/evolution-cursor.repository';

@Injectable()
export class EvolutionCursorInitializationService {
  private readonly logger = new Logger(
    EvolutionCursorInitializationService.name,
  );

  private readonly PIPELINES = [
    'evaluate_impact',
    'expire_recommendations',
  ];

  constructor(private readonly cursorRepo: EvolutionCursorRepository) {}

  async initializeProjectCursors(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    try {
      for (const pipeline of this.PIPELINES) {
        await this.cursorRepo.initializeCursor(projectId, pipeline, tx);
      }
      this.logger.log(`✅ Initialized cursors for project ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize cursors for project ${projectId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}