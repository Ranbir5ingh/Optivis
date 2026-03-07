// src/modules/aggregation/repositories/aggregation-jobs.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lte, isNull, sql, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  aggregationJobs,
  AggregationJobRow,
  NewAggregationJobRow,
} from 'src/database/drizzle/schema';

export type AggregationJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'dead_letter';

export type AggregationJobDbRow = {
  id: string;
  project_id: string;
  pipeline: string;
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
export class AggregationJobsRepository {
  private readonly logger = new Logger(AggregationJobsRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  private mapAggregationJobRow(row: AggregationJobDbRow): AggregationJobRow {
    return {
      id: row.id,
      projectId: row.project_id,
      pipeline: row.pipeline,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
    };
  }

  async create(data: NewAggregationJobRow): Promise<AggregationJobRow> {
    const [row] = await this.db
      .insert(aggregationJobs)
      .values(data)
      .returning();

    return row;
  }

  async getNextPendingJob(): Promise<AggregationJobRow | null> {
    const now = new Date();

    const result = await this.db.execute(
      sql`
        UPDATE ${aggregationJobs}
        SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id
          FROM ${aggregationJobs}
          WHERE status = 'pending'
            AND (${aggregationJobs.nextRetryAt} IS NULL OR ${aggregationJobs.nextRetryAt} <= ${now})
          ORDER BY ${aggregationJobs.createdAt}
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING 
          ${aggregationJobs.id},
          ${aggregationJobs.projectId},
          ${aggregationJobs.pipeline},
          ${aggregationJobs.windowStart},
          ${aggregationJobs.windowEnd},
          ${aggregationJobs.status},
          ${aggregationJobs.retryCount},
          ${aggregationJobs.maxRetries},
          ${aggregationJobs.lastError},
          ${aggregationJobs.startedAt},
          ${aggregationJobs.finishedAt},
          ${aggregationJobs.nextRetryAt},
          ${aggregationJobs.createdAt}
      `,
    );

    if (!result || !('rows' in result) || result.rows.length === 0) {
    return null;
  }
    const row = result.rows[0] as AggregationJobDbRow;

    return this.mapAggregationJobRow(row);
  }

  async getById(jobId: string): Promise<AggregationJobRow | null> {
    const [row] = await this.db
      .select()
      .from(aggregationJobs)
      .where(eq(aggregationJobs.id, jobId))
      .limit(1);

    return row ?? null;
  }

  async updateStatus(
    jobId: string,
    status: AggregationJobStatus,
    data?: {
      startedAt?: Date;
      finishedAt?: Date;
      lastError?: string;
      retryCount?: number;
      nextRetryAt?: Date;
    },
  ): Promise<void> {
    await this.db
      .update(aggregationJobs)
      .set({
        status,
        ...data,
      })
      .where(eq(aggregationJobs.id, jobId));
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

  async markSkipped(jobId: string): Promise<void> {
    await this.updateStatus(jobId, 'skipped', {
      finishedAt: new Date(),
    });
  }

  async exists(
    projectId: string,
    pipeline: string,
    windowStart: Date,
  ): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(aggregationJobs)
      .where(
        and(
          eq(aggregationJobs.projectId, projectId),
          eq(aggregationJobs.pipeline, pipeline),
          eq(aggregationJobs.windowStart, windowStart),
        ),
      )
      .limit(1);

    return !!row;
  }

  async cleanupDeadLetterJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(aggregationJobs)
      .where(
        and(
          eq(aggregationJobs.status, 'dead_letter'),
          lte(aggregationJobs.createdAt, cutoffDate),
        ),
      );

    const count = (result as { rowCount?: number }).rowCount || 0;
    if (count > 0) {
      this.logger.log(`🗑️  Cleaned up ${count} dead-letter jobs`);
    }
    return count;
  }

  async getJobsByProjectAndPipeline(
    projectId: string,
    pipeline: string,
  ): Promise<AggregationJobRow[]> {
    return this.db
      .select()
      .from(aggregationJobs)
      .where(
        and(
          eq(aggregationJobs.projectId, projectId),
          eq(aggregationJobs.pipeline, pipeline),
        ),
      )
      .orderBy(aggregationJobs.windowStart);
  }
}
