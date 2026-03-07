// src/modules/insights/detectors/funnel-bottleneck.detector.ts

import { Injectable } from '@nestjs/common';
import { DetectedInsight } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import { InsightBuilder } from '../builders/insight.builder';

@Injectable()
export class FunnelBottleneckDetector {
  constructor(private readonly confidenceCalc: ConfidenceCalculatorService) {}

  detect(
    funnelName: string,
    stepIndex: number,
    stepName: string,
    currentDropOff: number,
    baseline: BaselineEnvelope,
    projectId: string,
    funnelDefId: string,
  ): DetectedInsight | null {
    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile: number | null = null;
    let thresholdUsed: number | null = null;

    if (currentDropOff > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
      thresholdUsed = criticalThreshold;
    } else if (currentDropOff > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
      thresholdUsed = warningThreshold;
    }

    if (!severity || percentile === null || thresholdUsed === null) {
      return null;
    }

    const percentChange =
      thresholdUsed > 0
        ? ((currentDropOff - thresholdUsed) / thresholdUsed) * 100
        : currentDropOff * 100;

    const confidenceResult =
      this.confidenceCalc.calculateThresholdConfidenceStatistical(
        severity,
        baseline.type,
        baseline.stats.mean,
        baseline.stats.stdDev,
        currentDropOff,
        baseline.stats.sampleSize,
      );

    return InsightBuilder.threshold({
      flag: InsightFlag.FUNNEL_BOTTLENECK,
      severity,
      projectId,
      reason: `Funnel "${funnelName}" step "${stepName}" has ${(currentDropOff * 100).toFixed(1)}% drop-off (baseline p${percentile}: ${(thresholdUsed * 100).toFixed(1)}%)`,
      value: currentDropOff,
      baseline: thresholdUsed,
      percentageChange: percentChange,
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
      context: {
        type: 'funnel',
        funnelId: funnelDefId,
        funnelStep: stepIndex,
      },
      comparison: {
        mode: baseline.type,
        lens: 'distribution',
        direction: 'increase',
        baselinePercentile: percentile,
      },
    });
  }
}
