// src/modules/insights/repositories/insights-cursor.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { insightsCursor, InsightsCursorRow } from 'src/database/drizzle/schema';

@Injectable()
export class InsightsCursorRepository {
  private readonly logger = new Logger(InsightsCursorRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getCursor(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<InsightsCursorRow | null> {
    const database = tx ?? this.db;

    const [row] = await database
      .select()
      .from(insightsCursor)
      .where(eq(insightsCursor.projectId, projectId))
      .limit(1);

    return row ?? null;
  }

  async getCursorOrEpoch(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<Date> {
    const cursor = await this.getCursor(projectId, tx);
    return cursor ? cursor.lastProcessedAt : new Date('2020-01-01');
  }

  async setCursor(
    projectId: string,
    processedWindow: Date,
    lastProcessedAt?: Date,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;
    const lastProcessed = lastProcessedAt ?? processedWindow;

    await database
      .insert(insightsCursor)
      .values({
        projectId,
        processedWindow,
        lastProcessedAt: lastProcessed,
        retryCount: 0,
      })
      .onConflictDoUpdate({
        target: [insightsCursor.projectId],
        set: {
          processedWindow,
          lastProcessedAt: lastProcessed,
          retryCount: 0,
          updatedAt: new Date(),
        },
      });

    this.logger.debug(
      `Insights cursor updated: ${projectId} -> ${processedWindow.toISOString()}`,
    );
  }

  async resetCursor(projectId: string, tx?: NodePgDatabase): Promise<void> {
    const database = tx ?? this.db;

    await database
      .update(insightsCursor)
      .set({
        processedWindow: new Date('2020-01-01'),
        lastProcessedAt: new Date('2020-01-01'),
        retryCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(insightsCursor.projectId, projectId));

    this.logger.warn(`Insights cursor reset: ${projectId} for backfill`);
  }

  async initializeCursor(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    const database = tx ?? this.db;

    const existing = await this.getCursor(projectId, tx);
    
    if (!existing) {
      const now = new Date();
      await database.insert(insightsCursor).values({
        projectId,
        processedWindow: new Date('1970-01-01'),
        lastProcessedAt: new Date('1970-01-01'),
        retryCount: 0,
      });

      this.logger.debug(
        `Insights cursor initialized: ${projectId} at ${now.toISOString()}`,
      );
    }
  }
}
