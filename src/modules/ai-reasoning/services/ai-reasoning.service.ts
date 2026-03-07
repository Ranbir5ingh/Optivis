// src/modules/ai-reasoning/services/ai-reasoning.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ContextAssemblerService } from './context-assembler.service';
import { RecommendationGeneratorService } from './recommendation-generator.service';
import { AIReasoningRepository } from '../repositories/ai-reasoning.repository';
import { AIReasoningJobsRepository } from '../repositories/ai-reasoning-jobs.repository';
import { AIReasoningSnapshotService } from './ai-reasoning-snapshot.service';
import { AIReasoningResult } from '../domain/recommendation.types';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AIReasoningService {
  private readonly logger = new Logger(AIReasoningService.name);

  constructor(
    private readonly contextAssembler: ContextAssemblerService,
    private readonly recommendationGenerator: RecommendationGeneratorService,
    private readonly reasoningRepo: AIReasoningRepository,
    private readonly jobsRepo: AIReasoningJobsRepository,
    private readonly snapshotService: AIReasoningSnapshotService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateRecommendations(
    projectId: string,
    options: {
      maxInsights?: number;
      maxComponents?: number;
      severityFilter?: Array<'high' | 'medium' | 'low' | 'info'>;
      saveToDatabase?: boolean;
      commitSha?: string;
    } = {},
  ): Promise<AIReasoningResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Generating AI recommendations for project ${projectId}`);

      const context = await this.contextAssembler.assembleContext(projectId, {
        maxInsights: options.maxInsights,
        maxComponents: options.maxComponents,
        severityFilter: options.severityFilter,
      });

      if (context.insights.length === 0) {
        this.logger.debug(`No insights available for project ${projectId}`);
        return this.emptyResult(options.commitSha);
      }

      const result = await this.recommendationGenerator.generate(
        context,
        options.commitSha,
      );

      let snapshotId: string | undefined;

      if (options.saveToDatabase !== false) {
        snapshotId = await this.reasoningRepo.saveRecommendations(
          projectId,
          result,
        );

        this.eventEmitter.emit('recommendations.generated', {
          projectId,
          snapshotId,
        });
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `Generated ${result.recommendations.length} recommendations for ${projectId} in ${duration}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate recommendations for ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async enqueueRecommendationJob(
    projectId: string,
    triggerType: string,
  ): Promise<void> {
    try {
      const hash =
        await this.snapshotService.generateInsightSnapshot(projectId);

      const exists = await this.jobsRepo.existsByHashAndProject(
        projectId,
        hash,
      );

      if (exists) {
        this.logger.debug(
          `Skipping job enqueue: same insight snapshot hash for ${projectId}`,
        );
        return;
      }

      await this.jobsRepo.create({
        projectId,
        status: 'pending',
        triggerType,
        insightSnapshotHash: hash,
        maxRetries: 3,
      });

      this.logger.debug(
        `Enqueued AI reasoning job for project ${projectId} (trigger: ${triggerType})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue job for ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getLatestRecommendations(
    projectId: string,
  ): Promise<AIReasoningResult | null> {
    return this.reasoningRepo.getLatestRecommendations(projectId);
  }

  async getRecommendationHistory(
    projectId: string,
    limit: number = 10,
  ): Promise<AIReasoningResult[]> {
    return this.reasoningRepo.getRecommendationHistory(projectId, limit);
  }

  async getRecommendationStatus(projectId: string): Promise<{
    lastGeneratedAt: Date | null;
    jobStatus: string | null;
    triggerType: string | null;
    insightSnapshotHash: string | null;
  }> {
    const latest = await this.reasoningRepo.getLatestRecommendations(projectId);

    return {
      lastGeneratedAt: latest?.metadata.generatedAt
        ? new Date(latest.metadata.generatedAt)
        : null,
      jobStatus: null,
      triggerType: null,
      insightSnapshotHash: null,
    };
  }

  private emptyResult(commitSha?: string): AIReasoningResult {
    return {
      recommendations: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        estimatedImprovementPotential: 'No issues detected',
      },
      metadata: {
        tokensUsed: { input: 0, output: 0 },
        model: 'none',
        generatedAt: new Date().toISOString(),
        reasoningVersion: '1.0.0',
        commitSha,
      },
    };
  }
}
