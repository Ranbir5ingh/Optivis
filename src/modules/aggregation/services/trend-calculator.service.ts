// src/modules/analytics/services/trend-calculator.service.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TrendCalculatorService {
  private readonly logger = new Logger(TrendCalculatorService.name);

  /**
   * Calculate percentage change from baseline to current
   * Returns: ((current - baseline) / baseline) * 100
   */
  calculateTrendPercent(current: number, baseline: number): number {
    if (baseline === 0) {
      return current > 0 ? 100 : 0;
    }

    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Calculate CTR change
   */
  calculateCtrTrend(currentCtr: number, baselineCtr: number): number {
    return this.calculateTrendPercent(currentCtr, baselineCtr);
  }

  /**
   * Calculate engagement score change
   */
  calculateEngagementTrend(
    currentEngagement: number,
    baselineEngagement: number,
  ): number {
    return this.calculateTrendPercent(currentEngagement, baselineEngagement);
  }

  /**
   * Classify trend as improving, stable, or declining
   */
  classifyTrend(trendPercent: number): 'improving' | 'stable' | 'declining' {
    if (trendPercent > 5) return 'improving';
    if (trendPercent < -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate trend for multiple metrics at once
   */
  calculateMultipleTrends(metrics: {
    current: Record<string, number>;
    baseline: Record<string, number>;
  }): Record<string, number> {
    const trends: Record<string, number> = {};

    for (const [key, currentValue] of Object.entries(metrics.current)) {
      const baselineValue = metrics.baseline[key] ?? 0;
      trends[key] = this.calculateTrendPercent(currentValue, baselineValue);
    }

    return trends;
  }
}