// src/modules/aggregation/workers/aggregation.worker.ts

import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { AggregationJobsRepository } from '../repositories/aggregation-jobs.repository';
import { HourlyPageAggregatorService } from '../aggregators/hourly-page-aggregator.service';
import { HourlyComponentAggregatorService } from '../aggregators/hourly-component-aggregator.service';
import { HourlyElementAggregatorService } from '../aggregators/hourly-element-aggregator.service';
import { HourlySessionAggregatorService } from '../aggregators/hourly-session-aggregator.service';
import { DailyPageAggregatorService } from '../aggregators/daily-page-aggregator.service';
import { DailySessionAggregatorService } from '../aggregators/daily-session-aggregator.service';
import { DailyComponentAggregatorService } from '../aggregators/daily-component-aggregator.service';
import { DailyElementAggregatorService } from '../aggregators/daily-element-aggregator.service';
import { DailyFunnelAggregatorService } from '../aggregators/daily-funnel-aggregator.service';
import { ConfigService } from '@nestjs/config';
import { DailyPerformanceAggregatorService } from '../aggregators/daily-performance-aggregator.service';
import { DailyFormAggregatorService } from '../aggregators/daily-form-aggregator.service';
import { AggregationJobRow } from 'src/database/drizzle/schema';
import { DailyBehavioralAggregatorService } from '../aggregators/daily-behavioral-aggregator.service';

interface WorkerMetrics {
  totalProcessed: number;
  totalFailed: number;
  consecutiveEmpty: number;
  lastJobTime: number;
}

@Injectable()
export class AggregationWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AggregationWorker.name);
  private running = false;
  private metrics: WorkerMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    consecutiveEmpty: 0,
    lastJobTime: 0,
  };

  constructor(
    private readonly jobsRepo: AggregationJobsRepository,
    private readonly hourlyPageAggregator: HourlyPageAggregatorService,
    private readonly hourlyComponentAggregator: HourlyComponentAggregatorService,
    private readonly hourlyElementAggregator: HourlyElementAggregatorService,
    private readonly hourlySessionAggregator: HourlySessionAggregatorService,
    private readonly dailyPerformanceAggregator: DailyPerformanceAggregatorService,
    private readonly dailyFormAggregator: DailyFormAggregatorService,
    private readonly dailyPageAggregator: DailyPageAggregatorService,
    private readonly dailySessionAggregator: DailySessionAggregatorService,
    private readonly dailyBehavioralAggregator: DailyBehavioralAggregatorService,
    private readonly componentAggregator: DailyComponentAggregatorService,
    private readonly elementAggregator: DailyElementAggregatorService,
    private readonly funnelAggregator: DailyFunnelAggregatorService,

    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.configService.get<string>('ENABLE_AGGREGATION_WORKER') !== 'true'
    ) {
      this.logger.warn('Aggregation worker disabled via ENV');
      return;
    }

    this.logger.log('🚀 Aggregation worker starting');
    this.running = true;

    setImmediate(() => this.run());

    this.startMetricsLogging();
  }

  onModuleDestroy(): void {
    this.logger.log('🛑 Aggregation worker stopping');
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

  private async processJob(job: AggregationJobRow): Promise<void> {
    const date = new Date(job.windowStart);

    switch (job.pipeline) {
      case 'hourly_page_metrics':
        await this.hourlyPageAggregator.aggregateHour(job.projectId, date);
        break;

      case 'hourly_component_metrics':
        await this.hourlyComponentAggregator.aggregateHour(job.projectId, date);
        break;

      case 'hourly_element_metrics':
        await this.hourlyElementAggregator.aggregateHour(job.projectId, date);
        break;

      case 'hourly_session_metrics':
        await this.hourlySessionAggregator.aggregateHour(job.projectId, date);
        break;

      case 'daily_performance_metrics':
        await this.dailyPerformanceAggregator.aggregateDate(
          job.projectId,
          date,
        );
        break;

      case 'daily_form_metrics':
        await this.dailyFormAggregator.aggregateDate(job.projectId, date);
        break;

      case 'daily_page_metrics':
        await this.dailyPageAggregator.aggregateDate(job.projectId, date);
        break;

      case 'daily_session_metrics':
        await this.dailySessionAggregator.aggregateDate(job.projectId, date);
        break;
        
      case 'daily_component_metrics':
        await this.componentAggregator.aggregateDate(job.projectId, date);
        break;

      case 'daily_element_metrics':
        await this.elementAggregator.aggregateDate(job.projectId, date);
        break;

      case 'daily_behavioral_metrics':
        await this.dailyBehavioralAggregator.aggregateDate(job.projectId, date);
        break;

      case 'daily_funnel_metrics':
        await this.funnelAggregator.aggregateFunnels(job.projectId, date);
        break;

      default:
        throw new Error(`Unknown pipeline: ${job.pipeline}`);
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
            `✅ AggregationWorker | pipeline=${job.pipeline} | project=${job.projectId} | duration=${this.metrics.lastJobTime}ms`,
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
            `❌ AggregationWorker failed | pipeline=${job.pipeline} | project=${job.projectId} | retry=${job.retryCount + 1}/${job.maxRetries}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      } catch (error) {
        this.logger.error(
          'Unexpected aggregation worker error',
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