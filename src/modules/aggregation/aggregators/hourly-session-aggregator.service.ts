// src/modules/aggregation/aggregators/hourly-session-aggregator.service.ts

import {
  Injectable as InjectableDecorator,
  Inject as InjectDecorator,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DB as DB_TOKEN } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase as PgDatabase } from 'drizzle-orm/node-postgres';
import {
  and as andOp,
  eq as eqOp,
  gte as gteOp,
  lte as lteOp,
} from 'drizzle-orm';
import {
  sessionMetrics,
  NewHourlySessionMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository as WriteRepo } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository as CursorRepo } from '../repositories/aggregation-cursor.repository';

import {
  toUtcHourStart as hourStart,
  toUtcHourEnd as hourEnd,
  getNextHourStart,
} from 'src/shared/utils/date.utils';

@InjectableDecorator()
export class HourlySessionAggregatorService {
  private readonly logger = new Logger(HourlySessionAggregatorService.name);

  constructor(
    @InjectDecorator(DB_TOKEN) private readonly db: PgDatabase,
    private readonly writeRepo: WriteRepo,
    private readonly cursorRepo: CursorRepo,
  ) {}

  async aggregateHour(projectId: string, hour: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const utcHourStart = hourStart(hour);
      const utcHourEnd = hourEnd(hour);

      const sessions = await this.db
        .select()
        .from(sessionMetrics)
        .where(
          andOp(
            eqOp(sessionMetrics.projectId, projectId),
            gteOp(sessionMetrics.endedAt, utcHourStart),
            lteOp(sessionMetrics.endedAt, utcHourEnd),
          ),
        );

      if (sessions.length === 0) {
        this.logger.debug(
          `No sessions for ${projectId} in ${hour.toISOString()}`,
        );

        const nextHourStart = getNextHourStart(utcHourStart);
        await this.cursorRepo.setCursor(
          projectId,
          'hourly_session_metrics',
          nextHourStart,
        );

        return;
      }

      const totalSessions = sessions.length;

      const durations = sessions
        .map((s) => s.durationMs)
        .filter((d): d is number => d !== null);

      const sessionDurationSum = durations.reduce((sum, d) => sum + d, 0);
      const sessionDurationCount = durations.length;
      const avgSessionDurationMs =
        sessionDurationCount > 0
          ? sessionDurationSum / sessionDurationCount
          : null;

      const bouncedSessions = sessions.filter((s) => s.bounced).length;
      const bounceRate =
        totalSessions > 0 ? bouncedSessions / totalSessions : 0;

      const newUsers = sessions.filter(
        (s) => s.userCohort === 'new_users',
      ).length;
      const returningUsers = sessions.filter(
        (s) => s.userCohort === 'returning_users',
      ).length;
      const powerUsers = sessions.filter(
        (s) => s.userCohort === 'power_users',
      ).length;

      const row: NewHourlySessionMetricsRow = {
        projectId,
        hour: utcHourStart,
        sessions: totalSessions,
        bouncedSessions,
        bounceRate,
        avgSessionDurationMs,
        sessionDurationSum,
        sessionDurationCount,
        newUsers,
        returningUsers,
        powerUsers,
      };

      await this.writeRepo.upsertHourlySessionMetricsBatch([row]);

      const nextHourStart = getNextHourStart(utcHourStart);
      await this.cursorRepo.setCursor(
        projectId,
        'hourly_session_metrics',
        nextHourStart,
      );

      this.logger.log(
        `✅ HourlySessionAggregation | project=${projectId} | rows=1 | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ HourlySessionAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}