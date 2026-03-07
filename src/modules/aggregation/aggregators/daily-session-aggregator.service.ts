// Replace imports and aggregateDate method in daily-session-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  hourlySessionMetrics,
  NewDailySessionMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  getNextDayStart,
  toUtcDayEnd,
  toUtcDayStart,
} from 'src/shared/utils/date.utils';

@Injectable()
export class DailySessionAggregatorService {
  private readonly logger = new Logger(DailySessionAggregatorService.name);

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
        .from(hourlySessionMetrics)
        .where(
          and(
            eq(hourlySessionMetrics.projectId, projectId),
            gte(hourlySessionMetrics.hour, dayStart),
            lte(hourlySessionMetrics.hour, dayEnd),
          ),
        );

      if (hourlyRows.length === 0) {
        this.logger.debug(
          `No hourly session metrics for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_session_metrics',
          nextDayStart,
        );

        return;
      }

      const sessions = hourlyRows.reduce((sum, h) => sum + h.sessions, 0);
      const newUsers = hourlyRows.reduce((sum, h) => sum + h.newUsers, 0);
      const returningUsers = hourlyRows.reduce(
        (sum, h) => sum + h.returningUsers,
        0,
      );
      const powerUsers = hourlyRows.reduce((sum, h) => sum + h.powerUsers, 0);

      const sessionDurationSum = hourlyRows.reduce(
        (sum, h) => sum + h.sessionDurationSum,
        0,
      );
      const sessionDurationCount = hourlyRows.reduce(
        (sum, h) => sum + h.sessionDurationCount,
        0,
      );

      const avgSessionDurationMs =
        sessionDurationCount > 0
          ? sessionDurationSum / sessionDurationCount
          : null;

      const bouncedSessions = hourlyRows.reduce(
        (sum, h) => sum + h.bouncedSessions,
        0,
      );
      const bounceRate = sessions > 0 ? bouncedSessions / sessions : 0;

      const row: NewDailySessionMetricsRow = {
        projectId,
        date: dayStart,
        sessions,
        avgSessionDurationMs,
        bounceRate,
        newUsers,
        returningUsers,
        powerUsers,
      };

      await this.writeRepo.upsertDailySessionMetricsBatch([row]);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_session_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailySessionAggregation | project=${projectId} | rows=1 | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailySessionAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}