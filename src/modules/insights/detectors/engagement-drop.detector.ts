// src/modules/insights/detectors/engagement-drop.detector.ts

import { Injectable } from '@nestjs/common';
import { DetectedInsight } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import {
  calculateZScore,
  calculateCumulativeDistribution,
} from 'src/shared/utils/statistics';
import { InsightBuilder } from '../builders/insight.builder';

@Injectable()
export class EngagementDropDetector {
  constructor(private readonly confidenceCalc: ConfidenceCalculatorService) {}

  detectEngagementDrop(
    currentEngagement: number,
    baseline: BaselineEnvelope,
    projectId: string,
    componentId?: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    if (currentEngagement < baseline.stats.p50) {
      const percentChange =
        (baseline.stats.p50 - currentEngagement) / baseline.stats.p50;

      let severity = InsightSeverity.MEDIUM;
      const zScore = calculateZScore(
        currentEngagement,
        baseline.stats.mean,
        baseline.stats.stdDev,
      );

      const pValue =
        2 * (1 - calculateCumulativeDistribution(Math.abs(zScore)));

      if (currentEngagement < baseline.stats.p25 || zScore < -2.5) {
        severity = InsightSeverity.HIGH;
      }

      const statisticalResult =
        this.confidenceCalc.calculateStatisticalConfidence(
          pValue,
          baseline.stats.sampleSize,
        );

      const thresholdResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          currentEngagement,
          baseline.stats.sampleSize,
        );

      const combinedResult = this.confidenceCalc.combineConfidences([
        statisticalResult,
        thresholdResult,
      ]);

      return InsightBuilder.statistical({
        flag: InsightFlag.ENGAGEMENT_DISTRIBUTION_DROP,
        severity,
        projectId,
        componentId,
        reason: `Engagement is ${(percentChange * 100).toFixed(1)}% below median (p50)`,
        value: currentEngagement,
        baseline: baseline.stats.p50,
        percentageChange: -(percentChange * 100),
        confidence: combinedResult.value,
        confidenceMetadata: {
          model: combinedResult.model,
          pValue,
          zScore,
          effectSize: thresholdResult.effectSize,
          sampleSizeWeight: statisticalResult.sampleSizeWeight,
        },
        zScore,
        pValue,
        baselineType: baseline.type,
        baselineWindowDays: baseline.windowDays,
        context: {
          type: 'component',
        },
        comparison: {
          mode: baseline.type,
          lens: 'distribution',
          direction: 'decrease',
          baselinePercentile: 50,
        },
      });
    }

    return null;
  }
}