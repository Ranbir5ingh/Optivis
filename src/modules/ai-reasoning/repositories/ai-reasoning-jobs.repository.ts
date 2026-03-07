// src/modules/ai-reasoning/repositories/ai-reasoning-jobs.repository.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  aiReasoningJobs,
  AIReasoningJobRow,
  NewAIReasoningJobRow,
} from 'src/database/drizzle/schema';

export type AIReasoningJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'dead_letter';

export type AIReasoningJobDbRow = {
  id: string;
  project_id: string;
  status: string;
  trigger_type: string;
  insight_snapshot_hash: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  next_retry_at: Date | null;
  created_at: Date;
};

@Injectable()
export class AIReasoningJobsRepository {
  private readonly logger = new Logger(AIReasoningJobsRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  private mapAIReasoningJobRow(row: AIReasoningJobDbRow): AIReasoningJobRow {
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      triggerType: row.trigger_type,
      insightSnapshotHash: row.insight_snapshot_hash,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
    };
  }

  async create(data: NewAIReasoningJobRow): Promise<AIReasoningJobRow> {
    const [row] = await this.db
      .insert(aiReasoningJobs)
      .values(data)
      .returning();

    return row;
  }

  async getNextPendingJob(): Promise<AIReasoningJobRow | null> {
    const now = new Date();

    const result = await this.db.execute(
      sql`
        UPDATE ${aiReasoningJobs}
        SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id
          FROM ${aiReasoningJobs}
          WHERE status = 'pending'
            AND (${aiReasoningJobs.nextRetryAt} IS NULL OR ${aiReasoningJobs.nextRetryAt} <= ${now})
          ORDER BY ${aiReasoningJobs.createdAt}
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING 
          ${aiReasoningJobs.id},
          ${aiReasoningJobs.projectId},
          ${aiReasoningJobs.status},
          ${aiReasoningJobs.triggerType},
          ${aiReasoningJobs.insightSnapshotHash},
          ${aiReasoningJobs.retryCount},
          ${aiReasoningJobs.maxRetries},
          ${aiReasoningJobs.lastError},
          ${aiReasoningJobs.startedAt},
          ${aiReasoningJobs.finishedAt},
          ${aiReasoningJobs.nextRetryAt},
          ${aiReasoningJobs.createdAt}
      `,
    );

    if (!result || !('rows' in result) || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as AIReasoningJobDbRow;
    return this.mapAIReasoningJobRow(row);
  }

  async getById(jobId: string): Promise<AIReasoningJobRow | null> {
    const [row] = await this.db
      .select()
      .from(aiReasoningJobs)
      .where(eq(aiReasoningJobs.id, jobId))
      .limit(1);

    return row ?? null;
  }

  async updateStatus(
    jobId: string,
    status: AIReasoningJobStatus,
    data?: {
      startedAt?: Date;
      finishedAt?: Date;
      lastError?: string;
      retryCount?: number;
      nextRetryAt?: Date;
    },
  ): Promise<void> {
    await this.db
      .update(aiReasoningJobs)
      .set({
        status,
        ...data,
      })
      .where(eq(aiReasoningJobs.id, jobId));
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

  async existsByHashAndProject(
    projectId: string,
    hash: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(aiReasoningJobs)
      .where(
        and(
          eq(aiReasoningJobs.projectId, projectId),
          eq(aiReasoningJobs.insightSnapshotHash, hash),
        ),
      )
      .limit(1);

    return !!row;
  }

  async cleanupDeadLetterJobs(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(aiReasoningJobs)
      .where(
        and(
          eq(aiReasoningJobs.status, 'dead_letter'),
          lte(aiReasoningJobs.createdAt, cutoffDate),
        ),
      );

    const count = (result as { rowCount?: number }).rowCount || 0;
    if (count > 0) {
      this.logger.log(`🗑️  Cleaned up ${count} dead-letter AI reasoning jobs`);
    }
    return count;
  }
}