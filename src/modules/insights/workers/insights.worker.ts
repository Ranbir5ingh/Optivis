// src/modules/insights/workers/insights.worker.ts

import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InsightsJobsRepository } from '../repositories/insights-jobs.repository';
import { InsightEngineService } from '../engine/insight-engine.service';
import { ConfigService } from '@nestjs/config';
import { InsightsJobRow } from 'src/database/drizzle/schema';

interface WorkerMetrics {
  totalProcessed: number;
  totalFailed: number;
  consecutiveEmpty: number;
  lastJobTime: number;
}

@Injectable()
export class InsightsWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(InsightsWorker.name);
  private running = false;
  private metrics: WorkerMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    consecutiveEmpty: 0,
    lastJobTime: 0,
  };

  constructor(
    private readonly jobsRepo: InsightsJobsRepository,
    private readonly insightEngine: InsightEngineService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.configService.get<string>('ENABLE_INSIGHTS_WORKER') !== 'true') {
      this.logger.warn('Insights worker disabled via ENV');
      return;
    }

    this.logger.log('🚀 Insights worker starting');
    this.running = true;

    setImmediate(() => this.run());

    this.startMetricsLogging();
  }

  onModuleDestroy(): void {
    this.logger.log('🛑 Insights worker stopping');
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

  private async processJob(job: InsightsJobRow): Promise<void> {
    await this.insightEngine.analyzeProject(
      job.projectId,
      job.windowStart,
      job.windowEnd,
    );
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
          this.metrics.totalProcessed += 1;
          this.metrics.lastJobTime = Date.now() - jobStartTime;

          this.logger.log(
            `📊 InsightsWorker | project=${job.projectId} | duration=${this.metrics.lastJobTime}ms`,
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
            `❌ InsightsWorker failed | project=${job.projectId} | retry=${job.retryCount + 1}/${job.maxRetries}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      } catch (error) {
        this.logger.error(
          'Unexpected insights worker error',
          error instanceof Error ? error.stack : undefined,
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