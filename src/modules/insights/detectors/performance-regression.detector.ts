// src/modules/insights/detectors/performance-regression.detector.ts

import { Injectable } from '@nestjs/common';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { DetectedInsight } from '../domain/detected-insight.model';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { InsightBuilder } from '../builders/insight.builder';

@Injectable()
export class PerformanceRegressionDetector {
  constructor(
    private readonly confidenceCalc: ConfidenceCalculatorService,
  ) {}

  detectLcpRegression(
    currentLcp: number,
    baseline: BaselineEnvelope,
    projectId: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile = 0;

    if (currentLcp > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
    } else if (currentLcp > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
    }

    if (severity) {
      const percentChange =
        (currentLcp - baseline.stats.mean) / baseline.stats.mean;
      const threshold =
        severity === InsightSeverity.HIGH
          ? baseline.stats.p99
          : baseline.stats.p90;

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          currentLcp,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.PERF_LCP_REGRESSION,
        severity,
        projectId,
        reason: `LCP (${currentLcp.toFixed(0)}ms) exceeds p${percentile} threshold`,
        value: currentLcp,
        baseline: threshold,
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

  detectClsRegression(
    currentCls: number,
    baseline: BaselineEnvelope,
    projectId: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile = 0;

    if (currentCls > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
    } else if (currentCls > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
    }

    if (severity) {
      const percentChange =
        (currentCls - baseline.stats.mean) / baseline.stats.mean;
      const threshold =
        severity === InsightSeverity.HIGH
          ? baseline.stats.p99
          : baseline.stats.p90;

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          currentCls,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.PERF_CLS_REGRESSION,
        severity,
        projectId,
        reason: `CLS (${currentCls.toFixed(3)}) exceeds p${percentile} threshold`,
        value: currentCls,
        baseline: threshold,
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

  detectInpRegression(
    currentInp: number,
    baseline: BaselineEnvelope,
    projectId: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile = 0;

    if (currentInp > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
    } else if (currentInp > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
    }

    if (severity) {
      const percentChange =
        (currentInp - baseline.stats.mean) / baseline.stats.mean;
      const threshold =
        severity === InsightSeverity.HIGH
          ? baseline.stats.p99
          : baseline.stats.p90;

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          currentInp,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.PERF_INP_REGRESSION,
        severity,
        projectId,
        reason: `INP (${currentInp.toFixed(0)}ms) exceeds p${percentile} threshold`,
        value: currentInp,
        baseline: threshold,
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

  detectTtfbRegression(
    currentTtfb: number,
    baseline: BaselineEnvelope,
    projectId: string,
  ): DetectedInsight | null {
    if (!baseline) return null;

    const warningThreshold = baseline.stats.p90;
    const criticalThreshold = baseline.stats.p99;

    let severity: InsightSeverity | null = null;
    let percentile = 0;

    if (currentTtfb > criticalThreshold) {
      severity = InsightSeverity.HIGH;
      percentile = 99;
    } else if (currentTtfb > warningThreshold) {
      severity = InsightSeverity.MEDIUM;
      percentile = 90;
    }

    if (severity) {
      const percentChange =
        (currentTtfb - baseline.stats.mean) / baseline.stats.mean;
      const threshold =
        severity === InsightSeverity.HIGH
          ? baseline.stats.p99
          : baseline.stats.p90;

      const confidenceResult =
        this.confidenceCalc.calculateThresholdConfidenceStatistical(
          severity,
          baseline.type,
          baseline.stats.mean,
          baseline.stats.stdDev,
          currentTtfb,
          baseline.stats.sampleSize,
        );

      return InsightBuilder.threshold({
        flag: InsightFlag.PERF_TTFB_REGRESSION,
        severity,
        projectId,
        reason: `TTFB (${currentTtfb.toFixed(0)}ms) exceeds p${percentile} threshold`,
        value: currentTtfb,
        baseline: threshold,
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