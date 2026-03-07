// src/modules/ai-reasoning/services/ai-reasoning-cursor-initialization.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AIReasoningCursorRepository } from '../repositories/ai-reasoning-cursor.repository';

@Injectable()
export class AIReasoningCursorInitializationService {
  private readonly logger = new Logger(AIReasoningCursorInitializationService.name);

  constructor(
    private readonly cursorRepo: AIReasoningCursorRepository,
  ) {}

  async initializeProjectCursor(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    try {
      await this.cursorRepo.initializeCursor(projectId, tx);
      this.logger.log(`✅ Initialized AI reasoning cursor for project ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI reasoning cursor for project ${projectId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}