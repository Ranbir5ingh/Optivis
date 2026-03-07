// src/modules/project-summary/services/health-scoring.service.ts

import { Injectable } from '@nestjs/common';
import { InsightsRepository } from '../../insights/repositories/insights.repository';
import { InsightSeverity } from '../../insights/domain/insight-flag.enum';

export interface HealthScoreResult {
  score: number;
  state: 'healthy' | 'moderate' | 'warning' | 'critical';
  activeInsights: number;
  criticalInsights: number;
}

@Injectable()
export class HealthScoringService {
  private readonly SEVERITY_WEIGHTS = {
    [InsightSeverity.HIGH]: 15,
    [InsightSeverity.MEDIUM]: 8,
    [InsightSeverity.LOW]: 4,
    [InsightSeverity.INFO]: 1,
  };

  private readonly CONFIDENCE_MULTIPLIERS = {
    LOW: 0.5,
    MEDIUM: 0.8,
    HIGH: 1.0,
    VERY_HIGH: 1.2,
  };

  private readonly IMPACT_WEIGHTS = {
    conversion_rate: 1.3,
    ctr: 1.2,
    bounce_rate: 1.2,
    ttfb: 1.1,
    engagement: 1.1,
    scroll_depth: 1.0,
  };

  constructor(private readonly insightsRepository: InsightsRepository) {}

  async calculateHealthScore(projectId: string): Promise<HealthScoreResult> {
    const insights =
      await this.insightsRepository.getUnresolvedInsights(projectId);

    let score = 95;
    const criticalInsights = insights.filter(
      (i) => i.severity === InsightSeverity.HIGH,
    ).length;

    for (const insight of insights) {
      const severityWeight = this.SEVERITY_WEIGHTS[insight.severity];
      const confidenceMultiplier = this.getConfidenceMultiplier(
        insight.confidence,
      );
      const impactWeight = this.getImpactWeight(insight.flag);

      const penalty = severityWeight * confidenceMultiplier * impactWeight;
      score = Math.max(0, score - penalty);
    }

    const state = this.deriveState(score);

    return {
      score: Math.round(score),
      state,
      activeInsights: insights.length,
      criticalInsights,
    };
  }

  private getConfidenceMultiplier(confidence: number | undefined): number {
    if (confidence === undefined) {
      return this.CONFIDENCE_MULTIPLIERS.MEDIUM;
    }

    if (confidence >= 0.85) {
      return this.CONFIDENCE_MULTIPLIERS.VERY_HIGH;
    }
    if (confidence >= 0.7) {
      return this.CONFIDENCE_MULTIPLIERS.HIGH;
    }
    if (confidence >= 0.5) {
      return this.CONFIDENCE_MULTIPLIERS.MEDIUM;
    }

    return this.CONFIDENCE_MULTIPLIERS.LOW;
  }

  private getImpactWeight(flag: string): number {
    const flagLower = flag.toLowerCase();

    if (flagLower.includes('conversion') || flagLower.includes('funnel')) {
      return this.IMPACT_WEIGHTS.conversion_rate;
    }
    if (flagLower.includes('ctr') || flagLower.includes('click')) {
      return this.IMPACT_WEIGHTS.ctr;
    }
    if (flagLower.includes('bounce')) {
      return this.IMPACT_WEIGHTS.bounce_rate;
    }
    if (flagLower.includes('ttfb') || flagLower.includes('server')) {
      return this.IMPACT_WEIGHTS.ttfb;
    }
    if (flagLower.includes('engagement')) {
      return this.IMPACT_WEIGHTS.engagement;
    }
    if (flagLower.includes('scroll')) {
      return this.IMPACT_WEIGHTS.scroll_depth;
    }

    return 1.0;
  }

  private deriveState(
    score: number,
  ): 'healthy' | 'moderate' | 'warning' | 'critical' {
    if (score >= 80) {
      return 'healthy';
    }
    if (score >= 60) {
      return 'moderate';
    }
    if (score >= 40) {
      return 'warning';
    }

    return 'critical';
  }
}
