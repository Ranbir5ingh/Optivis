// src/modules/analytics-query/repositories/analytics-read.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, gte, lte, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  dailyComponentMetrics,
  DailyComponentMetricsRow,
  dailyElementMetrics,
  DailyElementMetricsRow,
  dailySessionMetrics,
  DailySessionMetricsRow,
  dailyPageMetrics,
  DailyPageMetricsRow,
  dailyPerformanceMetrics,
  DailyPerformanceMetricsRow,
  dailyFormMetrics,
  DailyFormMetricsRow,
  funnelMetrics,
  FunnelMetricsRow,
  DailyBehavioralMetricsRow,
  dailyBehavioralMetrics,
  DailyBehavioralElementMetricsRow,
  dailyBehavioralElementMetrics,
  DailyBehavioralPageMetricsRow,
  dailyBehavioralPageMetrics,
} from 'src/database/drizzle/schema';
import { toUtcDayStart, toUtcDayEnd } from 'src/shared/utils/date.utils';

@Injectable()
export class AnalyticsReadRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getDailyPageMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyPageMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyPageMetrics)
      .where(
        and(
          eq(dailyPageMetrics.projectId, projectId),
          gte(dailyPageMetrics.date, dayStart),
          lte(dailyPageMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyPageMetrics.date);
  }

  async getDailyComponentMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyComponentMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyComponentMetrics)
      .where(
        and(
          eq(dailyComponentMetrics.projectId, projectId),
          gte(dailyComponentMetrics.date, dayStart),
          lte(dailyComponentMetrics.date, dayEnd),
        ),
      )
      .orderBy(desc(dailyComponentMetrics.engagementScore));
  }

  async getDailyElementMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyElementMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyElementMetrics)
      .where(
        and(
          eq(dailyElementMetrics.projectId, projectId),
          gte(dailyElementMetrics.date, dayStart),
          lte(dailyElementMetrics.date, dayEnd),
        ),
      )
      .orderBy(desc(dailyElementMetrics.ctr));
  }

  async getDailySessionMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailySessionMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailySessionMetrics)
      .where(
        and(
          eq(dailySessionMetrics.projectId, projectId),
          gte(dailySessionMetrics.date, dayStart),
          lte(dailySessionMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailySessionMetrics.date);
  }

  async getDailyPerformanceMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyPerformanceMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyPerformanceMetrics)
      .where(
        and(
          eq(dailyPerformanceMetrics.projectId, projectId),
          gte(dailyPerformanceMetrics.date, dayStart),
          lte(dailyPerformanceMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyPerformanceMetrics.date);
  }

  async getDailyFormMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyFormMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyFormMetrics)
      .where(
        and(
          eq(dailyFormMetrics.projectId, projectId),
          gte(dailyFormMetrics.date, dayStart),
          lte(dailyFormMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyFormMetrics.date);
  }

  async getDailyFunnelMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FunnelMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(funnelMetrics)
      .where(
        and(
          eq(funnelMetrics.projectId, projectId),
          gte(funnelMetrics.date, dayStart),
          lte(funnelMetrics.date, dayEnd),
        ),
      )
      .orderBy(funnelMetrics.funnelName, funnelMetrics.stepIndex);
  }

  async getDailyBehavioralMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBehavioralMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyBehavioralMetrics)
      .where(
        and(
          eq(dailyBehavioralMetrics.projectId, projectId),
          gte(dailyBehavioralMetrics.date, dayStart),
          lte(dailyBehavioralMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyBehavioralMetrics.date);
  }

  async getDailyBehavioralElementMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBehavioralElementMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyBehavioralElementMetrics)
      .where(
        and(
          eq(dailyBehavioralElementMetrics.projectId, projectId),
          gte(dailyBehavioralElementMetrics.date, dayStart),
          lte(dailyBehavioralElementMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyBehavioralElementMetrics.date);
  }

  async getDailyBehavioralPageMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBehavioralPageMetricsRow[]> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    return this.db
      .select()
      .from(dailyBehavioralPageMetrics)
      .where(
        and(
          eq(dailyBehavioralPageMetrics.projectId, projectId),
          gte(dailyBehavioralPageMetrics.date, dayStart),
          lte(dailyBehavioralPageMetrics.date, dayEnd),
        ),
      )
      .orderBy(dailyBehavioralPageMetrics.date);
  }

  async getTotalSessionsForProject(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    const rows = await this.db
      .select()
      .from(dailySessionMetrics)
      .where(
        and(
          eq(dailySessionMetrics.projectId, projectId),
          gte(dailySessionMetrics.date, dayStart),
          lte(dailySessionMetrics.date, dayEnd),
        ),
      );

    return rows.reduce((sum, row) => sum + (row.sessions || 0), 0);
  }
}