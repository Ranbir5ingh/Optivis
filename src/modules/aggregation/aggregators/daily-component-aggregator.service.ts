// src/modules/aggregation/aggregators/daily-component-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  hourlyComponentMetrics,
  dailyComponentMetrics,
  NewDailyComponentMetricsRow,
  HourlyComponentMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';
import { TrendCalculatorService } from '../services/trend-calculator.service';
import { EngagementCalculatorService } from '../services/engagement-calculator.service';

import {
  getNextDayStart,
  getPreviousDay,
  toUtcDayEnd,
  toUtcDayStart,
} from 'src/shared/utils/date.utils';
import {
  calculateWeightedQuantile,
  type WeightedValue,
} from 'src/shared/utils/weighted-percentile';
import { calculatePercentile } from 'src/shared/utils/statistics';

@Injectable()
export class DailyComponentAggregatorService {
  private readonly logger = new Logger(DailyComponentAggregatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly writeRepo: AggregationWriteRepository,
    private readonly cursorRepo: AggregationCursorRepository,
    private readonly trendCalculator: TrendCalculatorService,
    private readonly engagementCalc: EngagementCalculatorService,
  ) {}

  async aggregateDate(projectId: string, date: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const dayStart = toUtcDayStart(date);
      const dayEnd = toUtcDayEnd(date);

      const hourlyRows = await this.db
        .select()
        .from(hourlyComponentMetrics)
        .where(
          and(
            eq(hourlyComponentMetrics.projectId, projectId),
            gte(hourlyComponentMetrics.hour, dayStart),
            lte(hourlyComponentMetrics.hour, dayEnd),
          ),
        );

      if (hourlyRows.length === 0) {
        this.logger.debug(
          `No hourly component metrics for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_component_metrics',
          nextDayStart,
        );

        return;
      }

      const componentGroups = new Map<string, typeof hourlyRows>();
      for (const row of hourlyRows) {
        if (!componentGroups.has(row.componentId)) {
          componentGroups.set(row.componentId, []);
        }
        componentGroups.get(row.componentId)!.push(row);
      }

      const componentRows: NewDailyComponentMetricsRow[] = [];

      for (const [componentId, hourlyData] of componentGroups) {
        const metrics = await this.calculateDailyMetrics(
          projectId,
          componentId,
          hourlyData,
          dayStart,
        );
        componentRows.push(metrics);
      }

      const previousDayStart = getPreviousDay(dayStart);

      const previousRows = await this.db
        .select()
        .from(dailyComponentMetrics)
        .where(
          and(
            eq(dailyComponentMetrics.projectId, projectId),
            gte(dailyComponentMetrics.date, previousDayStart),
            lte(dailyComponentMetrics.date, previousDayStart),
          ),
        );

      const previousMap = new Map<string, (typeof previousRows)[0]>();
      for (const row of previousRows) {
        previousMap.set(row.componentId, row);
      }

      for (const row of componentRows) {
        const previous = previousMap.get(row.componentId);

        if (previous) {
          const currentEngagement =
            typeof row.engagementScore === 'number' ? row.engagementScore : 0;
          const previousEngagement =
            typeof previous.engagementScore === 'number'
              ? previous.engagementScore
              : 0;

          row.trendPercent = this.trendCalculator.calculateTrendPercent(
            currentEngagement,
            previousEngagement,
          );
          row.prevDayEngagement = previousEngagement;
        }
      }

      await this.writeRepo.upsertDailyComponentMetricsBatch(componentRows);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_component_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyComponentAggregation | project=${projectId} | rows=${componentRows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyComponentAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async calculateDailyMetrics(
    projectId: string,
    componentId: string,
    hourlyData: HourlyComponentMetricsRow[],
    dayStart: Date,
  ): Promise<NewDailyComponentMetricsRow> {
    const impressions = hourlyData.reduce((sum, h) => sum + h.impressions, 0);
    const totalClicks = hourlyData.reduce((sum, h) => sum + h.clicks, 0);
    const uniqueVisitors = hourlyData.reduce(
      (sum, h) => sum + h.uniqueVisitors,
      0,
    );

    const visibleTimeSum = hourlyData.reduce(
      (sum, h) => sum + h.visibleTimeSum,
      0,
    );
    const visibleTimeCount = hourlyData.reduce(
      (sum, h) => sum + h.visibleTimeCount,
      0,
    );
    const avgTimeVisibleMs =
      visibleTimeCount > 0 ? visibleTimeSum / visibleTimeCount : 0;

    const scrollDepthP50 = this.calculateWeightedPercentileFromHourly(
      hourlyData,
      'scrollDepthP50',
      'scrollDepthSampleSize',
      0.5,
    );

    const scrollDepthP90 = this.calculateWeightedPercentileFromHourly(
      hourlyData,
      'scrollDepthP90',
      'scrollDepthSampleSize',
      0.9,
    );

    const scrollDepthP99 = this.calculateWeightedPercentileFromHourly(
      hourlyData,
      'scrollDepthP99',
      'scrollDepthSampleSize',
      0.99,
    );

    const avgScrollDepthWhenVisible = scrollDepthP50;

    const visibleTimeP50 = this.calculateWeightedPercentileFromHourly(
      hourlyData,
      'visibleTimeP50',
      'visibleTimeSampleSize',
      0.5,
    );

    const visibleTimeP90 = this.calculateWeightedPercentileFromHourly(
      hourlyData,
      'visibleTimeP90',
      'visibleTimeSampleSize',
      0.9,
    );

    const ctr = impressions > 0 ? totalClicks / impressions : 0;

    const engagementScore = this.engagementCalc.calculateEngagementScore(
      ctr,
      avgTimeVisibleMs,
      avgScrollDepthWhenVisible,
    );

    const ctrValues = hourlyData
      .map((h) => {
        const hourCtr = h.impressions > 0 ? h.clicks / h.impressions : 0;
        return hourCtr;
      })
      .filter((v) => v > 0);

    const ctrP25 = calculatePercentile(ctrValues, 0.25);
    const ctrP50 = calculatePercentile(ctrValues, 0.5);
    const ctrP75 = calculatePercentile(ctrValues, 0.75);
    const ctrP90 = calculatePercentile(ctrValues, 0.9);
    const ctrP99 = calculatePercentile(ctrValues, 0.99);

    const engagementValues = hourlyData
      .map((h) => {
        const hourCtr = h.impressions > 0 ? h.clicks / h.impressions : 0;
        const hourVisibleTime =
          h.visibleTimeCount > 0 ? h.visibleTimeSum / h.visibleTimeCount : 0;
        const hourScrollDepth = h.scrollDepthP50 || 0;
        return this.engagementCalc.calculateEngagementScore(
          hourCtr,
          hourVisibleTime,
          hourScrollDepth,
        );
      })
      .filter((v) => v > 0);

    const engagementP25 = calculatePercentile(engagementValues, 0.25);
    const engagementP50 = calculatePercentile(engagementValues, 0.5);
    const engagementP75 = calculatePercentile(engagementValues, 0.75);
    const engagementP90 = calculatePercentile(engagementValues, 0.9);
    const engagementP99 = calculatePercentile(engagementValues, 0.99);

    const timeVisibleValues = hourlyData
      .map((h) => h.avgVisibleTimeMs)
      .filter((v): v is number => v !== null && v > 0);

    const timeVisibleP25 = calculatePercentile(timeVisibleValues, 0.25);
    const timeVisibleP50 = calculatePercentile(timeVisibleValues, 0.5);
    const timeVisibleP75 = calculatePercentile(timeVisibleValues, 0.75);
    const timeVisibleP90 = calculatePercentile(timeVisibleValues, 0.9);
    const timeVisibleP99 = calculatePercentile(timeVisibleValues, 0.99);

    return {
      projectId,
      date: dayStart,
      componentId,
      impressions,
      uniqueUsers: uniqueVisitors,
      totalClicks,
      avgTimeVisibleMs,
      avgScrollDepthWhenVisible,
      ctr,
      engagementScore,
      avgLcpImpact: null,
      prevDayEngagement: null,
      trendPercent: null,
      scrollDepthP50,
      scrollDepthP90,
      scrollDepthP99,
      avgTimeVisibleP50: visibleTimeP50,
      avgTimeVisibleP90: visibleTimeP90,
      ctrP25,
      ctrP50,
      ctrP75,
      ctrP90,
      ctrP99,
      engagementP25,
      engagementP50,
      engagementP75,
      engagementP90,
      engagementP99,
      timeVisibleP25,
      timeVisibleP50,
      timeVisibleP75,
      timeVisibleP90,
      timeVisibleP99,
    };
  }

  private calculateWeightedPercentileFromHourly(
    hourlyData: HourlyComponentMetricsRow[],
    percentileField:
      | 'scrollDepthP50'
      | 'scrollDepthP90'
      | 'scrollDepthP99'
      | 'visibleTimeP50'
      | 'visibleTimeP90',
    sampleField: 'scrollDepthSampleSize' | 'visibleTimeSampleSize',
    percentile: number,
  ): number {
    const items: WeightedValue[] = hourlyData
      .map((h) => ({
        value: (h[percentileField] ?? 0) as number,
        weight: (h[sampleField] ?? 0) as number,
      }))
      .filter((item) => item.weight > 0 && !isNaN(item.value));

    if (items.length === 0) return 0;

    return calculateWeightedQuantile(items, percentile);
  }
}
