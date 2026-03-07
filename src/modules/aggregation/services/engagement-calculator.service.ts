// src/modules/aggregation/services/engagement-calculator.service.ts

import { Injectable } from '@nestjs/common';
import {
  ENGAGEMENT_WEIGHTS,
  ENGAGEMENT_TARGETS,
} from 'src/shared/utils/constants';

@Injectable()
export class EngagementCalculatorService {
  calculateEngagementScore(
    ctr: number,
    avgTimeMs: number,
    scrollDepth: number = 0
  ): number {
    const ctrScore = Math.min(ctr * (1 / ENGAGEMENT_TARGETS.PERFECT_CTR), 1);
    const timeScore = Math.min(
      avgTimeMs / ENGAGEMENT_TARGETS.PERFECT_TIME_MS,
      1
    );
    const scrollScore = Math.min(
      scrollDepth / ENGAGEMENT_TARGETS.PERFECT_SCROLL_DEPTH,
      1
    );

    const engagement =
      ctrScore * ENGAGEMENT_WEIGHTS.CTR +
      timeScore * ENGAGEMENT_WEIGHTS.TIME +
      scrollScore * ENGAGEMENT_WEIGHTS.SCROLL;

    return Math.max(0, Math.min(1, engagement));
  }

  calculateEngagementScoreWithBaseline(
    ctr: number,
    avgTimeMs: number,
    scrollDepth: number,
    baselineCtr: number,
    baselineTime: number,
    baselineScroll: number,
    ctrP90: number,
    timeP90: number,
    scrollP90: number
  ): number {
    const ctrPercentile = this.normalizeToPercentile(ctr, baselineCtr, ctrP90);
    const timePercentile = this.normalizeToPercentile(
      avgTimeMs,
      baselineTime,
      timeP90
    );
    const scrollPercentile = this.normalizeToPercentile(
      scrollDepth,
      baselineScroll,
      scrollP90
    );

    const engagement =
      ctrPercentile * ENGAGEMENT_WEIGHTS.CTR +
      timePercentile * ENGAGEMENT_WEIGHTS.TIME +
      scrollPercentile * ENGAGEMENT_WEIGHTS.SCROLL;

    return Math.max(0, Math.min(1, engagement));
  }

  calculateElementEngagementScore(ctr: number, avgTimeMs: number): number {
    const ctrScore = Math.min(ctr * 10, 1);
    const timeScore = Math.min(avgTimeMs / 5000, 1);

    return ctrScore * 0.5 + timeScore * 0.5;
  }

  private normalizeToPercentile(
    value: number,
    baseline: number,
    p90: number
  ): number {
    if (p90 === baseline) return value >= baseline ? 1 : 0;

    const normalized = (value - baseline) / (p90 - baseline);
    return Math.max(0, Math.min(1, normalized));
  }
}