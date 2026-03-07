// Replace imports and aggregateDate method in daily-page-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  hourlyPageMetrics,
  NewDailyPageMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  getNextDayStart,
  toUtcDayEnd,
  toUtcDayStart,
} from 'src/shared/utils/date.utils';

@Injectable()
export class DailyPageAggregatorService {
  private readonly logger = new Logger(DailyPageAggregatorService.name);

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

      const hourlyRows = await this.db
        .select()
        .from(hourlyPageMetrics)
        .where(
          and(
            eq(hourlyPageMetrics.projectId, projectId),
            gte(hourlyPageMetrics.hour, dayStart),
            lte(hourlyPageMetrics.hour, dayEnd),
          ),
        );

      if (hourlyRows.length === 0) {
        this.logger.debug(
          `No hourly page metrics for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_page_metrics',
          nextDayStart,
        );

        return;
      }

      const pathGroups = new Map<string, typeof hourlyRows>();
      for (const row of hourlyRows) {
        if (!pathGroups.has(row.path)) {
          pathGroups.set(row.path, []);
        }
        pathGroups.get(row.path)!.push(row);
      }

      const dailyRows: NewDailyPageMetricsRow[] = [];

      for (const [path, hourlyData] of pathGroups) {
        const pageViews = hourlyData.reduce((sum, h) => sum + h.pageViews, 0);
        const uniqueSessions = hourlyData.reduce(
          (sum, h) => sum + h.uniqueSessions,
          0,
        );
        const bounceCount = hourlyData.reduce(
          (sum, h) => sum + h.bounceCount,
          0,
        );

        const timeOnPageSum = hourlyData.reduce(
          (sum, h) => sum + h.timeOnPageSum,
          0,
        );
        const timeOnPageCount = hourlyData.reduce(
          (sum, h) => sum + h.timeOnPageCount,
          0,
        );

        const avgTimeOnPageMs =
          timeOnPageCount > 0 ? timeOnPageSum / timeOnPageCount : null;

        const bounceRate =
          uniqueSessions > 0 ? bounceCount / uniqueSessions : 0;

        dailyRows.push({
          projectId,
          date: dayStart,
          path,
          pageViews,
          uniqueSessions,
          avgTimeOnPageMs,
          bounceRate,
        });
      }

      await this.writeRepo.upsertDailyPageMetricsBatch(dailyRows);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_page_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyPageAggregation | project=${projectId} | rows=${dailyRows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyPageAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}