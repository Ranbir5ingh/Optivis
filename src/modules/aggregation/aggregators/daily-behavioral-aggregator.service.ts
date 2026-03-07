// src/modules/aggregation/aggregators/daily-behavioral-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  NewDailyBehavioralMetricsRow,
  NewDailyBehavioralElementMetricsRow,
  NewDailyBehavioralPageMetricsRow,
  TrackingEventRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';
import {
  getNextDayStart,
  toUtcDayEnd,
  toUtcDayStart,
} from 'src/shared/utils/date.utils';

interface RageClickSessionData {
  sessionId: string;
  elementId: string;
  componentId: string | null;
  clickCount: number;
}

interface ExitIntentData {
  sessionId: string;
  path: string;
  timeOnPageMs: number;
  scrollDepth: number;
}

interface ProjectRollupData {
  affectedRageClickElements: number;
  totalRageClickSessions: number;
  totalRageClickCount: number;
  affectedExitIntentPages: number;
  totalExitIntentCount: number;
  totalExitIntentSessions: number;
  avgPageEarlyExitRate: number;
}

const MIN_ELEMENT_RAGE_CLICKS = 5;
const MIN_PAGE_EXIT_INTENTS = 10;

@Injectable()
export class DailyBehavioralAggregatorService {
  private readonly logger = new Logger(DailyBehavioralAggregatorService.name);

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

      const rageClickEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'rage_click'),
            gte(trackingEvents.occurredAt, dayStart),
            lte(trackingEvents.occurredAt, dayEnd),
          ),
        );

      const exitIntentEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'exit_intent'),
            gte(trackingEvents.occurredAt, dayStart),
            lte(trackingEvents.occurredAt, dayEnd),
          ),
        );

      if (rageClickEvents.length === 0 && exitIntentEvents.length === 0) {
        this.logger.debug(
          `No behavioral events for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_behavioral_metrics',
          nextDayStart,
        );

        return;
      }

      const elementMetrics = this.aggregateRageClicksByElement(
        rageClickEvents,
        projectId,
        dayStart,
      );

      const pageMetrics = this.aggregateExitIntentByPage(
        exitIntentEvents,
        projectId,
        dayStart,
      );

      const rollupData = this.computeProjectRollupData(
        rageClickEvents,
        exitIntentEvents,
        elementMetrics,
        pageMetrics,
      );

      const projectMetrics = this.buildProjectMetrics(
        projectId,
        dayStart,
        rollupData,
      );

      await this.writeRepo.upsertDailyBehavioralElementMetricsBatch(
        elementMetrics,
      );
      await this.writeRepo.upsertDailyBehavioralPageMetricsBatch(pageMetrics);
      await this.writeRepo.upsertDailyBehavioralMetricsBatch([projectMetrics]);

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_behavioral_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyBehavioralAggregation | project=${projectId} | elements=${elementMetrics.length} | pages=${pageMetrics.length} | duration=${
          Date.now() - startTime
        }ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyBehavioralAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private aggregateRageClicksByElement(
    rageClickEvents: TrackingEventRow[],
    projectId: string,
    date: Date,
  ): NewDailyBehavioralElementMetricsRow[] {
    const elementData = new Map<
      string,
      {
        sessions: Set<string>;
        totalClicks: number;
        componentId: string | null;
      }
    >();

    for (const event of rageClickEvents) {
      const elementId = event.elementId || 'unknown';

      if (!elementData.has(elementId)) {
        elementData.set(elementId, {
          sessions: new Set(),
          totalClicks: 0,
          componentId: event.componentId || null,
        });
      }

      const data = elementData.get(elementId)!;
      data.sessions.add(event.sessionId);
      data.totalClicks += 1;
    }

    const elementRows: NewDailyBehavioralElementMetricsRow[] = [];

    for (const [elementId, data] of elementData) {
      elementRows.push({
        projectId,
        date,
        elementId,
        componentId: data.componentId,
        rageClickCount: data.totalClicks,
        rageClickSessions: data.sessions.size,
      });
    }

    return elementRows;
  }

  private aggregateExitIntentByPage(
    exitIntentEvents: TrackingEventRow[],
    projectId: string,
    date: Date,
  ): NewDailyBehavioralPageMetricsRow[] {
    const pageData = new Map<
      string,
      {
        exitIntents: ExitIntentData[];
      }
    >();

    for (const event of exitIntentEvents) {
      const path = event.path || '/';
      const metadata = event.metadata as Record<string, unknown> | null;

      const timeOnPageMs = this.extractNumber(metadata?.timeOnPageMs, 0);
      const scrollDepth = this.extractNumber(metadata?.scrollDepth, 0);

      if (!pageData.has(path)) {
        pageData.set(path, { exitIntents: [] });
      }

      pageData.get(path)!.exitIntents.push({
        sessionId: event.sessionId,
        path,
        timeOnPageMs,
        scrollDepth,
      });
    }

    const pageRows: NewDailyBehavioralPageMetricsRow[] = [];

    for (const [path, data] of pageData) {
      const sessions = new Set(data.exitIntents.map((e) => e.sessionId)).size;
      const totalExitIntents = data.exitIntents.length;
      const earlyExitCount = data.exitIntents.filter(
        (e) => e.timeOnPageMs < 5000,
      ).length;
      const earlyExitRate =
        totalExitIntents > 0 ? earlyExitCount / totalExitIntents : 0;

      const avgScrollDepthAtExit =
        data.exitIntents.length > 0
          ? data.exitIntents.reduce((sum, e) => sum + e.scrollDepth, 0) /
            data.exitIntents.length
          : null;

      const avgTimeOnPageAtExit =
        data.exitIntents.length > 0
          ? data.exitIntents.reduce((sum, e) => sum + e.timeOnPageMs, 0) /
            data.exitIntents.length
          : null;

      pageRows.push({
        projectId,
        date,
        path,
        exitIntentCount: totalExitIntents,
        exitIntentSessions: sessions,
        avgScrollDepthAtExit,
        avgTimeOnPageAtExit,
        earlyExitRate,
      });
    }

    return pageRows;
  }

  private computeProjectRollupData(
    rageClickEvents: TrackingEventRow[],
    exitIntentEvents: TrackingEventRow[],
    elementMetrics: NewDailyBehavioralElementMetricsRow[],
    pageMetrics: NewDailyBehavioralPageMetricsRow[],
  ): ProjectRollupData {
    const rageClickSessions = new Set(rageClickEvents.map((e) => e.sessionId))
      .size;

    const affectedElements = elementMetrics.filter(
      (m) => (m.rageClickCount ?? 0) >= MIN_ELEMENT_RAGE_CLICKS,
    ).length;

    const affectedPages = pageMetrics.filter(
      (m) =>
        (m.exitIntentCount ?? 0) >= MIN_PAGE_EXIT_INTENTS &&
        (m.earlyExitRate ?? 0) > 0.3,
    ).length;

    const exitIntentSessions = new Set(exitIntentEvents.map((e) => e.sessionId))
      .size;
    const totalExitIntents = exitIntentEvents.length;
    const weightedEarlyExitRateSum = pageMetrics.reduce((sum, m) => {
      const count = m.exitIntentCount ?? 0;
      const rate = m.earlyExitRate ?? 0;
      return sum + count * rate;
    }, 0);

    const avgPageEarlyExitRate =
      totalExitIntents > 0 ? weightedEarlyExitRateSum / totalExitIntents : 0;

    return {
      affectedRageClickElements: affectedElements,
      totalRageClickSessions: rageClickSessions,
      totalRageClickCount: rageClickEvents.length,
      affectedExitIntentPages: affectedPages,
      totalExitIntentCount: totalExitIntents,
      totalExitIntentSessions: exitIntentSessions,
      avgPageEarlyExitRate,
    };
  }

  private buildProjectMetrics(
    projectId: string,
    date: Date,
    rollupData: ProjectRollupData,
  ): NewDailyBehavioralMetricsRow {
    return {
      projectId,
      date,
      rageClickCount: rollupData.totalRageClickCount,
      rageClickSessions: rollupData.totalRageClickSessions,
      affectedRageClickElements: rollupData.affectedRageClickElements,
      exitIntentCount: rollupData.totalExitIntentCount,
      exitIntentSessions: rollupData.totalExitIntentSessions,
      avgPageEarlyExitRate: rollupData.avgPageEarlyExitRate,
      affectedExitIntentPages: rollupData.affectedExitIntentPages,
    };
  }

  private extractNumber(value: unknown, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? defaultValue : parsed;
  }
}
