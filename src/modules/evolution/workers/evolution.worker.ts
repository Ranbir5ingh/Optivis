// src/modules/evolution/workers/evolution.worker.ts

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';
import { PatchGenerationService } from '../services/patch-generation.service';
import { GithubIntegrationService } from '../services/github-integration.service';
import { ImpactEvaluationService } from '../services/impact-evaluation.service';
import { EvolutionJobRow } from 'src/database/drizzle/schema';

interface WorkerMetrics {
  totalProcessed: number;
  totalFailed: number;
  consecutiveEmpty: number;
  lastJobTime: number;
}

@Injectable()
export class EvolutionWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EvolutionWorker.name);
  private running = false;
  private metrics: WorkerMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    consecutiveEmpty: 0,
    lastJobTime: 0,
  };

  constructor(
    private readonly jobsRepo: EvolutionJobsRepository,
    private readonly patchGeneration: PatchGenerationService,
    private readonly githubIntegration: GithubIntegrationService,
    private readonly impactEvaluation: ImpactEvaluationService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.configService.get<string>('ENABLE_EVOLUTION_WORKER') !== 'true') {
      this.logger.warn('Evolution worker disabled via ENV');
      return;
    }

    this.logger.log('🚀 Evolution worker starting');
    this.running = true;

    setImmediate(() => this.run());
    this.startMetricsLogging();
  }

  onModuleDestroy(): void {
    this.logger.log('🛑 Evolution worker stopping');
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

  private async processJob(job: EvolutionJobRow): Promise<void> {
    switch (job.jobType) {
      case 'generate_patch':
        await this.patchGeneration.generatePatch(job.instanceId);
        break;

      case 'create_pr':
        await this.githubIntegration.createPullRequest(job.instanceId);
        break;

      case 'evaluate_impact':
        await this.impactEvaluation.evaluateImpact(job.instanceId);
        break;

      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }
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
            `✅ EvolutionWorker | jobType=${job.jobType} | instance=${job.instanceId} | duration=${this.metrics.lastJobTime}ms`,
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
            `❌ EvolutionWorker failed | jobType=${job.jobType} | instance=${job.instanceId} | retry=${job.retryCount + 1}/${job.maxRetries}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      } catch (error) {
        this.logger.error(
          'Unexpected evolution worker error',
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