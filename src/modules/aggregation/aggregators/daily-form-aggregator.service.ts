// Replace imports and aggregateDate method in daily-form-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  trackingEvents,
  NewDailyFormMetricsRow,
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

interface FormEventMetadata {
  timeToSubmitMs?: number;
  timeSpentMs?: number;
  fieldsInteracted?: number;
  fieldCount?: number;
}

@Injectable()
export class DailyFormAggregatorService {
  private readonly logger = new Logger(DailyFormAggregatorService.name);

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

      const formEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, projectId),
            gte(trackingEvents.occurredAt, dayStart),
            lte(trackingEvents.occurredAt, dayEnd),
          ),
        );

      const formEventTypes = formEvents.filter((e) =>
        ['form_start', 'form_submit', 'form_abandon', 'form_error'].includes(
          e.type,
        ),
      );

      if (formEventTypes.length === 0) {
        this.logger.debug(
          `No form events for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_form_metrics',
          nextDayStart,
        );

        return;
      }

      const formsById = new Map<string, typeof formEventTypes>();
      for (const event of formEventTypes) {
        const formId = event.elementId || 'unknown';
        if (!formsById.has(formId)) {
          formsById.set(formId, []);
        }
        formsById.get(formId)!.push(event);
      }

      const formRows: NewDailyFormMetricsRow[] = [];

      for (const [formId, events] of formsById) {
        const metrics = this.calculateFormMetrics(
          formId,
          events,
          projectId,
          dayStart,
        );
        formRows.push(metrics);
      }

      if (formRows.length > 0) {
        await this.writeRepo.upsertDailyFormMetricsBatch(formRows);
      }

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_form_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyFormAggregation | project=${projectId} | rows=${formRows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyFormAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private calculateFormMetrics(
  formId: string,
  events: TrackingEventRow[],
  projectId: string,
  date: Date,
): NewDailyFormMetricsRow {
  const starts = events.filter((e) => e.type === 'form_start').length;
  const submits = events.filter((e) => e.type === 'form_submit').length;
  const abandons = events.filter((e) => e.type === 'form_abandon').length;
  const errors = events.filter((e) => e.type === 'form_error').length;

  const completionRate = starts > 0 ? submits / starts : 0;
  const abandonRate = starts > 0 ? abandons / starts : 0;
  const errorRate = starts > 0 ? errors / starts : 0;

  const submitEvents = events.filter((e) => e.type === 'form_submit');
  const submitTimes = submitEvents
    .map((e) => {
      const metadata = e.metadata as FormEventMetadata | null;
      return typeof metadata?.timeToSubmitMs === 'number'
        ? metadata.timeToSubmitMs
        : null;
    })
    .filter((v): v is number => v !== null);
  const avgTimeToSubmitMs =
    submitTimes.length > 0
      ? submitTimes.reduce((a, b) => a + b, 0) / submitTimes.length
      : null;

  const abandonEvents = events.filter((e) => e.type === 'form_abandon');
  const abandonTimes = abandonEvents
    .map((e) => {
      const metadata = e.metadata as FormEventMetadata | null;
      return typeof metadata?.timeSpentMs === 'number'
        ? metadata.timeSpentMs
        : null;
    })
    .filter((v): v is number => v !== null);
  const avgTimeToAbandonMs =
    abandonTimes.length > 0
      ? abandonTimes.reduce((a, b) => a + b, 0) / abandonTimes.length
      : null;

  const fieldsInteracted: number[] = [];
  for (const event of events) {
    const metadata = event.metadata as FormEventMetadata | null;
    if (typeof metadata?.fieldsInteracted === 'number') {
      fieldsInteracted.push(metadata.fieldsInteracted);
    }
  }
  const avgFieldsInteracted =
    fieldsInteracted.length > 0
      ? fieldsInteracted.reduce((a, b) => a + b, 0) / fieldsInteracted.length
      : null;

  const componentId = events.find((e) => e.componentId)?.componentId || null;

  const sessionAbandonRates: number[] = [];
  const sessionCompletionRates: number[] = [];
  const sessionsByVisitor = new Map<string, typeof events>();

  for (const event of events) {
    const key = event.sessionId;
    if (!sessionsByVisitor.has(key)) {
      sessionsByVisitor.set(key, []);
    }
    sessionsByVisitor.get(key)!.push(event);
  }

  for (const sessionEvents of sessionsByVisitor.values()) {
    const sessionStarts = sessionEvents.filter(e => e.type === 'form_start').length;
    const sessionAbandons = sessionEvents.filter(e => e.type === 'form_abandon').length;
    const sessionSubmits = sessionEvents.filter(e => e.type === 'form_submit').length;

    if (sessionStarts > 0) {
      sessionAbandonRates.push(sessionAbandons / sessionStarts);
      sessionCompletionRates.push(sessionSubmits / sessionStarts);
    }
  }

  const abandonRateP25 = calculatePercentile(sessionAbandonRates, 0.25);
  const abandonRateP50 = calculatePercentile(sessionAbandonRates, 0.5);
  const abandonRateP75 = calculatePercentile(sessionAbandonRates, 0.75);
  const abandonRateP90 = calculatePercentile(sessionAbandonRates, 0.9);
  const abandonRateP99 = calculatePercentile(sessionAbandonRates, 0.99);

  const completionRateP25 = calculatePercentile(sessionCompletionRates, 0.25);
  const completionRateP50 = calculatePercentile(sessionCompletionRates, 0.5);
  const completionRateP75 = calculatePercentile(sessionCompletionRates, 0.75);
  const completionRateP90 = calculatePercentile(sessionCompletionRates, 0.9);
  const completionRateP99 = calculatePercentile(sessionCompletionRates, 0.99);

  return {
    projectId,
    date,
    formId,
    componentId,
    starts,
    submits,
    abandons,
    errors,
    completionRate,
    abandonRate,
    errorRate,
    avgTimeToSubmitMs,
    avgTimeToAbandonMs,
    avgFieldsInteracted,
    abandonRateP25,
    abandonRateP50,
    abandonRateP75,
    abandonRateP90,
    abandonRateP99,
    completionRateP25,
    completionRateP50,
    completionRateP75,
    completionRateP90,
    completionRateP99,
  };
}
}
