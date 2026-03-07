// src/modules/project-summary/project-summary.module.ts

import { Module } from '@nestjs/common';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { InsightsModule } from '../insights/insights.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectSummaryService } from './services/project-summary.service';
import { HealthScoringService } from './services/health-scoring.service';
import { ProjectSummaryController } from './project-summary.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [DrizzleModule, InsightsModule, AiReasoningModule, ProjectsModule, OrganizationsModule, EvolutionModule],
  providers: [HealthScoringService, ProjectSummaryService],
  controllers: [ProjectSummaryController],
  exports: [HealthScoringService, ProjectSummaryService],
})
export class ProjectSummaryModule {}