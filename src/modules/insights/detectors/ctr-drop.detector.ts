// src/modules/insights/detectors/ctr-drop.detector.ts

import { Injectable } from '@nestjs/common';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { DetectedInsight } from '../domain/detected-insight.model';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import {
  calculateCumulativeDistribution,
  calculateZScore,
} from 'src/shared/utils/statistics';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { InsightBuilder } from '../builders/insight.builder';

@Injectable()
export class CtrDropDetector {
  constructor(private readonly confidenceCalc: ConfidenceCalculatorService) {}

  detectCtrDrop(
    current: number,
    baseline: BaselineEnvelope,
    projectId: string,
    componentId?: string,
    elementId?: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    if (current < baseline.stats.p50) {
      const percentChange = (baseline.stats.p50 - current) / baseline.stats.p50;

      let severity = InsightSeverity.MEDIUM;
      const zScore = calculateZScore(
        current,
        baseline.stats.mean,
        baseline.stats.stdDev,
      );

      const pValue = 2 * (1 - calculateCumulativeDistribution(Math.abs(zScore)));

      if (current < baseline.stats.p25 || zScore < -2.5) {
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
          current,
          baseline.stats.sampleSize,
        );

      const combinedResult = this.confidenceCalc.combineConfidences([
        statisticalResult,
        thresholdResult,
      ]);

      return InsightBuilder.statistical({
        flag: InsightFlag.LOW_CTR,
        severity,
        projectId,
        componentId,
        elementId,
        reason: `CTR is ${(percentChange * 100).toFixed(1)}% below median (p50)`,
        value: current,
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
        context: undefined,
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