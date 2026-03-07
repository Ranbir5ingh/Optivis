// src/modules/insights/detectors/behavioral-signals.detector.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  dailyBehavioralElementMetrics,
  dailyBehavioralPageMetrics,
  dailyBehavioralMetrics,
} from 'src/database/drizzle/schema';
import { DetectedInsight } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { toUtcDayStart, toUtcDayEnd } from 'src/shared/utils/date.utils';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { InsightBuilder } from '../builders/insight.builder';
import { SampleSizeValidatorService } from '../services/sample-size-validator.service';

const MIN_ELEMENT_RAGE_CLICKS = 5;
const MIN_PAGE_EXIT_INTENTS = 10;
const PROJECT_RAGE_CLICK_ELEMENTS_THRESHOLD = 5;
const PROJECT_EXIT_INTENT_PAGES_THRESHOLD = 3;
const PROJECT_EXIT_INTENT_RATE_THRESHOLD = 0.5;
const PAGE_EXIT_INTENT_RATE_THRESHOLD = 0.3;

@Injectable()
export class BehavioralSignalsDetector {
  private readonly logger = new Logger(BehavioralSignalsDetector.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly confidenceCalc: ConfidenceCalculatorService,
    private readonly sampleSizeValidator: SampleSizeValidatorService,
  ) {}

  async detectHighRageClicks(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    const elementMetrics = await this.db
      .select()
      .from(dailyBehavioralElementMetrics)
      .where(
        and(
          eq(dailyBehavioralElementMetrics.projectId, projectId),
          gte(dailyBehavioralElementMetrics.date, dayStart),
          lte(dailyBehavioralElementMetrics.date, dayEnd),
        ),
      );

    const significantElements = elementMetrics.filter(
      (m) =>
        m.rageClickCount >= MIN_ELEMENT_RAGE_CLICKS && m.rageClickSessions >= 3,
    );

    for (const metric of significantElements) {
      const validation = this.sampleSizeValidator.validateBehavioralRageClick(
        metric.rageClickCount,
        metric.rageClickSessions,
      );

      if (!validation.valid) {
        this.logger.debug(
          `Skipping rage click insight for element ${metric.elementId}: ${validation.reason}`,
        );
        continue;
      }

      let severity = InsightSeverity.MEDIUM;
      if (metric.rageClickCount >= 15) {
        severity = InsightSeverity.HIGH;
      }

      const confidenceResult = this.confidenceCalc.calculateHeuristicConfidence(
        severity,
        metric.rageClickCount,
        MIN_ELEMENT_RAGE_CLICKS,
        'historical',
      );

      insights.push(
        InsightBuilder.threshold({
          flag: InsightFlag.HIGH_RAGE_CLICKS,
          severity,
          projectId,
          elementId: metric.elementId,
          componentId: metric.componentId || undefined,
          reason: `Element experienced ${metric.rageClickCount} rage clicks across ${metric.rageClickSessions} sessions`,
          value: metric.rageClickCount,
          confidence: confidenceResult.value,
          confidenceMetadata: {
            model: confidenceResult.model,
          },
          context: {
            type: 'element',
          },
          comparison: {
            mode: 'heuristic',
            lens: 'threshold',
            direction: 'increase',
          },
        }),
      );
    }

    const projectMetrics = await this.db
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

    if (projectMetrics.length > 0) {
      const latestMetric = projectMetrics[projectMetrics.length - 1];

      if (
        latestMetric.affectedRageClickElements >=
        PROJECT_RAGE_CLICK_ELEMENTS_THRESHOLD
      ) {
        const confidenceResult =
          this.confidenceCalc.calculateHeuristicConfidence(
            InsightSeverity.HIGH,
            latestMetric.affectedRageClickElements,
            PROJECT_RAGE_CLICK_ELEMENTS_THRESHOLD,
            'historical',
          );

        insights.push(
          InsightBuilder.threshold({
            flag: InsightFlag.HIGH_RAGE_CLICKS,
            severity: InsightSeverity.HIGH,
            projectId,
            reason: `Project-wide: ${latestMetric.affectedRageClickElements} elements affected by rage clicks (${latestMetric.rageClickCount} total incidents)`,
            value: latestMetric.rageClickCount,
            confidence: confidenceResult.value,
            confidenceMetadata: {
              model: confidenceResult.model,
            },
            comparison: {
              mode: 'heuristic',
              lens: 'threshold',
              direction: 'increase',
            },
          }),
        );
      }
    }

    return insights;
  }

  async detectHighExitIntent(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    const dayStart = toUtcDayStart(startDate);
    const dayEnd = toUtcDayEnd(endDate);

    const pageMetrics = await this.db
      .select()
      .from(dailyBehavioralPageMetrics)
      .where(
        and(
          eq(dailyBehavioralPageMetrics.projectId, projectId),
          gte(dailyBehavioralPageMetrics.date, dayStart),
          lte(dailyBehavioralPageMetrics.date, dayEnd),
        ),
      );

    const significantPages = pageMetrics.filter(
      (m) =>
        m.exitIntentCount >= MIN_PAGE_EXIT_INTENTS &&
        (m.earlyExitRate || 0) > PAGE_EXIT_INTENT_RATE_THRESHOLD,
    );

    for (const metric of significantPages) {
      const validation = this.sampleSizeValidator.validateExitIntent(
        metric.exitIntentCount || 0,
        metric.exitIntentSessions || 0,
      );

      if (!validation.valid) {
        this.logger.debug(
          `Skipping exit intent insight for ${metric.path}: ${validation.reason}`,
        );
        continue;
      }

      const avgEarlyExitRate = metric.earlyExitRate || 0;
      const exitIntentCount = metric.exitIntentCount || 0;

      let severity = InsightSeverity.MEDIUM;
      if (avgEarlyExitRate > 0.7) {
        severity = InsightSeverity.HIGH;
      }

      const baseConfidenceResult =
        this.confidenceCalc.calculateHeuristicConfidence(
          severity,
          avgEarlyExitRate,
          0.3,
          'historical',
        );

      const volumeBoost = Math.min(0.15, Math.log10(exitIntentCount) * 0.05);
      const confidence = Math.min(
        0.95,
        baseConfidenceResult.value + volumeBoost,
      );

      insights.push(
        InsightBuilder.threshold({
          flag: InsightFlag.HIGH_EXIT_INTENT,
          severity,
          projectId,
          reason: `${(avgEarlyExitRate * 100).toFixed(0)}% of exit intent visitors leave within 5 seconds on ${metric.path} (${exitIntentCount} total events)`,
          value: avgEarlyExitRate,
          confidence,
          confidenceMetadata: {
            model: 'heuristic',
          },
          context: {
            type: 'page',
            path: metric.path,
          },
          comparison: {
            mode: 'heuristic',
            lens: 'threshold',
            direction: 'increase',
          },
        }),
      );
    }

    const projectMetrics = await this.db
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

    if (projectMetrics.length > 0) {
      const latestMetric = projectMetrics[projectMetrics.length - 1];

      if (
        latestMetric.affectedExitIntentPages >=
        PROJECT_EXIT_INTENT_PAGES_THRESHOLD
      ) {
        const avgExitRate = latestMetric.avgPageEarlyExitRate || 0;

        if (avgExitRate > PROJECT_EXIT_INTENT_RATE_THRESHOLD) {
          const baseConfidenceResult =
            this.confidenceCalc.calculateHeuristicConfidence(
              InsightSeverity.HIGH,
              avgExitRate,
              0.5,
              'historical',
            );

          const breadthBoost = Math.min(
            0.1,
            Math.log2(latestMetric.affectedExitIntentPages) * 0.03,
          );
          const volumeBoost = Math.min(
            0.15,
            Math.log10(latestMetric.exitIntentCount || 1) * 0.05,
          );
          const confidence = Math.min(
            0.95,
            baseConfidenceResult.value + breadthBoost + volumeBoost,
          );

          insights.push(
            InsightBuilder.threshold({
              flag: InsightFlag.HIGH_EXIT_INTENT,
              severity: InsightSeverity.HIGH,
              projectId,
              reason: `Project-wide: ${latestMetric.affectedExitIntentPages} pages experiencing high exit intent (${(avgExitRate * 100).toFixed(0)}% early exits)`,
              value: avgExitRate,
              confidence,
              confidenceMetadata: {
                model: 'heuristic',
              },
              comparison: {
                mode: 'heuristic',
                lens: 'threshold',
                direction: 'increase',
              },
            }),
          );
        }
      }
    }

    return insights;
  }
}
