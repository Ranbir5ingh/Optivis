// src/modules/aggregation/aggregators/hourly-component-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  NewHourlyComponentMetricsRow,
  TrackingEventRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  toUtcHourStart,
  toUtcHourEnd,
  getNextHourStart,
} from 'src/shared/utils/date.utils';
import { calculatePercentile } from 'src/shared/utils/statistics';

interface ComponentSessionData {
  scrollDepths: number[];
  visibleTimes: number[];
  visitorIds: Set<string>;
}

@Injectable()
export class HourlyComponentAggregatorService {
  private readonly logger = new Logger(HourlyComponentAggregatorService.name);

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

      const visibilityEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'visibility'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      const clickEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'click'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      const rageClickEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'rage_click'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      const scrollDepthEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            eq(trackingEvents.type, 'scroll_depth'),
            gte(trackingEvents.occurredAt, utcHourStart),
            lte(trackingEvents.occurredAt, utcHourEnd),
          ),
        );

      const componentIds = new Set<string>();
      visibilityEvents.forEach((e) => {
        if (e.componentId) componentIds.add(e.componentId);
      });
      clickEvents.forEach((e) => {
        if (e.componentId) componentIds.add(e.componentId);
      });
      rageClickEvents.forEach((e) => {
        if (e.componentId) componentIds.add(e.componentId);
      });

      if (componentIds.size === 0) {
        this.logger.debug(
          `No components for ${projectId} in ${hourStart.toISOString()}`,
        );

        const nextHourStart = getNextHourStart(utcHourStart);
        await this.cursorRepo.setCursor(
          projectId,
          'hourly_component_metrics',
          nextHourStart,
        );

        return;
      }

      const componentSessionData = this.groupEventsByComponent(
        visibilityEvents,
        scrollDepthEvents,
      );

      const rows: NewHourlyComponentMetricsRow[] = [];

      for (const componentId of componentIds) {
        const impressions = visibilityEvents.filter(
          (e) => e.componentId === componentId,
        ).length;
        const clicks = clickEvents.filter(
          (e) => e.componentId === componentId,
        ).length;
        const rageClicks = rageClickEvents.filter(
          (e) => e.componentId === componentId,
        ).length;

        const visibleTimes = visibilityEvents
          .filter((e) => e.componentId === componentId)
          .map((e) => {
            const metadata = e.metadata as Record<string, unknown> | null;
            const val = metadata?.visibleTimeMs;
            return typeof val === 'number' ? val : null;
          })
          .filter((v): v is number => v !== null);

        const visibleTimeSum = visibleTimes.reduce((sum, v) => sum + v, 0);
        const visibleTimeCount = visibleTimes.length;
        const avgVisibleTimeMs =
          visibleTimeCount > 0 ? visibleTimeSum / visibleTimeCount : null;

        const data = componentSessionData.get(componentId) || {
          scrollDepths: [],
          visibleTimes: [],
          visitorIds: new Set<string>(),
        };

        const scrollDepthP50 = calculatePercentile(data.scrollDepths, 0.5);
        const scrollDepthP90 = calculatePercentile(data.scrollDepths, 0.9);
        const scrollDepthP99 = calculatePercentile(data.scrollDepths, 0.99);

        const visibleTimeP50 = calculatePercentile(data.visibleTimes, 0.5);
        const visibleTimeP90 = calculatePercentile(data.visibleTimes, 0.9);

        rows.push({
          projectId,
          hour: utcHourStart,
          componentId,
          impressions,
          clicks,
          rageClicks,
          uniqueVisitors: data.visitorIds.size,
          avgVisibleTimeMs,
          visibleTimeSum,
          visibleTimeCount,
          scrollDepthP50,
          scrollDepthP90,
          scrollDepthP99,
          scrollDepthSampleSize: data.scrollDepths.length,
          visibleTimeP50,
          visibleTimeP90,
          visibleTimeSampleSize: data.visibleTimes.length,
        });
      }

      await this.writeRepo.upsertHourlyComponentMetricsBatch(rows);

      const nextHourStart = getNextHourStart(utcHourStart);
      await this.cursorRepo.setCursor(
        projectId,
        'hourly_component_metrics',
        nextHourStart,
      );

      this.logger.log(
        `✅ HourlyComponentAggregation | project=${projectId} | rows=${rows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ HourlyComponentAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private groupEventsByComponent(
    visibilityEvents: TrackingEventRow[],
    scrollDepthEvents: TrackingEventRow[],
  ): Map<string, ComponentSessionData> {
    const data = new Map<string, ComponentSessionData>();

    const sessionMaxScrollDepths = new Map<string, Map<string, number>>();

    for (const event of scrollDepthEvents) {
      if (!event.componentId) continue;

      const metadata = event.metadata as Record<string, unknown> | null;
      const depth = metadata?.depth;
      const depthNum = typeof depth === 'number' ? depth : null;

      if (depthNum === null) continue;

      if (!sessionMaxScrollDepths.has(event.componentId)) {
        sessionMaxScrollDepths.set(event.componentId, new Map());
      }

      const componentSessionMap = sessionMaxScrollDepths.get(
        event.componentId,
      )!;
      const current = componentSessionMap.get(event.sessionId) || 0;
      componentSessionMap.set(event.sessionId, Math.max(current, depthNum));
    }

    for (const [componentId, sessionMap] of sessionMaxScrollDepths) {
      if (!data.has(componentId)) {
        data.set(componentId, {
          scrollDepths: [],
          visibleTimes: [],
          visitorIds: new Set(),
        });
      }

      const componentData = data.get(componentId)!;
      componentData.scrollDepths.push(...Array.from(sessionMap.values()));
    }

    const sessionVisibleTimes = new Map<string, Map<string, number[]>>();

    for (const event of visibilityEvents) {
      if (!event.componentId) continue;

      if (!data.has(event.componentId)) {
        data.set(event.componentId, {
          scrollDepths: [],
          visibleTimes: [],
          visitorIds: new Set(),
        });
      }

      const componentData = data.get(event.componentId)!;
      componentData.visitorIds.add(event.visitorId);

      const metadata = event.metadata as Record<string, unknown> | null;
      const visibleTime = metadata?.visibleTimeMs;

      if (typeof visibleTime === 'number') {
        if (!sessionVisibleTimes.has(event.componentId)) {
          sessionVisibleTimes.set(event.componentId, new Map());
        }

        const componentSessionMap = sessionVisibleTimes.get(event.componentId)!;

        if (!componentSessionMap.has(event.sessionId)) {
          componentSessionMap.set(event.sessionId, []);
        }

        componentSessionMap.get(event.sessionId)!.push(visibleTime);
      }
    }

    for (const [componentId, sessionMap] of sessionVisibleTimes) {
      const componentData = data.get(componentId)!;

      for (const times of sessionMap.values()) {
        const sessionAverage =
          times.reduce((sum, t) => sum + t, 0) / times.length;
        componentData.visibleTimes.push(sessionAverage);
      }
    }

    return data;
  }
}
