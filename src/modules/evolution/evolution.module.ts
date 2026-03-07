// src/modules/evolution/evolution.module.ts

import { Module } from '@nestjs/common';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { CodeIntelligenceModule } from '../code-intelligence/code-intelligence.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';
import { AggregationModule } from '../aggregation/aggregation.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { RecommendationInstancesRepository } from './repositories/recommendation-instances.repository';
import { EvolutionJobsRepository } from './repositories/evolution-jobs.repository';
import { EvolutionCursorRepository } from './repositories/evolution-cursor.repository';

import { RecommendationLifecycleService } from './services/recommendation-lifecycle.service';
import { PatchGenerationService } from './services/patch-generation.service';
import { GithubIntegrationService } from './services/github-integration.service';
import { ImpactEvaluationService } from './services/impact-evaluation.service';
import { EvolutionCursorInitializationService } from './services/evolution-cursor-initialization.service';
import { ImpactEvaluationCronService } from './services/impact-evaluation-cron.service';

import { EvolutionWorker } from './workers/evolution.worker';
import { EvolutionProjectListener } from './listeners/evolution-project.listener';
import { RecommendationsUpdatedListener } from './listeners/recommendations-updated.listener';

import { EvolutionController } from './controllers/evolution.controller';
import { RecommendationStateMachineService } from './services/recommendation-state-machine.service';
import { PRMergedListener } from './listeners/pr-merged.listener';
import { RecommendationInstancesService } from './services/recommendation-instances.service';

@Module({
  imports: [
    DrizzleModule,
    CodeIntelligenceModule,
    AiReasoningModule,
    AggregationModule,
    ProjectsModule,
    OrganizationsModule,
  ],

  providers: [
    RecommendationInstancesRepository,
    EvolutionJobsRepository,
    EvolutionCursorRepository,

    RecommendationLifecycleService,
    RecommendationStateMachineService,
    RecommendationInstancesService,
    PatchGenerationService,
    GithubIntegrationService,
    ImpactEvaluationService,
    EvolutionCursorInitializationService,
    ImpactEvaluationCronService,

    EvolutionWorker,
    EvolutionProjectListener,
    RecommendationsUpdatedListener,
    PRMergedListener,
  ],

  controllers: [EvolutionController],

  exports: [
    RecommendationLifecycleService,
    RecommendationInstancesService,
    PatchGenerationService,
    GithubIntegrationService,
    ImpactEvaluationService,
  ],
})
export class EvolutionModule {}
