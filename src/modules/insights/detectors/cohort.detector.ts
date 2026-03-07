// src/modules/insights/detectors/cohort.detector.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { and, eq, gte, lte } from 'drizzle-orm';
import { sessionMetrics } from 'src/database/drizzle/schema';
import { DetectedInsight } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { INSIGHT_THRESHOLDS } from '../config/insight-thresholds.config';
import { SampleSizeValidatorService } from '../services/sample-size-validator.service';
import { InsightBuilder } from '../builders/insight.builder';

interface CohortSegmentMetrics {
  sessionCount: number;
  avgDuration: number;
  bounceRate: number;
  avgEngagement: number;
}

@Injectable()
export class CohortDetector {
  private readonly logger = new Logger(CohortDetector.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly confidenceCalc: ConfidenceCalculatorService,
    private readonly sampleSizeValidator: SampleSizeValidatorService,
  ) {}

  async analyzeCohorts(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    const cohortMetrics = await this.fetchCohortMetrics(
      projectId,
      startDate,
      endDate,
    );

    if (
      !cohortMetrics.newUsers ||
      !cohortMetrics.returningUsers ||
      cohortMetrics.newUsers.sessionCount === 0 ||
      cohortMetrics.returningUsers.sessionCount === 0
    ) {
      return insights;
    }

    const newUserValidation = this.sampleSizeValidator.validateCohort(
      cohortMetrics.newUsers.sessionCount,
    );

    const returningValidation = this.sampleSizeValidator.validateCohort(
      cohortMetrics.returningUsers.sessionCount,
    );

    if (!newUserValidation.valid || !returningValidation.valid) {
      this.logger.debug(
        `Skipping cohort analysis: ${!newUserValidation.valid ? newUserValidation.reason : !returningValidation.valid ? returningValidation.reason : 'unknown reason'}`,
      );
      return insights;
    }

    const newUserEngagement = cohortMetrics.newUsers.avgEngagement;
    const returningUserEngagement = cohortMetrics.returningUsers.avgEngagement;

    if (
      returningUserEngagement > 0 &&
      newUserEngagement < returningUserEngagement * 0.5
    ) {
      const percentChange =
        ((newUserEngagement - returningUserEngagement) /
          returningUserEngagement) *
        100;

      const confidenceResult = this.confidenceCalc.calculateHeuristicConfidence(
        InsightSeverity.HIGH,
        returningUserEngagement - newUserEngagement,
        returningUserEngagement * 0.5,
        'historical',
      );

      insights.push(
        InsightBuilder.threshold({
          flag: InsightFlag.COHORT_IMBALANCE,
          severity: InsightSeverity.HIGH,
          projectId,
          reason: `New users engage ${Math.abs(percentChange).toFixed(0)}% less than returning users`,
          value: newUserEngagement,
          baseline: returningUserEngagement,
          percentageChange: percentChange,
          confidence: confidenceResult.value,
          confidenceMetadata: {
            model: confidenceResult.model,
          },
          comparison: {
            mode: 'cohort',
            lens: 'distribution',
            direction: 'decrease',
          },
        }),
      );
    }

    const mediumBounceThreshold = INSIGHT_THRESHOLDS.HIGH_BOUNCE_RATE.medium;
    const highBounceThreshold = INSIGHT_THRESHOLDS.HIGH_BOUNCE_RATE.high;

    if (
      cohortMetrics.newUsers.bounceRate > mediumBounceThreshold &&
      cohortMetrics.newUsers.bounceRate >
        cohortMetrics.returningUsers.bounceRate * 1.5
    ) {
      const severity =
        cohortMetrics.newUsers.bounceRate > highBounceThreshold
          ? InsightSeverity.HIGH
          : InsightSeverity.MEDIUM;

      const bounceRateDiff =
        cohortMetrics.newUsers.bounceRate -
        cohortMetrics.returningUsers.bounceRate;
      const percentChange =
        (bounceRateDiff / cohortMetrics.returningUsers.bounceRate) * 100;

      const confidenceResult = this.confidenceCalc.calculateHeuristicConfidence(
        severity,
        cohortMetrics.newUsers.bounceRate,
        mediumBounceThreshold,
        'historical',
      );

      insights.push(
        InsightBuilder.threshold({
          flag: InsightFlag.HIGH_BOUNCE_RATE,
          severity,
          projectId,
          reason: `New users have ${(cohortMetrics.newUsers.bounceRate * 100).toFixed(0)}% bounce rate, ${percentChange.toFixed(0)}% higher than returning users`,
          value: cohortMetrics.newUsers.bounceRate,
          baseline: cohortMetrics.returningUsers.bounceRate,
          percentageChange: percentChange,
          confidence: confidenceResult.value,
          confidenceMetadata: {
            model: confidenceResult.model,
          },
          comparison: {
            mode: 'cohort',
            lens: 'threshold',
            direction: 'increase',
          },
        }),
      );
    }

    const newUserDuration = cohortMetrics.newUsers.avgDuration;
    const returningUserDuration = cohortMetrics.returningUsers.avgDuration;

    if (
      returningUserDuration > 0 &&
      newUserDuration < returningUserDuration * 0.4
    ) {
      const percentChange =
        ((newUserDuration - returningUserDuration) / returningUserDuration) *
        100;

      const confidenceResult = this.confidenceCalc.calculateHeuristicConfidence(
        InsightSeverity.MEDIUM,
        returningUserDuration - newUserDuration,
        returningUserDuration * 0.6,
        'historical',
      );

      insights.push(
        InsightBuilder.threshold({
          flag: InsightFlag.COHORT_IMBALANCE,
          severity: InsightSeverity.MEDIUM,
          projectId,
          reason: `New users spend ${(newUserDuration / 1000).toFixed(0)}s on average, ${Math.abs(percentChange).toFixed(0)}% less than returning users`,
          value: newUserDuration,
          baseline: returningUserDuration,
          percentageChange: percentChange,
          confidence: confidenceResult.value,
          confidenceMetadata: {
            model: confidenceResult.model,
          },
          comparison: {
            mode: 'cohort',
            lens: 'threshold',
            direction: 'decrease',
          },
        }),
      );
    }

    return insights;
  }

  private async fetchCohortMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, CohortSegmentMetrics | null>> {
    const rows = await this.db
      .select()
      .from(sessionMetrics)
      .where(
        and(
          eq(sessionMetrics.projectId, projectId),
          gte(sessionMetrics.endedAt, startDate),
          lte(sessionMetrics.endedAt, endDate),
        ),
      );

    const cohortGroups: Record<string, typeof rows> = {
      new_users: [],
      returning_users: [],
      power_users: [],
    };

    for (const row of rows) {
      const cohort = row.userCohort || 'new_users';
      if (!cohortGroups[cohort]) {
        cohortGroups[cohort] = [];
      }
      cohortGroups[cohort].push(row);
    }

    const result: Record<string, CohortSegmentMetrics | null> = {};

    for (const [cohort, sessions] of Object.entries(cohortGroups)) {
      if (sessions.length === 0) {
        result[cohort] = null;
        continue;
      }

      const totalSessions = sessions.length;
      const totalDuration = sessions.reduce(
        (sum, s) => sum + (s.durationMs || 0),
        0,
      );
      const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

      const bouncedSessions = sessions.filter((s) => s.bounced).length;
      const bounceRate =
        totalSessions > 0 ? bouncedSessions / totalSessions : 0;

      const maxScrollDepths = sessions
        .map((s) => s.maxScrollDepth || 0)
        .filter((d) => d > 0);
      const avgScrollDepth =
        maxScrollDepths.length > 0
          ? maxScrollDepths.reduce((sum, d) => sum + d, 0) /
            maxScrollDepths.length
          : 0;

      const engagementScore = this.calculateEngagementScore(
        0,
        avgDuration,
        avgScrollDepth,
      );

      result[cohort] = {
        sessionCount: totalSessions,
        avgDuration,
        bounceRate,
        avgEngagement: engagementScore,
      };
    }

    return {
      newUsers: result['new_users'],
      returningUsers: result['returning_users'],
      powerUsers: result['power_users'],
    } as Record<string, CohortSegmentMetrics | null>;
  }

  private calculateEngagementScore(
    ctr: number,
    timeVisibleMs: number,
    scrollDepth: number,
  ): number {
    const ctrNorm = Math.min(ctr / 0.1, 1);
    const timeNorm = Math.min(timeVisibleMs / 5000, 1);
    const scrollNorm = Math.min(scrollDepth / 50, 1);

    return ctrNorm * 0.4 + timeNorm * 0.35 + scrollNorm * 0.25;
  }
}