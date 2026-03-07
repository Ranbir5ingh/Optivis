// src/modules/insights/insights.module.ts

import { Module } from '@nestjs/common';

import { InsightEngineService } from './engine/insight-engine.service';
import { InsightMapperService } from './engine/insight-mapper.service';

import { CtrDropDetector } from './detectors/ctr-drop.detector';
import { EngagementDropDetector } from './detectors/engagement-drop.detector';
import { PerformanceRegressionDetector } from './detectors/performance-regression.detector';
import { StatisticalSignificanceDetector } from './detectors/statistical-significance.detector';
import { PatternDetector } from './detectors/pattern.detector';
import { CohortDetector } from './detectors/cohort.detector';
import { FunnelBottleneckDetector } from './detectors/funnel-bottleneck.detector';

import { InsightsRepository } from './repositories/insights.repository';
import { InsightsJobsRepository } from './repositories/insights-jobs.repository';
import { InsightsCursorRepository } from './repositories/insights-cursor.repository';

import { InsightsCronJobCreatorService } from './jobs/cron-job-creator.job';
import { InsightsWorker } from './workers/insights.worker';

import { InsightsController } from './insights.controller';

import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AggregationModule } from '../aggregation/aggregation.module';
import { FunnelsModule } from '../funnels/funnels.module';

import { FormAbandonmentDetector } from './detectors/form-abandonment.detector';
import { BehavioralSignalsDetector } from './detectors/behavioral-signals.detector';
import { FunnelAnalyzerService } from './analyzers/funnel-analyzer.service';
import { FunnelOptimizerService } from './analyzers/funnel-optimizer.service';
import { FunnelInsightsService } from './services/funnel-insights.service';
import { InsightsCursorInitializationService } from './services/insights-cursor-initialization.service';
import { InsightsProjectListener } from './listeners/insights-project.listener';
import { BaselineCalculatorService } from './services/baseline-calculator.service';
import { InsightIdentityService } from './services/insight-identity.service';
import { ConfidenceCalculatorService } from './services/confidence-calculator.service';
import { SampleSizeValidatorService } from './services/sample-size-validator.service';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    DrizzleModule,
    ProjectsModule,
    OrganizationsModule,
    AggregationModule,
    FunnelsModule,
  ],

  providers: [
    InsightEngineService,
    InsightMapperService,
    InsightIdentityService,
    SampleSizeValidatorService,

    CtrDropDetector,
    EngagementDropDetector,
    PerformanceRegressionDetector,
    BaselineCalculatorService,
    ConfidenceCalculatorService,
    StatisticalSignificanceDetector,
    PatternDetector,
    CohortDetector,
    FunnelAnalyzerService,
    FunnelOptimizerService,
    FunnelBottleneckDetector,
    FormAbandonmentDetector,
    BehavioralSignalsDetector,

    FunnelInsightsService,
    InsightsCursorInitializationService,
    InsightsProjectListener,

    InsightsRepository,
    InsightsJobsRepository,
    InsightsCursorRepository,

    InsightsCronJobCreatorService,
    InsightsWorker,
  ],

  controllers: [InsightsController],

  exports: [
    InsightEngineService,
    InsightsRepository,
    FunnelAnalyzerService,
    FunnelOptimizerService,
    FunnelInsightsService,
  ],
})
export class InsightsModule {}
