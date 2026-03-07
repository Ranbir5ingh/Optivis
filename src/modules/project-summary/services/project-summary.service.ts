// src/modules/project-summary/services/project-summary.service.ts

import { Injectable } from '@nestjs/common';
import { TrackingRepository } from '../../tracking/repositories/tracking.repository';
import { DomainError } from 'src/common/exceptions/domain-error';
import { ProjectsService } from 'src/modules/projects/services/projects.service';
import { HealthScoringService } from './health-scoring.service';
import { ProjectSummaryModel } from '../domain/project-summary.model';
import { AIReasoningService } from 'src/modules/ai-reasoning/services/ai-reasoning.service';
import { RecommendationLifecycleService } from 'src/modules/evolution/services/recommendation-lifecycle.service';

@Injectable()
export class ProjectSummaryService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly healthScoringService: HealthScoringService,
    private readonly lifecycleService: RecommendationLifecycleService,
  ) {}

  async getSummary(projectId: string): Promise<ProjectSummaryModel> {
    const project = await this.projectsService.getByIdOrThrow(projectId);

    if (!project) {
      throw new DomainError(
        'PROJECT_NOT_FOUND',
        'Project not found',
        'not_found',
        { projectId },
      );
    }

    const [healthScore, recommendationsActiveCount] = await Promise.all([
      this.healthScoringService.calculateHealthScore(projectId),
      this.lifecycleService.getActiveRecommendations(projectId),
    ]);

    return {
      projectId,
      projectName: project.name,
      recommendationsActive: recommendationsActiveCount,
      healthScore: healthScore.score,
      healthState: healthScore.state,
    };
  }
}