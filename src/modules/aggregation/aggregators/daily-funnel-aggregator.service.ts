// Replace imports and aggregateFunnels method in daily-funnel-aggregator.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  sessionPageSequence,
  NewFunnelMetricsRow,
  type PageVisit,
} from 'src/database/drizzle/schema';
import { AggregationWriteRepository } from '../repositories/aggregation-write.repository';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';
import type { FunnelStep, SessionPageSequenceRow } from 'src/database/drizzle/schema';

import {
  toUtcDayStart,
  toUtcDayEnd,
  getNextDayStart,
} from 'src/shared/utils/date.utils';
import { FunnelsRepository } from '../repositories/funnels.repository';

export interface FunnelDefinition {
  name: string;
  steps: FunnelStep[];
}

@Injectable()
export class DailyFunnelAggregatorService {
  private readonly logger = new Logger(DailyFunnelAggregatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly writeRepo: AggregationWriteRepository,
    private readonly cursorRepo: AggregationCursorRepository,
    private readonly funnelsRepo: FunnelsRepository,
  ) {}

  async aggregateFunnels(projectId: string, date: Date): Promise<void> {
    const startTime = Date.now();
    try {
      const dayStart = toUtcDayStart(date);
      const dayEnd = toUtcDayEnd(date);

      const funnelDefinitions =
        await this.funnelsRepo.findByProjectId(projectId);

      if (funnelDefinitions.length === 0) {
        this.logger.debug(
          `No funnel definitions for ${projectId}, skipping aggregation`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_funnel_metrics',
          nextDayStart,
        );

        return;
      }

      const sessionSequences = await this.db
        .select()
        .from(sessionPageSequence)
        .where(
          and(
            eq(sessionPageSequence.projectId, projectId),
            gte(sessionPageSequence.startedAt, dayStart),
            lte(sessionPageSequence.endedAt, dayEnd),
          ),
        );

      if (sessionSequences.length === 0) {
        this.logger.debug(
          `No session sequences for ${projectId} on ${dayStart.toISOString()}`,
        );

        const nextDayStart = getNextDayStart(dayStart);
        await this.cursorRepo.setCursor(
          projectId,
          'daily_funnel_metrics',
          nextDayStart,
        );

        return;
      }

      const funnelRows: NewFunnelMetricsRow[] = [];

      for (const funnelDef of funnelDefinitions) {
        const rows = this.calculateFunnelMetrics(
          projectId,
          {
            name: funnelDef.name,
            steps: funnelDef.steps,
          },
          sessionSequences,
          dayStart,
        );
        funnelRows.push(...rows);
      }

      if (funnelRows.length > 0) {
        await this.writeRepo.upsertDailyFunnelBatch(funnelRows);
      }

      const nextDayStart = getNextDayStart(dayStart);
      await this.cursorRepo.setCursor(
        projectId,
        'daily_funnel_metrics',
        nextDayStart,
      );

      this.logger.log(
        `✅ DailyFunnelAggregation | project=${projectId} | rows=${funnelRows.length} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ DailyFunnelAggregation failed | project=${projectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private calculateFunnelMetrics(
    projectId: string,
    funnel: FunnelDefinition,
    sessionSequences: SessionPageSequenceRow[],
    date: Date,
  ): NewFunnelMetricsRow[] {
    const stepMetrics: NewFunnelMetricsRow[] = [];

    for (const step of funnel.steps) {
      let enteredCount = 0;
      let completedCount = 0;
      const timeDiffs: number[] = [];

      for (const sequence of sessionSequences) {
        const visits = sequence.pageVisits as PageVisit[];

        const stepVisitIndex = visits.findIndex((visit) =>
          step.paths.some((stepPath) => this.pathMatches(visit.path, stepPath)),
        );

        if (stepVisitIndex === -1) continue;

        const stepVisit = visits[stepVisitIndex];

        if (step.index === 1) {
          enteredCount++;
          completedCount++;
        } else {
          const prevStep = funnel.steps[step.index - 2];

          const prevVisitIndex = visits.findIndex(
            (visit, idx) =>
              idx < stepVisitIndex &&
              prevStep.paths.some((prevPath) =>
                this.pathMatches(visit.path, prevPath),
              ),
          );

          if (prevVisitIndex !== -1) {
            const prevVisit = visits[prevVisitIndex];

            enteredCount++;

            const stepTime = new Date(stepVisit.occurredAt).getTime();
            const prevTime = new Date(prevVisit.occurredAt).getTime();

            if (stepTime > prevTime) {
              completedCount++;
              const timeDiff = stepTime - prevTime;
              timeDiffs.push(timeDiff);
            }
          }
        }
      }

      const dropOffCount = Math.max(0, enteredCount - completedCount);
      const dropOffRate = enteredCount > 0 ? dropOffCount / enteredCount : 0;
      const avgTimeMs =
        timeDiffs.length > 0
          ? timeDiffs.reduce((sum, t) => sum + t, 0) / timeDiffs.length
          : null;

      stepMetrics.push({
        projectId,
        date,
        funnelName: funnel.name,
        stepIndex: step.index,
        stepName: step.name,
        enteredCount,
        completedCount,
        dropOffRate: this.sanitizeNumeric(dropOffRate),
        avgTimeMs: avgTimeMs ? this.sanitizeNumeric(avgTimeMs) : null,
      });
    }

    return stepMetrics;
  }

  private sanitizeNumeric(value: number): number {
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value));
  }

  private pathMatches(actualPath: string, stepPath: string): boolean {
    const cleanActual = actualPath.split('?')[0].split('#')[0];
    const cleanStep = stepPath.split('?')[0].split('#')[0];

    const normalized1 = cleanActual.replace(/\/$/, '') || '/';
    const normalized2 = cleanStep.replace(/\/$/, '') || '/';

    if (normalized1 === normalized2) return true;

    if (normalized2.includes('*')) {
      const regexPattern =
        '^' + normalized2.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
      const regex = new RegExp(regexPattern);
      return regex.test(normalized1);
    }

    return false;
  }
}
