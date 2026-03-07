// src/modules/insights/services/confidence-calculator.service.ts

import { Injectable } from '@nestjs/common';
import { InsightSeverity } from '../domain/insight-flag.enum';
import {
  calculateZScore,
  calculateCumulativeDistribution,
} from 'src/shared/utils/statistics';

export type ConfidenceModel = 'statistical' | 'heuristic';

interface ConfidenceResult {
  value: number;
  model: ConfidenceModel;
  pValue?: number;
  zScore?: number;
  effectSize?: number;
  sampleSizeWeight?: number;
}

@Injectable()
export class ConfidenceCalculatorService {
  calculateStatisticalConfidence(
    pValue: number,
    sampleSize?: number,
  ): ConfidenceResult {
    const clamped = Math.min(1, Math.max(0, pValue));
    const baseConfidence = 1 - clamped;

    const sampleSizeWeight = this.calculateSampleSizeWeight(sampleSize ?? 0);
    const finalConfidence = baseConfidence * sampleSizeWeight;

    return {
      value: finalConfidence,
      model: 'statistical',
      pValue: clamped,
      sampleSizeWeight,
    };
  }

  calculateThresholdConfidenceStatistical(
    severity: InsightSeverity,
    baselineType: 'historical' | 'heuristic',
    baselineMean: number,
    baselineStdDev: number,
    currentValue: number,
    sampleSize?: number,
  ): ConfidenceResult {
    if (baselineType === 'heuristic') {
      return {
        value: 0.6,
        model: 'heuristic',
      };
    }

    if (baselineStdDev <= 0) {
      return {
        value: 0.5,
        model: 'heuristic',
      };
    }

    const zScore = calculateZScore(currentValue, baselineMean, baselineStdDev);
    const pValue = 2 * (1 - calculateCumulativeDistribution(Math.abs(zScore)));
    const effectSize = this.calculateCohenD(
      currentValue,
      baselineMean,
      baselineStdDev,
    );

    const rawScore = Math.abs(effectSize) * 0.6 + (1 - pValue) * 0.4;
    let confidence = 1 / (1 + Math.exp(-rawScore));

    const sampleSizeWeight = this.calculateSampleSizeWeight(sampleSize ?? 0);
    confidence *= sampleSizeWeight;
    confidence = Math.min(0.9, confidence);

    return {
      value: confidence,
      model: 'statistical',
      pValue,
      zScore,
      effectSize,
      sampleSizeWeight,
    };
  }

  calculateHeuristicConfidence(
    severity: InsightSeverity,
    currentValue: number,
    threshold: number,
    baselineType: 'historical' | 'heuristic' = 'heuristic',
  ): ConfidenceResult {
    const safeThreshold = Math.max(threshold, 1);
    const ratio = currentValue / safeThreshold;

    const strength = 1 / (1 + Math.exp(-(ratio - 1)));

    let base = 0.55;
    if (severity === InsightSeverity.HIGH) {
      base = 0.65;
    } else if (severity === InsightSeverity.MEDIUM) {
      base = 0.6;
    }

    const baselineBoost = baselineType === 'historical' ? 0.05 : 0.0;

    const confidence = Math.min(
      0.7,
      Math.max(0.2, base + strength * 0.25 + baselineBoost),
    );

    return {
      value: confidence,
      model: 'heuristic',
    };
  }

  calculateTrendConfidence(
    rSquared: number,
    sampleSize?: number,
  ): ConfidenceResult {
    const strength = Math.min(1, Math.max(0, rSquared));

    let baseConfidence = 0.55 + strength * 0.4;

    const sampleSizeWeight = this.calculateSampleSizeWeight(sampleSize ?? 0);
    baseConfidence = baseConfidence * sampleSizeWeight;

    return {
      value: Math.min(0.95, Math.max(0.2, baseConfidence)),
      model: 'statistical',
      sampleSizeWeight,
    };
  }

  combineConfidences(confidences: ConfidenceResult[]): ConfidenceResult {
    if (confidences.length === 0) {
      return { value: 0.3, model: 'heuristic' };
    }

    if (confidences.length === 1) {
      return confidences[0];
    }

    const allStatistical = confidences.every((c) => c.model === 'statistical');

    if (allStatistical) {
      const combined = this.combineProbabilities(
        confidences.map((c) => c.value),
      );

      return {
        value: Math.min(0.95, Math.max(0.0, combined)),
        model: 'statistical',
      };
    }

    const pValues = confidences
      .filter((c) => c.pValue !== undefined)
      .map((c) => c.pValue!);

    if (pValues.length > 0) {
      const fishersMethod = this.fishersCombinedPValue(pValues);
      const combined = 1 - fishersMethod;

      return {
        value: Math.min(0.95, Math.max(0.0, combined)),
        model: 'statistical',
        pValue: fishersMethod,
      };
    }

    const avg =
      confidences.reduce((sum, c) => sum + c.value, 0) / confidences.length;

    return {
      value: Math.min(0.9, Math.max(0.2, avg)),
      model: 'heuristic',
    };
  }

  private combineProbabilities(confidences: number[]): number {
    let combined = 1;
    for (const conf of confidences) {
      combined *= 1 - conf;
    }
    return 1 - combined;
  }

  private fishersCombinedPValue(pValues: number[]): number {
    let chiSquared = 0;
    for (const p of pValues) {
      const clamped = Math.min(0.9999, Math.max(0.0001, p));
      chiSquared += Math.log(clamped);
    }
    chiSquared = -2 * chiSquared;

    const df = 2 * pValues.length;
    const q = this.chiSquaredCDF(chiSquared, df);

    return 1 - q;
  }

  private chiSquaredCDF(x: number, df: number): number {
    if (x <= 0) return 0;
    if (x > 100) return 1;

    let sum = 0;
    let term = Math.exp(-x / 2);
    sum = term;

    for (let i = 1; i < df / 2; i++) {
      term *= x / (2 * i);
      sum += term;
      if (term < 1e-10) break;
    }

    return sum;
  }

  private calculateCohenD(
    currentValue: number,
    mean: number,
    stdDev: number,
  ): number {
    if (stdDev === 0) return 0;
    return Math.abs((currentValue - mean) / stdDev);
  }

  private calculateSampleSizeWeight(sampleSize: number): number {
    if (sampleSize <= 0) return 0.5;

    const minSample = 30;
    const optimalSample = 100;

    if (sampleSize < minSample) {
      return 0.3;
    }

    if (sampleSize >= optimalSample) {
      return 1.0;
    }

    return 0.3 + ((sampleSize - minSample) / (optimalSample - minSample)) * 0.7;
  }
}
