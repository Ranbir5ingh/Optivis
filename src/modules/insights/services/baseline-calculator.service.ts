// src/modules/insights/services/baseline-calculator.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  dailyComponentMetrics,
  dailyFormMetrics,
  dailyPerformanceMetrics,
} from 'src/database/drizzle/schema';
import {
  calculateMean,
  calculateStandardDeviation,
  calculatePercentile,
  calculateZScore,
} from 'src/shared/utils/statistics';
import {
  subtractDays,
  toUtcDayStart,
  toUtcDayEnd,
} from 'src/shared/utils/date.utils';
import { BaselineEnvelope } from '../domain/baseline-envelope.model';
import { HEURISTIC_BASELINE_RULES } from '../config/heuristic-baseline-rules.config';
import { ResolvedBaseline } from '../domain/resolved-baseline.model';
import { SampleSizeValidatorService } from './sample-size-validator.service';

interface BaselineMetrics {
  mean: number;
  stdDev: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  sampleSize: number;
  dateRange: { start: Date; end: Date };
}

export type BaselineMetricType =
  | 'ctr'
  | 'engagement'
  | 'time_visible'
  | 'ttfb'
  | 'lcp'
  | 'cls'
  | 'inp'
  | 'drop_off_rate'
  | 'form_abandon_rate'
  | 'form_completion_rate'
  | 'form_error_rate';
export type BaselinePeriod = '7days' | '14days' | '30days';

@Injectable()
export class BaselineCalculatorService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly sampleSizeValidator: SampleSizeValidatorService,
  ) {}

  async resolveBaselineFor(
    projectId: string,
    componentId: string,
    metric: BaselineMetricType,
    options: {
      period: BaselinePeriod;
      excludeAnomalies: boolean;
    },
  ): Promise<ResolvedBaseline> {
    const historicalMetrics = await this.computeHistoricalStats(
      projectId,
      componentId,
      options.period,
      metric,
      options.excludeAnomalies,
    );

    const envelope = this.toEnvelope(
      historicalMetrics,
      projectId,
      this.getPeriodDays(options.period),
    );

    return this.resolveBaseline(metric, envelope, projectId);
  }

  getHeuristicBaseline(
    metric: BaselineMetricType,
    projectId: string,
  ): BaselineEnvelope {
    const heuristicValue =
      HEURISTIC_BASELINE_RULES.DEFAULT_HEURISTIC_VALUES[metric];

    if (heuristicValue === undefined) {
      throw new Error(`No heuristic baseline defined for metric: ${metric}`);
    }

    const { p25, p50, p75, p90, p99 } =
      HEURISTIC_BASELINE_RULES.HEURISTIC_PERCENTILES;

    return {
      type: 'heuristic',
      stats: {
        mean: heuristicValue,
        p25: p25(heuristicValue),
        p50: p50(heuristicValue),
        p75: p75(heuristicValue),
        p90: p90(heuristicValue),
        p99: p99(heuristicValue),
        stdDev: heuristicValue * 0.3,
        sampleSize: 0,
      },
      source: { projectId },
    };
  }

  private async computeHistoricalStats(
    projectId: string,
    componentId: string,
    period: BaselinePeriod,
    metric: BaselineMetricType,
    excludeAnomalies: boolean,
  ): Promise<BaselineMetrics> {
    const days = this.getPeriodDays(period);
    const endDate = toUtcDayEnd(new Date());
    const startDate = toUtcDayStart(subtractDays(endDate, days));

    const values = await this.fetchMetricValues(
      projectId,
      componentId,
      startDate,
      endDate,
      metric,
    );

    if (values.length === 0) {
      return this.getBootstrapMetrics(metric);
    }

    const filteredValues = excludeAnomalies
      ? this.removeAnomalies(values)
      : values;

    return {
      mean: calculateMean(filteredValues),
      stdDev: calculateStandardDeviation(filteredValues),
      p25: calculatePercentile(filteredValues, 0.25),
      p50: calculatePercentile(filteredValues, 0.5),
      p75: calculatePercentile(filteredValues, 0.75),
      p90: calculatePercentile(filteredValues, 0.9),
      p99: calculatePercentile(filteredValues, 0.99),
      sampleSize: filteredValues.length,
      dateRange: { start: startDate, end: endDate },
    };
  }

  private toEnvelope(
    stats: BaselineMetrics,
    projectId: string,
    windowDays: number,
  ): BaselineEnvelope {
    return {
      type: 'historical',
      windowDays,
      stats: {
        mean: stats.mean,
        p25: stats.p25,
        p50: stats.p50,
        p75: stats.p75,
        p90: stats.p90,
        p99: stats.p99,
        stdDev: stats.stdDev,
        sampleSize: stats.sampleSize,
      },
      source: { projectId },
    };
  }

  private resolveBaseline(
    metric: BaselineMetricType,
    historical: BaselineEnvelope,
    projectId: string,
  ): ResolvedBaseline {
    const validation = this.sampleSizeValidator.validateMetricSample(
      metric,
      historical.stats.sampleSize,
    );

    if (validation.valid) {
      return {
        baseline: historical,
        sampleValidation: validation,
      };
    }

    const heuristic = this.getHeuristicBaseline(metric, projectId);
    return {
      baseline: heuristic,
      sampleValidation: validation,
      reason: `Fallback to heuristic: ${validation.reason}`,
    };
  }

  private getPeriodDays(period: BaselinePeriod): number {
    const periodMap: Record<BaselinePeriod, number> = {
      '7days': 7,
      '14days': 14,
      '30days': 30,
    };
    return periodMap[period];
  }

  private async fetchMetricValues(
    projectId: string,
    componentId: string,
    startDate: Date,
    endDate: Date,
    metric: BaselineMetricType,
  ): Promise<number[]> {
    const values: number[] = [];

    if (
      metric === 'ttfb' ||
      metric === 'lcp' ||
      metric === 'cls' ||
      metric === 'inp'
    ) {
      const rows = await this.db
        .select()
        .from(dailyPerformanceMetrics)
        .where(
          and(
            eq(dailyPerformanceMetrics.projectId, projectId),
            gte(dailyPerformanceMetrics.date, startDate),
            lte(dailyPerformanceMetrics.date, endDate),
          ),
        );

      for (const row of rows) {
        let value: number | null = null;

        if (metric === 'ttfb' && row.avgTtfb !== null) {
          value =
            typeof row.avgTtfb === 'number'
              ? row.avgTtfb
              : parseFloat(String(row.avgTtfb));
        } else if (metric === 'lcp' && row.avgLcp !== null) {
          value =
            typeof row.avgLcp === 'number'
              ? row.avgLcp
              : parseFloat(String(row.avgLcp));
        } else if (metric === 'cls' && row.avgCls !== null) {
          value =
            typeof row.avgCls === 'number'
              ? row.avgCls
              : parseFloat(String(row.avgCls));
        } else if (metric === 'inp' && row.avgInp !== null) {
          value =
            typeof row.avgInp === 'number'
              ? row.avgInp
              : parseFloat(String(row.avgInp));
        }

        if (value !== null && !isNaN(value)) {
          values.push(value);
        }
      }
    } else if (
      metric === 'form_abandon_rate' ||
      metric === 'form_completion_rate' ||
      metric === 'form_error_rate'
    ) {
      const rows = await this.db
        .select()
        .from(dailyFormMetrics)
        .where(
          and(
            eq(dailyFormMetrics.projectId, projectId),
            eq(dailyFormMetrics.formId, componentId),
            gte(dailyFormMetrics.date, startDate),
            lte(dailyFormMetrics.date, endDate),
          ),
        );

      for (const row of rows) {
        let value: number | null = null;

        if (metric === 'form_abandon_rate' && row.abandonRate !== null) {
          value =
            typeof row.abandonRate === 'number'
              ? row.abandonRate
              : parseFloat(String(row.abandonRate));
        } else if (
          metric === 'form_completion_rate' &&
          row.completionRate !== null
        ) {
          value =
            typeof row.completionRate === 'number'
              ? row.completionRate
              : parseFloat(String(row.completionRate));
        } else if (metric === 'form_error_rate' && row.errorRate !== null) {
          value =
            typeof row.errorRate === 'number'
              ? row.errorRate
              : parseFloat(String(row.errorRate));
        }

        if (value !== null && !isNaN(value)) {
          values.push(value);
        }
      }
    } else if (
      metric === 'ctr' ||
      metric === 'engagement' ||
      metric === 'time_visible'
    ) {
      const rows = await this.db
        .select()
        .from(dailyComponentMetrics)
        .where(
          and(
            eq(dailyComponentMetrics.projectId, projectId),
            eq(dailyComponentMetrics.componentId, componentId),
            gte(dailyComponentMetrics.date, startDate),
            lte(dailyComponentMetrics.date, endDate),
          ),
        );

      for (const row of rows) {
        let value: number | null = null;

        if (metric === 'ctr' && row.ctr !== null) {
          value =
            typeof row.ctr === 'number' ? row.ctr : parseFloat(String(row.ctr));
        } else if (metric === 'engagement' && row.engagementScore !== null) {
          value =
            typeof row.engagementScore === 'number'
              ? row.engagementScore
              : parseFloat(String(row.engagementScore));
        } else if (metric === 'time_visible' && row.avgTimeVisibleMs !== null) {
          value =
            typeof row.avgTimeVisibleMs === 'number'
              ? row.avgTimeVisibleMs
              : parseFloat(String(row.avgTimeVisibleMs));
        }

        if (value !== null && !isNaN(value)) {
          values.push(value);
        }
      }
    }

    return values;
  }

  private getBootstrapMetrics(metric: BaselineMetricType): BaselineMetrics {
    const heuristicValue =
      HEURISTIC_BASELINE_RULES.DEFAULT_HEURISTIC_VALUES[metric];

    if (!heuristicValue) {
      throw new Error(`No heuristic baseline defined for metric: ${metric}`);
    }

    const { p25, p50, p75, p90, p99 } =
      HEURISTIC_BASELINE_RULES.HEURISTIC_PERCENTILES;

    const now = new Date();
    return {
      mean: heuristicValue,
      stdDev: heuristicValue * 0.3,
      p25: p25(heuristicValue),
      p50: p50(heuristicValue),
      p75: p75(heuristicValue),
      p90: p90(heuristicValue),
      p99: p99(heuristicValue),
      sampleSize: 0,
      dateRange: {
        start: subtractDays(now, 30),
        end: now,
      },
    };
  }

  private removeAnomalies(values: number[]): number[] {
    if (values.length < 3) return values;

    const mean = calculateMean(values);
    const stdDev = calculateStandardDeviation(values);

    return values.filter((v) => {
      const zScore = calculateZScore(v, mean, stdDev);
      return Math.abs(zScore) <= 3;
    });
  }
}
