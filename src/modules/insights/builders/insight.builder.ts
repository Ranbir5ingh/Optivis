// src/modules/insights/builders/insight.builder.ts

import { DetectedInsight, ConfidenceMetadata } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';

export interface StatisticalInsightInput {
  flag: InsightFlag;
  severity: InsightSeverity;
  projectId: string;
  reason: string;
  value: number;
  baseline: number;
  percentageChange: number;
  confidence: number;
  confidenceMetadata?: ConfidenceMetadata;
  zScore: number;
  pValue: number;
  componentId?: string;
  elementId?: string;
  context?: DetectedInsight['context'];
  comparison?: DetectedInsight['comparison'];
  baselineType?: 'historical' | 'heuristic';
  baselineWindowDays?: number;
}

export interface ThresholdInsightInput {
  flag: InsightFlag;
  severity: InsightSeverity;
  projectId: string;
  reason: string;
  value: number;
  confidence: number;
  confidenceMetadata?: ConfidenceMetadata;
  componentId?: string;
  elementId?: string;
  baseline?: number;
  percentageChange?: number;
  context?: DetectedInsight['context'];
  comparison: DetectedInsight['comparison'];
  baselineType?: 'heuristic' | 'historical';
  baselineWindowDays?: number;
}

export interface TrendInsightInput {
  flag: InsightFlag;
  severity: InsightSeverity;
  projectId: string;
  reason: string;
  value: number;
  confidence: number;
  confidenceMetadata?: ConfidenceMetadata;
  componentId?: string;
  elementId?: string;
  context?: DetectedInsight['context'];
  comparison: DetectedInsight['comparison'];
  baselineType?: 'heuristic' | 'historical';
  baselineWindowDays?: number;
}

export class InsightBuilder {
  static statistical(input: StatisticalInsightInput): DetectedInsight {
    if (!Number.isFinite(input.zScore)) {
      throw new Error('Statistical insight requires valid zScore');
    }
    if (
      !Number.isFinite(input.pValue) ||
      input.pValue < 0 ||
      input.pValue > 1
    ) {
      throw new Error('Statistical insight requires valid pValue (0-1)');
    }
    if (!Number.isFinite(input.baseline) || input.baseline < 0) {
      throw new Error('Statistical insight requires valid baseline');
    }

    if (input.baselineType === 'heuristic') {
      return null as never;
    }

    return {
      flag: input.flag,
      severity: input.severity,
      projectId: input.projectId,
      reason: input.reason,
      value: input.value,
      baseline: input.baseline,
      percentageChange: input.percentageChange,
      confidence: input.confidence,
      confidenceMetadata: input.confidenceMetadata,
      zScore: input.zScore,
      pValue: input.pValue,
      componentId: input.componentId,
      elementId: input.elementId,
      context: input.context,
      comparison: input.comparison,
      baselineType: input.baselineType,
      baselineWindowDays: input.baselineWindowDays,
      detectedAt: new Date(),
    };
  }

  static threshold(input: ThresholdInsightInput): DetectedInsight {
    if (!input.comparison) {
      throw new Error('Threshold insight requires comparison metadata');
    }
    if (
      !Number.isFinite(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1
    ) {
      throw new Error('Threshold insight requires valid confidence (0-1)');
    }

    if (input.baselineType === 'heuristic' && input.confidence > 0.7) {
      throw new Error(
        'Heuristic baseline cannot produce confidence above 0.7',
      );
    }

    return {
      flag: input.flag,
      severity: input.severity,
      projectId: input.projectId,
      reason: input.reason,
      value: input.value,
      confidence: input.confidence,
      confidenceMetadata: input.confidenceMetadata,
      componentId: input.componentId,
      elementId: input.elementId,
      baseline: input.baseline,
      percentageChange: input.percentageChange,
      context: input.context,
      comparison: input.comparison,
      baselineType: input.baselineType,
      baselineWindowDays: input.baselineWindowDays,
      detectedAt: new Date(),
    };
  }

  static trend(input: TrendInsightInput): DetectedInsight {
    if (!input.comparison || input.comparison.lens !== 'trend') {
      throw new Error('Trend insight requires trend lens in comparison');
    }
    if (
      !Number.isFinite(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1
    ) {
      throw new Error('Trend insight requires valid confidence (0-1)');
    }

    return {
      flag: input.flag,
      severity: input.severity,
      projectId: input.projectId,
      reason: input.reason,
      value: input.value,
      confidence: input.confidence,
      confidenceMetadata: input.confidenceMetadata,
      componentId: input.componentId,
      elementId: input.elementId,
      context: input.context,
      comparison: input.comparison,
      baselineType: input.baselineType,
      baselineWindowDays: input.baselineWindowDays,
      detectedAt: new Date(),
    };
  }
}