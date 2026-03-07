// src/modules/evolution/services/impact-evaluation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { AnalyticsReadRepository } from 'src/modules/aggregation/repositories/analytics-read.repository';
import { DomainError } from 'src/common/exceptions/domain-error';

@Injectable()
export class ImpactEvaluationService {
  private readonly logger = new Logger(ImpactEvaluationService.name);

  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly analyticsRepo: AnalyticsReadRepository,
  ) {}

  async evaluateImpact(instanceId: string): Promise<void> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    if (instance.status !== 'merged') {
      throw new DomainError(
        'INVALID_STATUS',
        `Cannot evaluate impact in ${instance.status} status`,
        'conflict',
      );
    }

    if (!instance.mergedAt) {
      throw new DomainError(
        'NOT_MERGED',
        'Recommendation not yet merged',
        'validation',
      );
    }

    const evaluationWindowEnds = new Date(instance.evaluationWindowEndsAt!);
    const now = new Date();

    if (now < evaluationWindowEnds) {
      throw new DomainError(
        'EVALUATION_WINDOW_NOT_COMPLETE',
        'Evaluation window has not ended',
        'conflict',
      );
    }

    try {
      const metricType = instance.metadata.metricType;
      const baselineDate = new Date(instance.mergedAt);
      const evaluationDate = evaluationWindowEnds;

      const baselineValue = await this.getMetricBaseline(
        instance.projectId,
        metricType,
        baselineDate,
      );

      const postValue = await this.getMetricValue(
        instance.projectId,
        metricType,
        evaluationDate,
      );

      const expectedDelta = instance.metadata.expectedDelta;
      const actualDelta = this.calculateDelta(baselineValue, postValue);
      const success = this.evaluateSuccess(actualDelta, expectedDelta);

      const impactScore = this.calculateImpactScore(
        actualDelta,
        expectedDelta,
        success,
      );

      await this.instancesRepo.updateStatus(
        instanceId,
        success ? 'validated' : 'invalidated',
        {
          impactEvaluatedAt: new Date(),
          baselineMetricValue: baselineValue,
          postMetricValue: postValue,
          impactScore,
          metadata: {
            ...instance.metadata,
            failureReason: success
              ? undefined
              : `Actual delta ${actualDelta}% did not meet expected ${expectedDelta}%`,
          },
        },
      );

      this.logger.log(
        `Evaluated impact for ${instanceId}: ${success ? 'VALIDATED' : 'INVALIDATED'} (${impactScore}%)`,
      );
    } catch (error) {
      throw new DomainError(
        'EVALUATION_FAILED',
        `Failed to evaluate impact: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'unexpected',
      );
    }
  }

  private async getMetricBaseline(
    projectId: string,
    metricType: string,
    baselineDate: Date,
  ): Promise<number> {
    const sevenDaysAgo = new Date(baselineDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    switch (metricType) {
      case 'ctr': {
        const components = await this.analyticsRepo.getDailyComponentMetrics(
          projectId,
          sevenDaysAgo,
          baselineDate,
        );
        const avgCtr =
          components.reduce((sum, c) => sum + (c.ctr || 0), 0) /
            (components.length || 1) || 0;
        return avgCtr;
      }
      case 'engagement': {
        const components = await this.analyticsRepo.getDailyComponentMetrics(
          projectId,
          sevenDaysAgo,
          baselineDate,
        );
        const avgEngagement =
          components.reduce(
            (sum, c) => sum + (c.engagementScore || 0),
            0,
          ) / (components.length || 1) || 0;
        return avgEngagement;
      }
      case 'bounce_rate': {
        const sessions = await this.analyticsRepo.getDailySessionMetrics(
          projectId,
          sevenDaysAgo,
          baselineDate,
        );
        const avgBounce =
          sessions.reduce((sum, s) => sum + (s.bounceRate || 0), 0) /
            (sessions.length || 1) || 0;
        return avgBounce;
      }
      default:
        return 0;
    }
  }

  private async getMetricValue(
    projectId: string,
    metricType: string,
    evaluationDate: Date,
  ): Promise<number> {
    const threeDaysAfter = new Date(evaluationDate);
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

    return this.getMetricBaseline(projectId, metricType, threeDaysAfter);
  }

  private calculateDelta(baseline: number, post: number): number {
    if (baseline === 0) return post > 0 ? 100 : 0;
    return ((post - baseline) / baseline) * 100;
  }

  private evaluateSuccess(actualDelta: number, expectedDelta: number): boolean {
    if (expectedDelta > 0) {
      return actualDelta >= expectedDelta * 0.8;
    }
    return actualDelta <= expectedDelta * 0.8;
  }

  private calculateImpactScore(
    actualDelta: number,
    expectedDelta: number,
    success: boolean,
  ): number {
    if (!success) return Math.max(0, 50 + actualDelta);

    const achievement = Math.abs(actualDelta / expectedDelta) * 100;
    return Math.min(100, achievement);
  }
}