// src/modules/aggregation/aggregators/hourly-page-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  NewHourlyPageMetricsRow,
  TrackingEventRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  toUtcHourStart,
  toUtcHourEnd,
  getNextHourStart,
} from 'src/shared/utils/date.utils';

interface PageExitEvent {
  path: string;
  timeOnPageMs: number;
  bounced: boolean;
}

@Injectable()
export class HourlyPageAggregatorService {
  private readonly logger = new Logger(HourlyPageAggregatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly writeRepo: AggregationWriteRepository,
    private readonly cursorRepo: AggregationCursorRepository,
  ) {}

  async aggregateHour(projectId: string, hourStart: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const utcHourStart = toUtcHourStart(hourStart);
      const utcHourEnd = toUtcHourEnd(hourStart);

      const pageViewEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'page_view'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      if (pageViewEvents.length === 0) {
        this.logger.debug(
          `No page views for ${projectId} in ${hourStart.toISOString()}`,
        );

        const nextHourStart = getNextHourStart(utcHourStart);
        await this.cursorRepo.setCursor(
          projectId,
          'hourly_page_metrics',
          nextHourStart,
        );

        return;
      }

      const pageExitEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'page_exit'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      const pageExitMap = this.buildPageExitMap(pageExitEvents);

      const pathGroups = new Map<string, typeof pageViewEvents>();
      for (const event of pageViewEvents) {
        const path = event.path || '/';
        if (!pathGroups.has(path)) {
          pathGroups.set(path, []);
        }
        pathGroups.get(path)!.push(event);
      }

      const rows: NewHourlyPageMetricsRow[] = [];

      for (const [path, events] of pathGroups) {
        const pageViews = events.length;
        const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
        const uniqueVisitors = new Set(events.map((e) => e.visitorId)).size;

        const exitEventsForPath = pageExitMap.get(path) || [];
        const timeOnPageValues = exitEventsForPath.map((e) => e.timeOnPageMs);
        const bounceCountForPath = exitEventsForPath.filter(
          (e) => e.bounced,
        ).length;

        const timeOnPageSum = timeOnPageValues.reduce((sum, v) => sum + v, 0);
        const timeOnPageCount = timeOnPageValues.length;
        const avgTimeOnPageMs =
          timeOnPageCount > 0 ? timeOnPageSum / timeOnPageCount : null;

        rows.push({
          projectId,
          hour: utcHourStart,
          path,
          pageViews,
          uniqueSessions,
          uniqueVisitors,
          avgTimeOnPageMs,
          timeOnPageSum,
          timeOnPageCount,
          bounceCount: bounceCountForPath,
        });
      }

      await this.writeRepo.upsertHourlyPageMetricsBatch(rows);

      const nextHourStart = getNextHourStart(utcHourStart);
      await this.cursorRepo.setCursor(
        projectId,
        'hourly_page_metrics',
        nextHourStart,
      );

      this.logger.log(
        `✅ HourlyPageAggregation | project=${projectId} | rows=${rows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ HourlyPageAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private buildPageExitMap(
    pageExitEvents: TrackingEventRow[],
  ): Map<string, PageExitEvent[]> {
    const map = new Map<string, PageExitEvent[]>();

    for (const event of pageExitEvents) {
      const path = event.path || '/';
      const metadata = event.metadata as Record<string, unknown> | null;
      const timeOnPageMs = this.extractNumber(metadata?.timeOnPageMs, 0);
      const bounced = Boolean(metadata?.bounced);

      if (!map.has(path)) {
        map.set(path, []);
      }

      map.get(path)!.push({
        path,
        timeOnPageMs,
        bounced,
      });
    }

    return map;
  }

  private extractNumber(value: unknown, defaultValue: number): number {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? defaultValue : parsed;
  }
}