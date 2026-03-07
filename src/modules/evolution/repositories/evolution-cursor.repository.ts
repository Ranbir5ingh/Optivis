// src/modules/evolution/repositories/evolution-cursor.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  evolutionCursor,
  EvolutionCursorRow,
} from 'src/database/drizzle/schema';

@Injectable()
export class EvolutionCursorRepository {
  private readonly logger = new Logger(EvolutionCursorRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getCursor(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<EvolutionCursorRow | null> {
    const database = tx ?? this.db;

    const [row] = await database
      .select()
      .from(evolutionCursor)
      .where(
        and(
          eq(evolutionCursor.projectId, projectId),
          eq(evolutionCursor.pipeline, pipeline),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async setCursor(
    projectId: string,
    pipeline: string,
    nextWindowStart: Date,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;

    await database
      .insert(evolutionCursor)
      .values({
        projectId,
        pipeline,
        processedWindow: nextWindowStart,
        lastProcessedAt: nextWindowStart,
        retryCount: 0,
      })
      .onConflictDoUpdate({
        target: [evolutionCursor.projectId, evolutionCursor.pipeline],
        set: {
          processedWindow: nextWindowStart,
          lastProcessedAt: nextWindowStart,
          retryCount: 0,
          updatedAt: new Date(),
        },
      });

    this.logger.debug(
      `Cursor updated: ${projectId}/${pipeline} -> ${nextWindowStart.toISOString()}`,
    );
  }

  async initializeCursor(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;
    const existing = await this.getCursor(projectId, pipeline, tx);

    if (!existing) {
      const now = new Date();
      await database.insert(evolutionCursor).values({
        projectId,
        pipeline,
        processedWindow: new Date('1970-01-01'),
        lastProcessedAt: new Date('1970-01-01'),
        retryCount: 0,
      });

      this.logger.debug(
        `Cursor initialized: ${projectId}/${pipeline} at ${now.toISOString()}`,
      );
    }
  }
}