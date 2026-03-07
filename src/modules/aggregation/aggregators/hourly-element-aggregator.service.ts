// src/modules/aggregation/aggregators/hourly-element-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  NewHourlyElementMetricsRow,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

import {
  toUtcHourStart,
  toUtcHourEnd,
  getNextHourStart,
} from 'src/shared/utils/date.utils';

@Injectable()
export class HourlyElementAggregatorService {
  private readonly logger = new Logger(HourlyElementAggregatorService.name);

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

      if (clickEvents.length === 0) {
        this.logger.debug(
          `No clicks for ${projectId} in ${hourStart.toISOString()}`,
        );

        const nextHourStart = getNextHourStart(utcHourStart);
        await this.cursorRepo.setCursor(
          projectId,
          'hourly_element_metrics',
          nextHourStart,
        );

        return;
      }

      const elementGroups = new Map<string, typeof clickEvents>();
      for (const event of clickEvents) {
        const elementId = event.elementId || 'unknown';
        if (!elementGroups.has(elementId)) {
          elementGroups.set(elementId, []);
        }
        elementGroups.get(elementId)!.push(event);
      }

      const rows: NewHourlyElementMetricsRow[] = [];

      for (const [elementId, events] of elementGroups) {
        const clicks = events.length;
        const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
        const impressions = uniqueSessions;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        const xCoords = events
          .map((e) => {
            const metadata = e.metadata as Record<string, unknown> | null;
            const val = metadata?.x;
            return typeof val === 'number' ? val : null;
          })
          .filter((v): v is number => v !== null);

        const yCoords = events
          .map((e) => {
            const metadata = e.metadata as Record<string, unknown> | null;
            const val = metadata?.y;
            return typeof val === 'number' ? val : null;
          })
          .filter((v): v is number => v !== null);

        const avgClickX =
          xCoords.length > 0
            ? xCoords.reduce((sum, v) => sum + v, 0) / xCoords.length
            : null;

        const avgClickY =
          yCoords.length > 0
            ? yCoords.reduce((sum, v) => sum + v, 0) / yCoords.length
            : null;

        const componentId = events[0]?.componentId || null;

        rows.push({
          projectId,
          hour: utcHourStart,
          elementId,
          componentId,
          impressions,
          clicks,
          ctr,
          avgClickX,
          avgClickY,
        });
      }

      await this.writeRepo.upsertHourlyElementMetricsBatch(rows);

      const nextHourStart = getNextHourStart(utcHourStart);
      await this.cursorRepo.setCursor(
        projectId,
        'hourly_element_metrics',
        nextHourStart,
      );

      this.logger.log(
        `✅ HourlyElementAggregation | project=${projectId} | rows=${rows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ HourlyElementAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}