// src/modules/insights/detectors/statistical-significance.detector.ts

import { Injectable } from '@nestjs/common';
import {
  calculateZScore,
  calculateCumulativeDistribution,
} from 'src/shared/utils/statistics';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';

export interface SignificanceResult {
  isSignificant: boolean;
  zScore: number;
  pValue: number;
  statisticalConfidence: number;
  direction: 'increase' | 'decrease' | 'stable';
}

@Injectable()
export class StatisticalSignificanceDetector {
  detectSignificance(
    current: number,
    baseline: BaselineEnvelope,
    alpha: number = 0.05,
  ): SignificanceResult {
    if (baseline.stats.stdDev === 0) {
      return {
        isSignificant: false,
        zScore: 0,
        pValue: 1,
        statisticalConfidence: 0,
        direction: 'stable',
      };
    }

    const zScore = calculateZScore(
      current,
      baseline.stats.mean,
      baseline.stats.stdDev,
    );
    const pValue = 2 * (1 - calculateCumulativeDistribution(Math.abs(zScore)));
    const isSignificant = pValue < alpha;

    let direction: 'increase' | 'decrease' | 'stable' = 'stable';
    if (isSignificant) {
      direction = zScore > 0 ? 'increase' : 'decrease';
    }

    return {
      isSignificant,
      zScore,
      pValue,
      statisticalConfidence: 1 - pValue,
      direction,
    };
  }

  calculateEffectSize(current: number, baseline: BaselineEnvelope): number {
    if (baseline.stats.stdDev === 0) return 0;
    return (current - baseline.stats.mean) / baseline.stats.stdDev;
  }

  isCriticalDeviation(zScore: number): boolean {
    return Math.abs(zScore) >= 3;
  }

  isHighDeviation(zScore: number): boolean {
    return Math.abs(zScore) >= 2.5;
  }

  isMediumDeviation(zScore: number): boolean {
    return Math.abs(zScore) >= 2;
  }
}
