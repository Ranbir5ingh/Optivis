// src/modules/insights/detectors/form-abandonment.detector.ts

import { Injectable } from '@nestjs/common';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { DetectedInsight } from '../domain/detected-insight.model';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { InsightBuilder } from '../builders/insight.builder';

@Injectable()
export class FormAbandonmentDetector {
  constructor(private readonly confidenceCalc: ConfidenceCalculatorService) {}

  detectHighAbandonment(
    formId: string,
    abandonRate: number,
    baseline: BaselineEnvelope,
    projectId: string,
    componentId?: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const goodThreshold = baseline.stats.p90;
    if (abandonRate > goodThreshold) {
      const percentChange = (abandonRate - goodThreshold) / goodThreshold;

      let severity = InsightSeverity.MEDIUM;
      let percentile = 90;

      if (abandonRate > baseline.stats.p99) {
        severity = InsightSeverity.HIGH;
        percentile = 99;
      }

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          abandonRate,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.HIGH_FORM_ABANDON,
        severity,
        projectId,
        componentId,
        elementId: formId,
        reason: `Form abandon rate ${(abandonRate * 100).toFixed(1)}% exceeds p${percentile} threshold (${(goodThreshold * 100).toFixed(1)}%)`,
        value: abandonRate,
        baseline: goodThreshold,
        percentageChange: percentChange * 100,
        confidence: confidenceResult.value,
        confidenceMetadata: {
          model: confidenceResult.model,
          pValue: confidenceResult.pValue,
          zScore: confidenceResult.zScore,
          effectSize: confidenceResult.effectSize,
          sampleSizeWeight: confidenceResult.sampleSizeWeight,
        },
        baselineType: baseline.type,
        baselineWindowDays: baseline.windowDays,
        context: undefined,
        comparison: {
          mode: baseline.type,
          lens: 'distribution',
          direction: 'increase',
          baselinePercentile: percentile,
        },
      });
    }
    return null;
  }

  detectLowCompletion(
    formId: string,
    completionRate: number,
    baseline: BaselineEnvelope,
    projectId: string,
    componentId?: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const goodThreshold = baseline.stats.p25;
    if (completionRate < goodThreshold) {
      const percentChange = (goodThreshold - completionRate) / goodThreshold;

      let severity = InsightSeverity.MEDIUM;
      let percentile = 25;

      if (completionRate < baseline.stats.p25 * 0.5) {
        severity = InsightSeverity.HIGH;
        percentile = 10;
      }

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          completionRate,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.LOW_FORM_COMPLETION,
        severity,
        projectId,
        componentId,
        elementId: formId,
        reason: `Form completion rate ${(completionRate * 100).toFixed(1)}% is below p${percentile} threshold (${(goodThreshold * 100).toFixed(1)}%)`,
        value: completionRate,
        baseline: goodThreshold,
        percentageChange: -(percentChange * 100),
        confidence: confidenceResult.value,
        confidenceMetadata: {
          model: confidenceResult.model,
          pValue: confidenceResult.pValue,
          zScore: confidenceResult.zScore,
          effectSize: confidenceResult.effectSize,
          sampleSizeWeight: confidenceResult.sampleSizeWeight,
        },
        baselineType: baseline.type,
        baselineWindowDays: baseline.windowDays,
        context: undefined,
        comparison: {
          mode: baseline.type,
          lens: 'distribution',
          direction: 'decrease',
          baselinePercentile: percentile,
        },
      });
    }

    return null;
  }

  detectHighErrorRate(
    formId: string,
    errorRate: number,
    baseline: BaselineEnvelope,
    projectId: string,
    componentId?: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile: number | null = null;
    let thresholdUsed: number | null = null;

    if (errorRate > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
      thresholdUsed = criticalThreshold;
    } else if (errorRate > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
      thresholdUsed = warningThreshold;
    }

    if (severity && percentile !== null && thresholdUsed !== null) {
      const percentChange =
        (errorRate - baseline.stats.p50) / baseline.stats.p50;

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          errorRate,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.HIGH_FORM_ERRORS,
        severity,
        projectId,
        componentId,
        elementId: formId,
        reason: `Form error rate ${(errorRate * 100).toFixed(1)}% exceeds p${percentile} threshold (${(thresholdUsed * 100).toFixed(1)}%)`,
        value: errorRate,
        baseline: thresholdUsed,
        percentageChange: percentChange * 100,
        confidence: confidenceResult.value,
        confidenceMetadata: {
          model: confidenceResult.model,
          pValue: confidenceResult.pValue,
          zScore: confidenceResult.zScore,
          effectSize: confidenceResult.effectSize,
          sampleSizeWeight: confidenceResult.sampleSizeWeight,
        },
        baselineType: baseline.type,
        baselineWindowDays: baseline.windowDays,
        context: undefined,
        comparison: {
          mode: baseline.type,
          lens: 'distribution',
          direction: 'increase',
          baselinePercentile: percentile,
        },
      });
    }

    return null;
  }
}