// src/modules/insights/engine/insight-engine.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalyticsReadRepository } from '../../aggregation/repositories/analytics-read.repository';
import { DetectedInsight } from '../domain/detected-insight.model';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { StatisticalSignificanceDetector } from '../detectors/statistical-significance.detector';
import { PatternDetector } from '../detectors/pattern.detector';
import { CohortDetector } from '../detectors/cohort.detector';
import { InsightsRepository } from '../repositories/insights.repository';
import { InsightsCursorRepository } from '../repositories/insights-cursor.repository';
import { CtrDropDetector } from '../detectors/ctr-drop.detector';
import { EngagementDropDetector } from '../detectors/engagement-drop.detector';
import { PerformanceRegressionDetector } from '../detectors/performance-regression.detector';
import { FunnelBottleneckDetector } from '../detectors/funnel-bottleneck.detector';
import {
  DailyComponentMetricsRow,
  DailyFormMetricsRow,
  DailyPerformanceMetricsRow,
} from 'src/database/drizzle/schema';
import { InsightIdentityService } from '../services/insight-identity.service';
import { BehavioralSignalsDetector } from '../detectors/behavioral-signals.detector';
import { FormAbandonmentDetector } from '../detectors/form-abandonment.detector';
import { parseNumeric } from 'src/shared/utils/numeric.utils';
import { BaselineCalculatorService } from '../services/baseline-calculator.service';
import { ConfidenceCalculatorService } from '../services/confidence-calculator.service';
import { InsightBuilder } from '../builders/insight.builder';
import { FunnelsRepository } from 'src/modules/funnels/funnels.repository';
import { SampleSizeValidatorService } from '../services/sample-size-validator.service';
import { InsightsUpdatedEvent } from '../events/insights-updated.event';

@Injectable()
export class InsightEngineService {
  private readonly logger = new Logger(InsightEngineService.name);

  constructor(
    private readonly ctrDetector: CtrDropDetector,
    private readonly engagementDetector: EngagementDropDetector,
    private readonly performanceDetector: PerformanceRegressionDetector,
    private readonly funnelBottleneckDetector: FunnelBottleneckDetector,
    private readonly behavioralSignalsDetector: BehavioralSignalsDetector,
    private readonly formAbandonmentDetector: FormAbandonmentDetector,
    private readonly significanceDetector: StatisticalSignificanceDetector,
    private readonly patternDetector: PatternDetector,
    private readonly cohortDetector: CohortDetector,
    private readonly insightsRepository: InsightsRepository,
    private readonly cursorRepository: InsightsCursorRepository,
    private readonly readRepo: AnalyticsReadRepository,
    private readonly insightIdService: InsightIdentityService,
    private readonly baselineCalc: BaselineCalculatorService,
    private readonly confidenceCalc: ConfidenceCalculatorService,
    private readonly funnelsRepo: FunnelsRepository,
    private readonly sampleSizeValidator: SampleSizeValidatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async analyzeProject(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    try {
      const totalSessions = await this.readRepo.getTotalSessionsForProject(
        projectId,
        startDate,
        endDate,
      );

      if (totalSessions < 50) {
        this.logger.debug(
          `Skipping insights: insufficient total sessions (${totalSessions} < 50)`,
        );
        return [];
      }

      const [currentComponents, currentPerformance, currentForms] =
        await Promise.all([
          this.readRepo.getDailyComponentMetrics(projectId, startDate, endDate),
          this.readRepo.getDailyPerformanceMetrics(
            projectId,
            startDate,
            endDate,
          ),
          this.readRepo.getDailyFormMetrics(projectId, startDate, endDate),
        ]);

      const anomalies = await this.detectStatisticalAnomalies(
        currentComponents,
        projectId,
      );
      insights.push(...anomalies);

      const componentMetricsByDate =
        this.groupComponentMetricsByDate(currentComponents);
      for (const [componentId, metrics] of componentMetricsByDate) {
        const patterns = await this.patternDetector.detectPatterns(
          projectId,
          startDate,
          endDate,
          metrics,
        );

        if (patterns.hasDownwardTrend && patterns.trendStrength > 0.6) {
          const avgValue =
            metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;

          const resolved = await this.baselineCalc.resolveBaselineFor(
            projectId,
            componentId,
            'engagement',
            { period: '30days', excludeAnomalies: true },
          );

          const percentChange =
            ((avgValue - resolved.baseline.stats.p50) /
              resolved.baseline.stats.p50) *
            100;

          const adjustedConfidence =
            patterns.changePoints.length > 0
              ? patterns.confidence * 0.85
              : patterns.confidence;

          const trendConfidenceResult =
            this.confidenceCalc.calculateTrendConfidence(
              adjustedConfidence,
              metrics.length,
            );

          const trendInsight = InsightBuilder.trend({
            flag: InsightFlag.ENGAGEMENT_TREND_DOWN,
            severity: InsightSeverity.MEDIUM,
            projectId,
            componentId,
            reason: `Significant downward trend detected (strength: ${(adjustedConfidence * 100).toFixed(0)}%)`,
            value: avgValue,
            confidence: trendConfidenceResult.value,
            confidenceMetadata: {
              model: trendConfidenceResult.model,
              sampleSizeWeight: trendConfidenceResult.sampleSizeWeight,
            },
            baselineType: resolved.baseline.type,
            baselineWindowDays: resolved.baseline.windowDays,
            context: { type: 'component' },
            comparison: {
              mode: resolved.baseline.type,
              lens: 'trend',
              direction: 'decrease',
              baselineFallbackReason:
                resolved.baseline.type === 'heuristic'
                  ? resolved.reason
                  : undefined,
            },
          });

          insights.push(trendInsight);
        }
      }

      const cohortInsights = await this.cohortDetector.analyzeCohorts(
        projectId,
        startDate,
        endDate,
      );
      insights.push(...cohortInsights);

      const funnelInsights = await this.detectFunnelBottlenecks(
        projectId,
        startDate,
        endDate,
      );
      insights.push(...funnelInsights);

      const behavioralInsights = await this.detectBehavioralSignals(
        projectId,
        startDate,
        endDate,
      );
      insights.push(...behavioralInsights);

      const formInsights = await this.detectFormIssues(projectId, currentForms);
      insights.push(...formInsights);

      const performanceInsights = await this.detectPerformanceIssues(
        projectId,
        currentPerformance,
      );
      insights.push(...performanceInsights);

      const budgetedInsights = this.applyInsightBudget(insights);

      const activeFlags = new Set(
        budgetedInsights.map((i) =>
          this.insightIdService.createKey(i.flag, i.componentId, i.elementId),
        ),
      );

      await this.insightsRepository.upsertInsights(budgetedInsights);
      await this.insightsRepository.resolveStaleInsights(
        projectId,
        activeFlags,
      );
      await this.cursorRepository.setCursor(projectId, endDate, endDate);

      this.emitInsightsUpdatedEvent(budgetedInsights, projectId);

      this.sortBySeverity(budgetedInsights);

      this.logger.log(
        `Generated ${budgetedInsights.length} insights for ${projectId}`,
      );
      return budgetedInsights;
    } catch (error) {
      this.logger.error('Failed to analyze project', error);
      throw error;
    }
  }

  private applyInsightBudget(insights: DetectedInsight[]): DetectedInsight[] {
    const MAX_HIGH = 5;
    const MAX_TOTAL = 15;

    const high = insights.filter((i) => i.severity === InsightSeverity.HIGH);
    const nonHigh = insights.filter((i) => i.severity !== InsightSeverity.HIGH);

    const cappedHigh = high.slice(0, MAX_HIGH);
    const remaining = MAX_TOTAL - cappedHigh.length;
    const cappedNonHigh = nonHigh.slice(0, Math.max(0, remaining));

    return [...cappedHigh, ...cappedNonHigh];
  }

  private emitInsightsUpdatedEvent(
    insights: DetectedInsight[],
    projectId: string,
  ): void {
    const highSeverityInsights = insights.filter(
      (i) => i.severity === InsightSeverity.HIGH && (i.confidence ?? 0) > 0.7,
    ).length;

    if (highSeverityInsights > 0) {
      this.eventEmitter.emit(
        'insights.updated',
        new InsightsUpdatedEvent(projectId, highSeverityInsights),
      );
      this.logger.debug(
        `Emitted insights.updated event for ${projectId} with ${highSeverityInsights} high-severity insights`,
      );
    }
  }

  private async detectBehavioralSignals(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const [rageClickInsights, exitIntentInsights] = await Promise.all([
      this.behavioralSignalsDetector.detectHighRageClicks(
        projectId,
        startDate,
        endDate,
      ),
      this.behavioralSignalsDetector.detectHighExitIntent(
        projectId,
        startDate,
        endDate,
      ),
    ]);

    return [...rageClickInsights, ...exitIntentInsights];
  }

  private async detectFunnelBottlenecks(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    const funnelMetrics = await this.readRepo.getDailyFunnelMetrics(
      projectId,
      startDate,
      endDate,
    );

    if (funnelMetrics.length === 0) {
      return insights;
    }

    const byFunnel = new Map<string, typeof funnelMetrics>();
    for (const metric of funnelMetrics) {
      if (!byFunnel.has(metric.funnelName)) {
        byFunnel.set(metric.funnelName, []);
      }
      byFunnel.get(metric.funnelName)!.push(metric);
    }

    for (const [funnelName, metrics] of byFunnel) {
      const funnelDef = await this.funnelsRepo.findByProjectAndName(
        projectId,
        funnelName,
      );

      if (!funnelDef) continue;

      for (const metric of metrics) {
        const validation = this.sampleSizeValidator.validateFunnelStep(
          metric.enteredCount,
        );

        if (!validation.valid) {
          continue;
        }

        const currentDropOff = this.parseDropOffRate(metric.dropOffRate);

        const resolved = await this.baselineCalc.resolveBaselineFor(
          projectId,
          `${funnelDef.id}:${metric.stepIndex}`,
          'drop_off_rate',
          { period: '30days', excludeAnomalies: true },
        );

        const insight = this.funnelBottleneckDetector.detect(
          funnelName,
          metric.stepIndex,
          metric.stepName,
          currentDropOff,
          resolved.baseline,
          projectId,
          funnelDef.id,
        );

        if (insight) {
          if (insight.comparison && resolved.reason) {
            insight.comparison.baselineFallbackReason = resolved.reason;
          }
          insights.push(insight);
        }
      }
    }

    return insights;
  }

  private parseDropOffRate(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }

  private async detectFormIssues(
    projectId: string,
    currentForms: DailyFormMetricsRow[],
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    if (currentForms.length === 0) return insights;

    for (const form of currentForms) {
      const abandonResolved = await this.baselineCalc.resolveBaselineFor(
        projectId,
        form.formId,
        'form_abandon_rate',
        { period: '30days', excludeAnomalies: true },
      );

      const abandonmentInsight =
        this.formAbandonmentDetector.detectHighAbandonment(
          form.formId,
          parseNumeric(form.abandonRate, 0),
          abandonResolved.baseline,
          projectId,
          form.componentId || undefined,
        );
      if (abandonmentInsight) {
        abandonmentInsight.baselineType = abandonResolved.baseline.type;
        abandonmentInsight.baselineWindowDays =
          abandonResolved.baseline.windowDays;
        if (abandonmentInsight.comparison && abandonResolved.reason) {
          abandonmentInsight.comparison.baselineFallbackReason =
            abandonResolved.reason;
        }
        insights.push(abandonmentInsight);
      }

      const completionResolved = await this.baselineCalc.resolveBaselineFor(
        projectId,
        form.formId,
        'form_completion_rate',
        { period: '30days', excludeAnomalies: true },
      );

      const completionInsight =
        this.formAbandonmentDetector.detectLowCompletion(
          form.formId,
          parseNumeric(form.completionRate, 0),
          completionResolved.baseline,
          projectId,
          form.componentId || undefined,
        );
      if (completionInsight) {
        completionInsight.baselineType = completionResolved.baseline.type;
        completionInsight.baselineWindowDays =
          completionResolved.baseline.windowDays;
        if (completionInsight.comparison && completionResolved.reason) {
          completionInsight.comparison.baselineFallbackReason =
            completionResolved.reason;
        }
        insights.push(completionInsight);
      }

      const errorResolved = await this.baselineCalc.resolveBaselineFor(
        projectId,
        form.formId,
        'form_error_rate',
        { period: '30days', excludeAnomalies: true },
      );

      const errorInsight = this.formAbandonmentDetector.detectHighErrorRate(
        form.formId,
        parseNumeric(form.errorRate, 0),
        errorResolved.baseline,
        projectId,
        form.componentId || undefined,
      );
      if (errorInsight) {
        errorInsight.baselineType = errorResolved.baseline.type;
        errorInsight.baselineWindowDays = errorResolved.baseline.windowDays;
        if (errorInsight.comparison && errorResolved.reason) {
          errorInsight.comparison.baselineFallbackReason = errorResolved.reason;
        }
        insights.push(errorInsight);
      }
    }

    return insights;
  }

  private async detectPerformanceIssues(
    projectId: string,
    currentPerformance: DailyPerformanceMetricsRow[],
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    if (currentPerformance.length === 0) return insights;

    const lcpResolved = await this.baselineCalc.resolveBaselineFor(
      projectId,
      '',
      'lcp',
      {
        period: '30days',
        excludeAnomalies: true,
      },
    );

    const currentLcp = this.extractAverage(currentPerformance, 'avgLcp');
    if (currentLcp !== null) {
      const lcpInsight = this.performanceDetector.detectLcpRegression(
        currentLcp,
        lcpResolved.baseline,
        projectId,
      );
      if (lcpInsight) {
        lcpInsight.baselineType = lcpResolved.baseline.type;
        lcpInsight.baselineWindowDays = lcpResolved.baseline.windowDays;
        if (lcpInsight.comparison && lcpResolved.reason) {
          lcpInsight.comparison.baselineFallbackReason = lcpResolved.reason;
        }
        insights.push(lcpInsight);
      }
    }

    const clsResolved = await this.baselineCalc.resolveBaselineFor(
      projectId,
      '',
      'cls',
      {
        period: '30days',
        excludeAnomalies: true,
      },
    );

    const currentCls = this.extractAverage(currentPerformance, 'avgCls');
    if (currentCls !== null) {
      const clsInsight = this.performanceDetector.detectClsRegression(
        currentCls,
        clsResolved.baseline,
        projectId,
      );
      if (clsInsight) {
        clsInsight.baselineType = clsResolved.baseline.type;
        clsInsight.baselineWindowDays = clsResolved.baseline.windowDays;
        if (clsInsight.comparison && clsResolved.reason) {
          clsInsight.comparison.baselineFallbackReason = clsResolved.reason;
        }
        insights.push(clsInsight);
      }
    }

    const inpResolved = await this.baselineCalc.resolveBaselineFor(
      projectId,
      '',
      'inp',
      {
        period: '30days',
        excludeAnomalies: true,
      },
    );

    const currentInp = this.extractAverage(currentPerformance, 'avgInp');
    if (currentInp !== null) {
      const inpInsight = this.performanceDetector.detectInpRegression(
        currentInp,
        inpResolved.baseline,
        projectId,
      );
      if (inpInsight) {
        inpInsight.baselineType = inpResolved.baseline.type;
        inpInsight.baselineWindowDays = inpResolved.baseline.windowDays;
        if (inpInsight.comparison && inpResolved.reason) {
          inpInsight.comparison.baselineFallbackReason = inpResolved.reason;
        }
        insights.push(inpInsight);
      }
    }

    const ttfbResolved = await this.baselineCalc.resolveBaselineFor(
      projectId,
      '',
      'ttfb',
      {
        period: '30days',
        excludeAnomalies: true,
      },
    );

    const currentTtfb = this.extractAverage(currentPerformance, 'avgTtfb');
    if (currentTtfb !== null) {
      const ttfbInsight = this.performanceDetector.detectTtfbRegression(
        currentTtfb,
        ttfbResolved.baseline,
        projectId,
      );
      if (ttfbInsight) {
        ttfbInsight.baselineType = ttfbResolved.baseline.type;
        ttfbInsight.baselineWindowDays = ttfbResolved.baseline.windowDays;
        if (ttfbInsight.comparison && ttfbResolved.reason) {
          ttfbInsight.comparison.baselineFallbackReason = ttfbResolved.reason;
        }
        insights.push(ttfbInsight);
      }
    }

    return insights;
  }

  private async detectStatisticalAnomalies(
    currentComponents: DailyComponentMetricsRow[],
    projectId: string,
  ): Promise<DetectedInsight[]> {
    const insights: DetectedInsight[] = [];

    if (currentComponents.length === 0) return insights;

    for (const component of currentComponents) {
      const ctrResolved = await this.baselineCalc.resolveBaselineFor(
        projectId,
        component.componentId,
        'ctr',
        { period: '30days', excludeAnomalies: true },
      );

      const sampleValidation = this.sampleSizeValidator.validateCtr(
        ctrResolved.baseline.stats.sampleSize,
      );

      if (!sampleValidation.valid) {
        continue;
      }

      const currentCtr = parseNumeric(component.ctr, 0);
      const ctrSignificance = this.significanceDetector.detectSignificance(
        currentCtr,
        ctrResolved.baseline,
        0.05,
      );

      if (
        ctrSignificance.isSignificant &&
        ctrSignificance.direction === 'decrease'
      ) {
        const ctrInsight = this.ctrDetector.detectCtrDrop(
          currentCtr,
          ctrResolved.baseline,
          projectId,
          component.componentId,
        );
        if (ctrInsight) {
          ctrInsight.baselineType = ctrResolved.baseline.type;
          ctrInsight.baselineWindowDays = ctrResolved.baseline.windowDays;
          if (ctrInsight.comparison && ctrResolved.reason) {
            ctrInsight.comparison.baselineFallbackReason = ctrResolved.reason;
          }
          insights.push(ctrInsight);
        }
      }

      const engagementResolved = await this.baselineCalc.resolveBaselineFor(
        projectId,
        component.componentId,
        'engagement',
        { period: '30days', excludeAnomalies: true },
      );

      const engagementSampleValidation =
        this.sampleSizeValidator.validateEngagement(
          engagementResolved.baseline.stats.sampleSize,
        );

      if (!engagementSampleValidation.valid) {
        continue;
      }

      const currentEngagement = parseNumeric(component.engagementScore, 0);

      const engagementSignificance =
        this.significanceDetector.detectSignificance(
          currentEngagement,
          engagementResolved.baseline,
          0.05,
        );

      if (
        engagementSignificance.isSignificant &&
        engagementSignificance.direction === 'decrease'
      ) {
        const engagementInsight = this.engagementDetector.detectEngagementDrop(
          currentEngagement,
          engagementResolved.baseline,
          projectId,
          component.componentId,
        );

        if (engagementInsight) {
          engagementInsight.baselineType = engagementResolved.baseline.type;
          engagementInsight.baselineWindowDays =
            engagementResolved.baseline.windowDays;
          if (engagementInsight.comparison && engagementResolved.reason) {
            engagementInsight.comparison.baselineFallbackReason =
              engagementResolved.reason;
          }
          insights.push(engagementInsight);
        }
      }
    }

    return insights;
  }

  private groupComponentMetricsByDate(
    components: DailyComponentMetricsRow[],
  ): Map<string, Array<{ date: Date; value: number }>> {
    const grouped = new Map<string, Array<{ date: Date; value: number }>>();

    for (const component of components) {
      if (!grouped.has(component.componentId)) {
        grouped.set(component.componentId, []);
      }

      grouped.get(component.componentId)!.push({
        date: component.date,
        value: parseNumeric(component.engagementScore, 0),
      });
    }

    for (const metrics of grouped.values()) {
      metrics.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    return grouped;
  }

  private extractAverage(
    rows: DailyPerformanceMetricsRow[],
    field: keyof DailyPerformanceMetricsRow,
  ): number | null {
    const values = rows
      .map((row) => parseNumeric(row[field]))
      .filter((v) => !isNaN(v) && v > 0);

    if (values.length === 0) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private sortBySeverity(insights: DetectedInsight[]): void {
    const severityOrder = {
      [InsightSeverity.HIGH]: 0,
      [InsightSeverity.MEDIUM]: 1,
      [InsightSeverity.LOW]: 2,
      [InsightSeverity.INFO]: 3,
    };

    insights.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
  }
}
