// src/modules/evolution/repositories/evolution-jobs.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  evolutionJobs,
  EvolutionJobRow,
  NewEvolutionJobRow,
} from 'src/database/drizzle/schema';

export type EvolutionJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'dead_letter';

export type EvolutionJobDbRow = {
  id: string;
  project_id: string;
  instance_id: string;
  job_type: string;
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
export class EvolutionJobsRepository {
  private readonly logger = new Logger(EvolutionJobsRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  /**
   * Map database row to typed EvolutionJobRow with proper date handling
   *
   * CRITICAL: Database returns raw timestamp values that may include invalid epoch times.
   * This mapper ensures all dates are converted to proper Date objects.
   */
  private mapEvolutionJobRow(row: EvolutionJobDbRow): EvolutionJobRow {
    return {
      id: row.id,
      projectId: row.project_id,
      instanceId: row.instance_id,
      jobType: row.job_type,
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

  async create(data: NewEvolutionJobRow): Promise<EvolutionJobRow> {
    const [row] = await this.db.insert(evolutionJobs).values(data).returning();

    return row;
  }

  /**
   * Get next pending job with atomic status update to 'running'
   *
   * CRITICAL: Uses raw SQL with explicit column selection to avoid timestamp conversion issues.
   * Always map the result through mapEvolutionJobRow to ensure proper date handling.
   */
  async getNextPendingJob(): Promise<EvolutionJobRow | null> {
    const now = new Date();

    const result = await this.db.execute(
      sql`
        UPDATE ${evolutionJobs}
        SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id
          FROM ${evolutionJobs}
          WHERE status = 'pending'
            AND (${evolutionJobs.nextRetryAt} IS NULL OR ${evolutionJobs.nextRetryAt} <= ${now})
          ORDER BY ${evolutionJobs.createdAt}
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING 
          ${evolutionJobs.id},
          ${evolutionJobs.projectId},
          ${evolutionJobs.instanceId},
          ${evolutionJobs.jobType},
          ${evolutionJobs.status},
          ${evolutionJobs.retryCount},
          ${evolutionJobs.maxRetries},
          ${evolutionJobs.lastError},
          ${evolutionJobs.startedAt},
          ${evolutionJobs.finishedAt},
          ${evolutionJobs.nextRetryAt},
          ${evolutionJobs.createdAt}
      `,
    );

    if (!result || !('rows' in result) || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as EvolutionJobDbRow;
    return this.mapEvolutionJobRow(row);
  }

  async getById(jobId: string): Promise<EvolutionJobRow | null> {
    const [row] = await this.db
      .select()
      .from(evolutionJobs)
      .where(eq(evolutionJobs.id, jobId))
      .limit(1);

    return row ?? null;
  }

  async updateStatus(
    jobId: string,
    status: EvolutionJobStatus,
    data?: {
      startedAt?: Date;
      finishedAt?: Date;
      lastError?: string;
      retryCount?: number;
      nextRetryAt?: Date;
    },
  ): Promise<void> {
    await this.db
      .update(evolutionJobs)
      .set({
        status,
        ...data,
      })
      .where(eq(evolutionJobs.id, jobId));
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

  /**
   * Mark job as failed with exponential backoff retry scheduling
   *
   * - If retryCount >= maxRetries: Move to dead_letter (no more retries)
   * - Otherwise: Reschedule for retry with exponential backoff (2^retryCount seconds)
   */
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

  async cleanupDeadLetterJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(evolutionJobs)
      .where(
        and(
          eq(evolutionJobs.status, 'dead_letter'),
          lte(evolutionJobs.createdAt, cutoffDate),
        ),
      );

    const count = (result as { rowCount?: number }).rowCount || 0;
    if (count > 0) {
      this.logger.log(`🗑️  Cleaned up ${count} dead-letter evolution jobs`);
    }
    return count;
  }
}
