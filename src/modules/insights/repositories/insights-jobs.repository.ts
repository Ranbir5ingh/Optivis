// src/modules/insights/repositories/insights-jobs.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lte, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  insightsJobs,
  InsightsJobRow,
  NewInsightsJobRow,
} from 'src/database/drizzle/schema';

export type InsightsJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'dead_letter';

export type InsightsJobDbRow = {
  id: string;
  project_id: string;
  window_start: Date;
  window_end: Date;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  next_retry_at: Date | null;
  created_at: Date;
};

@Injectable()
export class InsightsJobsRepository {
  private readonly logger = new Logger(InsightsJobsRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  private mapInsightsJobRow(row: InsightsJobDbRow): InsightsJobRow {
    return {
      id: row.id,
      projectId: row.project_id,
      windowStart: new Date(row.window_start),
      windowEnd: new Date(row.window_end),
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      createdAt: new Date(row.created_at),
    };
  }

  async create(data: NewInsightsJobRow): Promise<InsightsJobRow> {
    const [row] = await this.db.insert(insightsJobs).values(data).returning();

    return row;
  }

  async getNextPendingJob(): Promise<InsightsJobRow | null> {
    const now = new Date();

    const result = await this.db.execute(
      sql`
        UPDATE ${insightsJobs}
        SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id
          FROM ${insightsJobs}
          WHERE status = 'pending'
            AND (${insightsJobs.nextRetryAt} IS NULL OR ${insightsJobs.nextRetryAt} <= ${now})
          ORDER BY ${insightsJobs.createdAt}
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING 
          ${insightsJobs.id},
          ${insightsJobs.projectId},
          ${insightsJobs.windowStart},
          ${insightsJobs.windowEnd},
          ${insightsJobs.status},
          ${insightsJobs.retryCount},
          ${insightsJobs.maxRetries},
          ${insightsJobs.lastError},
          ${insightsJobs.startedAt},
          ${insightsJobs.finishedAt},
          ${insightsJobs.nextRetryAt},
          ${insightsJobs.createdAt}
      `,
    );

    if (!result || !('rows' in result) || result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0] as InsightsJobDbRow;

    return this.mapInsightsJobRow(row);
  }

  async getById(jobId: string): Promise<InsightsJobRow | null> {
    const [row] = await this.db
      .select()
      .from(insightsJobs)
      .where(eq(insightsJobs.id, jobId))
      .limit(1);

    return row ?? null;
  }

  async updateStatus(
    jobId: string,
    status: InsightsJobStatus,
    data?: {
      startedAt?: Date;
      finishedAt?: Date;
      lastError?: string;
      retryCount?: number;
      nextRetryAt?: Date;
    },
  ): Promise<void> {
    await this.db
      .update(insightsJobs)
      .set({
        status,
        ...data,
      })
      .where(eq(insightsJobs.id, jobId));
  }

  async markRunning(jobId: string): Promise<void> {
    await this.updateStatus(jobId, 'running', {
      startedAt: new Date(),
    });
  }

  async markCompleted(jobId: string): Promise<void> {
    await this.updateStatus(jobId, 'completed', {
      finishedAt: new Date(),
    });
  }

  async markFailed(
    jobId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
  ): Promise<void> {
    if (retryCount >= maxRetries) {
      await this.updateStatus(jobId, 'dead_letter', {
        lastError: error,
        retryCount,
        finishedAt: new Date(),
      });

      this.logger.warn(
        `Job ${jobId} marked as DEAD_LETTER after ${retryCount} retries`,
      );
    } else {
      const backoffMs = Math.pow(2, retryCount) * 1000;
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await this.updateStatus(jobId, 'pending', {
        lastError: error,
        retryCount,
        nextRetryAt,
      });
    }
  }

  async exists(projectId: string, windowStart: Date): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(insightsJobs)
      .where(
        and(
          eq(insightsJobs.projectId, projectId),
          eq(insightsJobs.windowStart, windowStart),
        ),
      )
      .limit(1);

    return !!row;
  }
}
