// Replace imports and aggregateDate method in daily-performance-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  dailyPerformanceMetrics,
  NewDailyPerformanceMetricsRow,
  TrackingEventRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  getNextDayStart,
  toUtcDayEnd,
  toUtcDayStart,
} from 'src/shared/utils/date.utils';
import { calculatePercentile } from 'src/shared/utils/statistics';

interface PerformanceMetadata {
  lcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
}

@Injectable()
export class DailyPerformanceAggregatorService {
  private readonly logger = new Logger(DailyPerformanceAggregatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly writeRepo: AggregationWriteRepository,
    private readonly cursorRepo: AggregationCursorRepository,
  ) {}

  async aggregateDate(projectId: string, date: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const dayStart = toUtcDayStart(date);
      const dayEnd = toUtcDayEnd(date);

      const perfEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'performance'),
            gte(trackingEvents.occurredAt, dayStart),
            lte(trackingEvents.occurredAt, dayEnd),
          ),
        );

      if (perfEvents.length === 0) {
        this.logger.debug(
          `No performance events for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_performance_metrics',
          nextDayStart,
        );

        return;
      }

      const metrics = this.aggregatePerformanceMetrics(perfEvents);

      if (!metrics) {
        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_performance_metrics',
          nextDayStart,
        );
        return;
      }

      const row: NewDailyPerformanceMetricsRow = {
        projectId,
        date: dayStart,
        avgLcp: metrics.avgLcp,
        avgCls: metrics.avgCls,
        avgInp: metrics.avgInp,
        avgTtfb: metrics.avgTtfb,
        lcpP50: metrics.lcpP50,
        lcpP90: metrics.lcpP90,
        lcpP99: metrics.lcpP99,
        clsP50: metrics.clsP50,
        clsP90: metrics.clsP90,
        clsP99: metrics.clsP99,
        inpP50: metrics.inpP50,
        inpP90: metrics.inpP90,
        inpP99: metrics.inpP99,
        ttfbP50: metrics.ttfbP50,
        ttfbP90: metrics.ttfbP90,
        ttfbP99: metrics.ttfbP99,
        lcpSampleSize: metrics.lcpValues.length,
        clsSampleSize: metrics.clsValues.length,
        inpSampleSize: metrics.inpValues.length,
        ttfbSampleSize: metrics.ttfbValues.length,
      };

      await this.writeRepo.upsertDailyPerformanceMetricsBatch([row]);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_performance_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyPerformanceAggregation | project=${projectId} | rows=1 | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyPerformanceAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private aggregatePerformanceMetrics(
    events: TrackingEventRow[],
  ): {
    avgLcp: number | null;
    avgCls: number | null;
    avgInp: number | null;
    avgTtfb: number | null;
    lcpP50: number | null;
    lcpP90: number | null;
    lcpP99: number | null;
    clsP50: number | null;
    clsP90: number | null;
    clsP99: number | null;
    inpP50: number | null;
    inpP90: number | null;
    inpP99: number | null;
    ttfbP50: number | null;
    ttfbP90: number | null;
    ttfbP99: number | null;
    lcpValues: number[];
    clsValues: number[];
    inpValues: number[];
    ttfbValues: number[];
  } | null {
    const lcpValues: number[] = [];
    const clsValues: number[] = [];
    const inpValues: number[] = [];
    const ttfbValues: number[] = [];

    for (const event of events) {
      const metadata = event.metadata as PerformanceMetadata | null;
      if (!metadata) continue;

      if (typeof metadata.lcp === 'number' && metadata.lcp > 0) {
        lcpValues.push(metadata.lcp);
      }
      if (typeof metadata.cls === 'number' && metadata.cls >= 0) {
        clsValues.push(metadata.cls);
      }
      if (typeof metadata.inp === 'number' && metadata.inp > 0) {
        inpValues.push(metadata.inp);
      }
      if (typeof metadata.ttfb === 'number' && metadata.ttfb > 0) {
        ttfbValues.push(metadata.ttfb);
      }
    }

    if (
      lcpValues.length === 0 &&
      clsValues.length === 0 &&
      inpValues.length === 0 &&
      ttfbValues.length === 0
    ) {
      return null;
    }

    return {
      avgLcp:
        lcpValues.length > 0
          ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length
          : null,
      avgCls:
        clsValues.length > 0
          ? clsValues.reduce((a, b) => a + b, 0) / clsValues.length
          : null,
      avgInp:
        inpValues.length > 0
          ? inpValues.reduce((a, b) => a + b, 0) / inpValues.length
          : null,
      avgTtfb:
        ttfbValues.length > 0
          ? ttfbValues.reduce((a, b) => a + b, 0) / ttfbValues.length
          : null,
      lcpP50: lcpValues.length > 0 ? calculatePercentile(lcpValues, 0.5) : null,
      lcpP90: lcpValues.length > 0 ? calculatePercentile(lcpValues, 0.9) : null,
      lcpP99:
        lcpValues.length > 0 ? calculatePercentile(lcpValues, 0.99) : null,
      clsP50: clsValues.length > 0 ? calculatePercentile(clsValues, 0.5) : null,
      clsP90: clsValues.length > 0 ? calculatePercentile(clsValues, 0.9) : null,
      clsP99:
        clsValues.length > 0 ? calculatePercentile(clsValues, 0.99) : null,
      inpP50: inpValues.length > 0 ? calculatePercentile(inpValues, 0.5) : null,
      inpP90: inpValues.length > 0 ? calculatePercentile(inpValues, 0.9) : null,
      inpP99:
        inpValues.length > 0 ? calculatePercentile(inpValues, 0.99) : null,
      ttfbP50: ttfbValues.length > 0 ? calculatePercentile(ttfbValues, 0.5) : null,
      ttfbP90: ttfbValues.length > 0 ? calculatePercentile(ttfbValues, 0.9) : null,
      ttfbP99:
        ttfbValues.length > 0 ? calculatePercentile(ttfbValues, 0.99) : null,
      lcpValues,
      clsValues,
      inpValues,
      ttfbValues,
    };
  }
}
