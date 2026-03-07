// src/modules/ai-reasoning/workers/ai-reasoning.worker.ts

import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIReasoningJobsRepository } from '../repositories/ai-reasoning-jobs.repository';
import { AIReasoningService } from '../services/ai-reasoning.service';
import { AIReasoningCursorRepository } from '../repositories/ai-reasoning-cursor.repository';
import { AIReasoningJobRow } from 'src/database/drizzle/schema';

interface WorkerMetrics {
  totalProcessed: number;
  totalFailed: number;
  consecutiveEmpty: number;
  lastJobTime: number;
}

@Injectable()
export class AIReasoningWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AIReasoningWorker.name);
  private running = false;
  private metrics: WorkerMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    consecutiveEmpty: 0,
    lastJobTime: 0,
  };

  constructor(
    private readonly jobsRepo: AIReasoningJobsRepository,
    private readonly cursorRepo: AIReasoningCursorRepository,
    private readonly aiReasoningService: AIReasoningService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.configService.get<string>('ENABLE_AI_REASONING_WORKER') !== 'true'
    ) {
      this.logger.warn('AI Reasoning worker disabled via ENV');
      return;
    }

    this.logger.log('🚀 AI Reasoning worker starting');
    this.running = true;

    setImmediate(() => this.run());
    this.startMetricsLogging();
  }

  onModuleDestroy(): void {
    this.logger.log('🛑 AI Reasoning worker stopping');
    this.running = false;
  }

  private startMetricsLogging(): void {
    setInterval(() => {
      this.logger.debug(
        `Metrics: processed=${this.metrics.totalProcessed} failed=${this.metrics.totalFailed} empty=${this.metrics.consecutiveEmpty}`,
      );
    }, 60000);
  }

  private calculateBackoffMs(emptyCount: number): number {
    const baseMs = 5000;
    const maxMs = 60000;
    const exponentialMs = baseMs * Math.pow(2, emptyCount - 1);
    return Math.min(maxMs, exponentialMs);
  }

  private async processJob(job: AIReasoningJobRow): Promise<void> {
    await this.aiReasoningService.generateRecommendations(job.projectId, {
      saveToDatabase: true,
      commitSha: undefined,
    });
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        const job = await this.jobsRepo.getNextPendingJob();

        if (job === null) {
          this.metrics.consecutiveEmpty += 1;
          const backoffMs = this.calculateBackoffMs(
            this.metrics.consecutiveEmpty,
          );
          await this.sleep(backoffMs);
          continue;
        }

        this.metrics.consecutiveEmpty = 0;
        const jobStartTime = Date.now();

        try {
          await this.processJob(job);

          await this.jobsRepo.markCompleted(job.id);
          await this.cursorRepo.setCursor(job.projectId, job.insightSnapshotHash);

          this.metrics.totalProcessed += 1;
          this.metrics.lastJobTime = Date.now() - jobStartTime;

          this.logger.log(
            `✅ AIReasoningWorker | project=${job.projectId} | trigger=${job.triggerType} | duration=${this.metrics.lastJobTime}ms`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          await this.jobsRepo.markFailed(
            job.id,
            errorMessage,
            job.retryCount + 1,
            job.maxRetries,
          );

          this.metrics.totalFailed += 1;

          this.logger.error(
            `❌ AIReasoningWorker failed | project=${job.projectId} | retry=${job.retryCount + 1}/${job.maxRetries}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      } catch (error) {
        this.logger.error(
          'Unexpected AI reasoning worker error',
          error instanceof Error ? error.stack : String(error),
        );
        this.metrics.consecutiveEmpty += 1;
        await this.sleep(5000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}