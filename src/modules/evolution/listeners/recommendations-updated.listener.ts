// src/modules/evolution/listeners/recommendations-updated.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RecommendationLifecycleService } from '../services/recommendation-lifecycle.service';
import { AIReasoningRepository } from 'src/modules/ai-reasoning/repositories/ai-reasoning.repository';

interface RecommendationsGeneratedPayload {
  projectId: string;
  snapshotId: string;
}

@Injectable()
export class RecommendationsUpdatedListener {
  constructor(
    private readonly lifecycleService: RecommendationLifecycleService,
    private readonly aiReasoningRepo: AIReasoningRepository,
  ) {}

  @OnEvent('recommendations.generated')
  async handleRecommendationsGenerated(
    payload: RecommendationsGeneratedPayload,
  ): Promise<void> {
    const recommendations =
      await this.aiReasoningRepo.getLatestRecommendations(payload.projectId);

    if (!recommendations) {
      return;
    }

    for (const rec of recommendations.recommendations) {
      await this.lifecycleService.createInstance(
        payload.projectId,
        rec.recommendationHash,
        payload.snapshotId,
        {
          id: rec.id,
          insightFlag: rec.insightFlag,
          sourceInsightIds: rec.sourceInsightIds,
          componentId: rec.componentId,
          actionType: rec.actionType,
          riskLevel: rec.riskLevel,
          priority: rec.priority,
          confidence: rec.confidence,
          title: rec.title,
          explanation: rec.explanation,
          recommendation: rec.recommendation,
          implementationSteps: rec.implementationSteps,
          expectedImpact: rec.expectedImpact,
          reasoning: rec.reasoning,
          scope: rec.scope,
          successMetric: rec.successMetric,
          requiresMoreContext: rec.requiresMoreContext,
          recommendationHash: rec.recommendationHash,
        },
        {
          metricType: rec.successMetric.metric,
          expectedDelta: rec.successMetric.expectedDelta,
          evaluationWindowDays: rec.successMetric.evaluationWindowDays,
          successCriteria: `${rec.expectedImpact}`,
        },
      );
    }
  }
}