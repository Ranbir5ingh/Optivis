// src/modules/aggregation/aggregators/daily-element-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  hourlyElementMetrics,
  dailyElementMetrics,
  NewDailyElementMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';
import { TrendCalculatorService } from '../services/trend-calculator.service';

import {
  getPreviousDay,
  toUtcDayEnd,
  toUtcDayStart,
  getNextDayStart,
} from 'src/shared/utils/date.utils';

@Injectable()
export class DailyElementAggregatorService {
  private readonly logger = new Logger(DailyElementAggregatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly writeRepo: AggregationWriteRepository,
    private readonly cursorRepo: AggregationCursorRepository,
    private readonly trendCalculator: TrendCalculatorService,
  ) {}

  async aggregateDate(projectId: string, date: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const dayStart = toUtcDayStart(date);
      const dayEnd = toUtcDayEnd(date);

      const hourlyRows = await this.db
        .select()
        .from(hourlyElementMetrics)
        .where(
          and(
            eq(hourlyElementMetrics.projectId, projectId),
            gte(hourlyElementMetrics.hour, dayStart),
            lte(hourlyElementMetrics.hour, dayEnd),
          ),
        );

      if (hourlyRows.length === 0) {
        this.logger.debug(
          `No hourly element metrics for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_element_metrics',
          nextDayStart,
        );

        return;
      }

      const elementGroups = new Map<string, typeof hourlyRows>();
      for (const row of hourlyRows) {
        if (!elementGroups.has(row.elementId)) {
          elementGroups.set(row.elementId, []);
        }
        elementGroups.get(row.elementId)!.push(row);
      }

      const elementRows: NewDailyElementMetricsRow[] = [];

      for (const [elementId, hourlyData] of elementGroups) {
        const totalClicks = hourlyData.reduce((sum, h) => sum + h.clicks, 0);
        const impressions = hourlyData.reduce(
          (sum, h) => sum + h.impressions,
          0,
        );
        const ctr = impressions > 0 ? totalClicks / impressions : 0;

        const xCoords = hourlyData
          .map((h) => h.avgClickX)
          .filter((v): v is number => v !== null);

        const avgClickX =
          xCoords.length > 0
            ? xCoords.reduce((sum, v) => sum + v, 0) / xCoords.length
            : null;

        const yCoords = hourlyData
          .map((h) => h.avgClickY)
          .filter((v): v is number => v !== null);

        const avgClickY =
          yCoords.length > 0
            ? yCoords.reduce((sum, v) => sum + v, 0) / yCoords.length
            : null;

        const componentId =
          hourlyData.find((h) => h.componentId)?.componentId || null;

        elementRows.push({
          projectId,
          date: dayStart,
          elementId,
          componentId,
          totalClicks,
          impressions,
          ctr,
          avgClickX,
          avgClickY,
          prevDayClicks: null,
          trendPercent: null,
        });
      }

      const previousDayStart = getPreviousDay(dayStart);

      const previousRows = await this.db
        .select()
        .from(dailyElementMetrics)
        .where(
          and(
            eq(dailyElementMetrics.projectId, projectId),
            gte(dailyElementMetrics.date, previousDayStart),
            lte(dailyElementMetrics.date, previousDayStart),
          ),
        );

      const previousMap = new Map<string, (typeof previousRows)[0]>();
      for (const row of previousRows) {
        previousMap.set(row.elementId, row);
      }

      for (const row of elementRows) {
        const previous = previousMap.get(row.elementId);

        if (previous) {
          const currentClicks = row.totalClicks || 0;
          const previousClicks = previous.totalClicks || 0;

          row.trendPercent = this.trendCalculator.calculateTrendPercent(
            currentClicks,
            previousClicks,
          );
          row.prevDayClicks = previousClicks;
        }
      }

      await this.writeRepo.upsertDailyElementMetricsBatch(elementRows);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_element_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyElementAggregation | project=${projectId} | rows=${elementRows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyElementAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}