// src/modules/aggregation/repositories/aggregation-cursor.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  aggregationCursor,
  AggregationCursorRow,
} from 'src/database/drizzle/schema';

@Injectable()
export class AggregationCursorRepository {
  private readonly logger = new Logger(AggregationCursorRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getCursor(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<AggregationCursorRow | null> {
    const database = tx ?? this.db;

    const [row] = await database
      .select()
      .from(aggregationCursor)
      .where(
        and(
          eq(aggregationCursor.projectId, projectId),
          eq(aggregationCursor.pipeline, pipeline),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async getCursorOrEpoch(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<Date> {
    const cursor = await this.getCursor(projectId, pipeline, tx);
    return cursor ? cursor.lastProcessedAt : new Date('2020-01-01');
  }

  async setCursor(
    projectId: string,
    pipeline: string,
    nextWindowStart: Date,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;

    await database
      .insert(aggregationCursor)
      .values({
        projectId,
        pipeline,
        processedWindow: nextWindowStart,
        lastProcessedAt: nextWindowStart,
        retryCount: 0,
      })
      .onConflictDoUpdate({
        target: [aggregationCursor.projectId, aggregationCursor.pipeline],
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

  async resetCursor(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;

    await database
      .update(aggregationCursor)
      .set({
        processedWindow: new Date('2020-01-01'),
        lastProcessedAt: new Date('2020-01-01'),
        retryCount: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aggregationCursor.projectId, projectId),
          eq(aggregationCursor.pipeline, pipeline),
        ),
      );

    this.logger.warn(`Cursor reset: ${projectId}/${pipeline} for backfill`);
  }

  /**
   * Initialize cursor for a pipeline if it doesn't exist
   * @param projectId - Project ID
   * @param pipeline - Pipeline name
   * @param tx - Optional transaction context. If provided, operation runs within the transaction.
   */
  async initializeCursor(
    projectId: string,
    pipeline: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;
    const existing = await this.getCursor(projectId, pipeline, tx);

    if (!existing) {
      const now = new Date();
      await database.insert(aggregationCursor).values({
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