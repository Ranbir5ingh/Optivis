// src/modules/aggregation/aggregation.module.ts

import { Module } from '@nestjs/common';
import { AggregationWriteRepository } from './repositories/aggregation-write.repository';
import { AggregationCursorRepository } from './repositories/aggregation-cursor.repository';
import { AggregationJobsRepository } from './repositories/aggregation-jobs.repository';
import { FunnelsRepository } from './repositories/funnels.repository';

import { HourlyPageAggregatorService } from './aggregators/hourly-page-aggregator.service';
import { HourlyComponentAggregatorService } from './aggregators/hourly-component-aggregator.service';
import { HourlyElementAggregatorService } from './aggregators/hourly-element-aggregator.service';
import { HourlySessionAggregatorService } from './aggregators/hourly-session-aggregator.service';
import { DailyPageAggregatorService } from './aggregators/daily-page-aggregator.service';
import { DailySessionAggregatorService } from './aggregators/daily-session-aggregator.service';
import { DailyComponentAggregatorService } from './aggregators/daily-component-aggregator.service';
import { DailyElementAggregatorService } from './aggregators/daily-element-aggregator.service';
import { DailyFunnelAggregatorService } from './aggregators/daily-funnel-aggregator.service';

import { EngagementCalculatorService } from './services/engagement-calculator.service';
import { TrendCalculatorService } from './services/trend-calculator.service';

import { CronJobCreatorService } from './jobs/cron-job-creator.job';
import { AggregationWorker } from './workers/aggregation.worker';
import { RetentionCleanupJob } from './jobs/retention-cleanup.job';

import { AggregationController } from './aggregation.controller';

import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { DailyFormAggregatorService } from './aggregators/daily-form-aggregator.service';
import { DailyPerformanceAggregatorService } from './aggregators/daily-performance-aggregator.service';
import { CursorInitializationService } from './services/cursor-initialization.service';
import { AggregationProjectListener } from './listeners/aggregation-project.listener';
import { DailyBehavioralAggregatorService } from './aggregators/daily-behavioral-aggregator.service';
import { AnalyticsReadRepository } from './repositories/analytics-read.repository';

@Module({
  imports: [DrizzleModule],

  providers: [
    AggregationWriteRepository,
    AggregationCursorRepository,
    AggregationJobsRepository,
    FunnelsRepository,
    AnalyticsReadRepository,

    HourlyPageAggregatorService,
    HourlyComponentAggregatorService,
    HourlyElementAggregatorService,
    HourlySessionAggregatorService,
    DailyPerformanceAggregatorService,
    DailyFormAggregatorService,
    DailyPageAggregatorService,
    DailySessionAggregatorService,
    DailyComponentAggregatorService,
    DailyElementAggregatorService,
    DailyFunnelAggregatorService,
    DailyBehavioralAggregatorService,

    EngagementCalculatorService,
    TrendCalculatorService,

    CursorInitializationService,
    AggregationProjectListener,
    CronJobCreatorService,
    AggregationWorker,
    RetentionCleanupJob,
  ],

  controllers: [AggregationController],

  exports: [
    HourlyPageAggregatorService,
    HourlyComponentAggregatorService,
    HourlyElementAggregatorService,
    HourlySessionAggregatorService,
    DailyPerformanceAggregatorService,
    DailyFormAggregatorService,
    DailyPageAggregatorService,
    DailySessionAggregatorService,
    DailyComponentAggregatorService,
    DailyElementAggregatorService,
    DailyFunnelAggregatorService,
    DailyBehavioralAggregatorService,
    AnalyticsReadRepository,
  ],
})
export class AggregationModule {}
