// src/modules/insights/detectors/pattern.detector.ts

import { Injectable } from '@nestjs/common';
import { findChangePoints } from 'src/shared/utils/statistics';

export interface PatternDetectionResult {
  hasDownwardTrend: boolean;
  hasUpwardTrend: boolean;
  trendStrength: number;
  hasWeeklyPattern: boolean;
  seasonalityType: 'daily' | 'weekly' | 'monthly' | 'none';
  changePoints: Date[];
  projectedMetric: number;
  confidence: number;
}

@Injectable()
export class PatternDetector {
  async detectPatterns(
    projectId: string,
    startDate: Date,
    endDate: Date,
    metricValues: Array<{ date: Date; value: number }>,
  ): Promise<PatternDetectionResult> {
    if (metricValues.length < 7) {
      return this.getDefaultPattern();
    }

    const values = metricValues.map((m) => m.value);
    const dates = metricValues.map((m) => m.date);

    const trend = this.calculateTrend(values);
    const seasonality = this.detectSeasonality(values);
    const changePointIndices = findChangePoints(values);
    const changePointDates = changePointIndices.map((idx) => dates[idx]);
    const projection = this.projectNextValue(values, trend.slope);

    return {
      hasDownwardTrend: trend.slope < -0.1 && trend.strength > 0.5,
      hasUpwardTrend: trend.slope > 0.1 && trend.strength > 0.5,
      trendStrength: trend.strength,
      hasWeeklyPattern: seasonality === 'weekly',
      seasonalityType: seasonality,
      changePoints: changePointDates,
      projectedMetric: projection,
      confidence: trend.strength,
    };
  }

  private calculateTrend(values: number[]): {
    slope: number;
    strength: number;
  } {
    const n = values.length;
    if (n < 2) return { slope: 0, strength: 0 };

    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = values[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    let ssTotal = 0;
    let ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const predicted = yMean + slope * (i - xMean);
      ssTotal += Math.pow(values[i] - yMean, 2);
      ssResidual += Math.pow(values[i] - predicted, 2);
    }

    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
    const strength = Math.max(0, Math.min(1, rSquared));

    return { slope, strength };
  }

  private detectSeasonality(
    values: number[],
  ): 'daily' | 'weekly' | 'monthly' | 'none' {
    if (values.length < 14) return 'none';

    const weeklyAutocorr = this.calculateAutocorrelation(values, 7);
    const dailyAutocorr = this.calculateAutocorrelation(values, 1);

    if (weeklyAutocorr > 0.6) return 'weekly';
    if (dailyAutocorr > 0.6) return 'daily';

    if (values.length >= 30) {
      const monthlyAutocorr = this.calculateAutocorrelation(values, 30);
      if (monthlyAutocorr > 0.6) return 'monthly';
    }

    return 'none';
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

    const n = values.length - lag;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private projectNextValue(values: number[], slope: number): number {
    if (values.length === 0) return 0;

    const lastValue = values[values.length - 1];
    return lastValue + slope;
  }

  private getDefaultPattern(): PatternDetectionResult {
    return {
      hasDownwardTrend: false,
      hasUpwardTrend: false,
      trendStrength: 0,
      hasWeeklyPattern: false,
      seasonalityType: 'none',
      changePoints: [],
      projectedMetric: 0,
      confidence: 0,
    };
  }
}