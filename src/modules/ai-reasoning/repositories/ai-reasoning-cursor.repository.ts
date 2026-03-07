// src/modules/ai-reasoning/repositories/ai-reasoning-cursor.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  aiReasoningCursor,
  AIReasoningCursorRow,
} from 'src/database/drizzle/schema';

@Injectable()
export class AIReasoningCursorRepository {
  private readonly logger = new Logger(AIReasoningCursorRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getCursor(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<AIReasoningCursorRow | null> {
    const database = tx ?? this.db;

    const [row] = await database
      .select()
      .from(aiReasoningCursor)
      .where(eq(aiReasoningCursor.projectId, projectId))
      .limit(1);

    return row ?? null;
  }

  async setCursor(
    projectId: string,
    processedHash: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;

    await database
      .insert(aiReasoningCursor)
      .values({
        projectId,
        processedHash,
        lastProcessedAt: new Date(),
        retryCount: 0,
      })
      .onConflictDoUpdate({
        target: [aiReasoningCursor.projectId],
        set: {
          processedHash,
          lastProcessedAt: new Date(),
          retryCount: 0,
          updatedAt: new Date(),
        },
      });

    this.logger.debug(
      `AI Reasoning cursor updated: ${projectId} -> ${processedHash}`,
    );
  }

  async resetCursor(projectId: string, tx?: NodePgDatabase): Promise<void> {
    const database = tx ?? this.db;

    await database
      .update(aiReasoningCursor)
      .set({
        processedHash: '',
        lastProcessedAt: new Date('1970-01-01'),
        retryCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(aiReasoningCursor.projectId, projectId));

    this.logger.warn(`AI Reasoning cursor reset: ${projectId}`);
  }

  async initializeCursor(projectId: string, tx?: NodePgDatabase): Promise<void> {
    const database = tx ?? this.db;
    const existing = await this.getCursor(projectId, tx);

    if (!existing) {
      await database.insert(aiReasoningCursor).values({
        projectId,
        processedHash: '',
        lastProcessedAt: new Date(),
        retryCount: 0,
      });

      this.logger.debug(
        `AI Reasoning cursor initialized: ${projectId}`,
      );
    }
  }
}