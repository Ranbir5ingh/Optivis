// src/modules/insights/engine/insight-mapper.service.ts

import { Injectable } from '@nestjs/common';
import {
  InsightItemDto,
  ComparisonMetadataDto,
  ConfidenceMetadataDto,
} from '../dto/response/insights.response.dto';
import { PersistedInsight } from '../domain/persisted-insight.model';
import { InsightFlag } from '../domain/insight-flag.enum';
import {
  ComparisonMetadata,
  ConfidenceMetadata,
} from '../domain/detected-insight.model';

@Injectable()
export class InsightMapperService {
  mapToDto(insight: PersistedInsight): InsightItemDto {
    return {
      id: insight.id,

      flag: insight.flag,
      severity: insight.severity,
      status: insight.status,

      title: this.getTitle(insight.flag),
      description: insight.reason,
      recommendation: this.getRecommendation(insight.flag),

      componentId: insight.componentId,
      elementId: insight.elementId,
      context: insight.context,

      value: insight.value,
      baseline: insight.baseline,
      percentageChange: insight.percentageChange,

      baselineType: insight.baselineType,
      baselineWindowDays: insight.baselineWindowDays,

      confidence: insight.confidence,
      confidenceMetadata: insight.confidenceMetadata
        ? this.mapConfidenceMetadata(insight.confidenceMetadata)
        : undefined,
      zScore: insight.zScore,
      pValue: insight.pValue,

      comparison: insight.comparison
        ? this.mapComparison(insight.comparison)
        : undefined,

      detectedAt: insight.detectedAt.toISOString(),
      firstDetectedAt: insight.firstDetectedAt.toISOString(),
      lastSeenAt: insight.lastSeenAt.toISOString(),
    };
  }

  private mapComparison(comparison: ComparisonMetadata): ComparisonMetadataDto {
    return {
      mode: comparison.mode,
      lens: comparison.lens,
      direction: comparison.direction,
      baselinePercentile: comparison.baselinePercentile,
      baselineFallbackReason: comparison.baselineFallbackReason,
    };
  }

  private mapConfidenceMetadata(
    metadata: ConfidenceMetadata,
  ): ConfidenceMetadataDto {
    return {
      model: metadata.model,
      pValue: metadata.pValue,
      zScore: metadata.zScore,
      effectSize: metadata.effectSize,
      sampleSizeWeight: metadata.sampleSizeWeight,
    };
  }

  private getTitle(flag: InsightFlag): string {
    const titles: Record<InsightFlag, string> = {
      [InsightFlag.LOW_CTR]: 'Low Click-Through Rate',
      [InsightFlag.HIGH_BOUNCE_RATE]: 'High Bounce Rate',

      [InsightFlag.PERF_LCP_REGRESSION]: 'LCP Performance Regression',
      [InsightFlag.PERF_CLS_REGRESSION]: 'CLS Layout Instability',
      [InsightFlag.PERF_INP_REGRESSION]: 'INP Responsiveness Regression',
      [InsightFlag.PERF_TTFB_REGRESSION]: 'TTFB Server Response Regression',
      [InsightFlag.PERFORMANCE_REGRESSION]: 'Overall Performance Regression',

      [InsightFlag.ENGAGEMENT_DISTRIBUTION_DROP]:
        'Engagement Distribution Drop',
      [InsightFlag.ENGAGEMENT_TREND_DOWN]: 'Engagement Trend Downward',
      [InsightFlag.VISIBILITY_DROP]: 'Visibility Drop',

      [InsightFlag.ANOMALY_DETECTED]: 'Statistical Anomaly Detected',
      [InsightFlag.NEW_BEST_PERFORMER]: 'New Best Performer Identified',

      [InsightFlag.FUNNEL_BOTTLENECK]: 'Funnel Bottleneck Detected',
      [InsightFlag.COHORT_IMBALANCE]: 'User Cohort Imbalance',

      [InsightFlag.HIGH_FORM_ABANDON]: 'High Form Abandonment Rate',
      [InsightFlag.LOW_FORM_COMPLETION]: 'Low Form Completion Rate',
      [InsightFlag.HIGH_FORM_ERRORS]: 'High Form Error Rate',

      [InsightFlag.HIGH_RAGE_CLICKS]: 'High Rage Click Activity',
      [InsightFlag.HIGH_EXIT_INTENT]: 'High Exit Intent Detected',
    };

    return titles[flag] ?? 'Insight Detected';
  }

  private getRecommendation(flag: InsightFlag): string {
    const recommendations: Partial<Record<InsightFlag, string>> = {
      [InsightFlag.LOW_CTR]:
        'Improve call-to-action clarity, placement, or contrast. Test alternative copy or visual emphasis.',

      [InsightFlag.HIGH_BOUNCE_RATE]:
        'Ensure the page loads quickly, matches user intent, and presents value immediately above the fold.',

      [InsightFlag.PERF_LCP_REGRESSION]:
        'Optimize Largest Contentful Paint by compressing images, reducing render-blocking resources, or improving server response time.',

      [InsightFlag.PERF_CLS_REGRESSION]:
        'Reduce layout shifts by reserving space for images, ads, and dynamic content using fixed dimensions.',

      [InsightFlag.PERF_INP_REGRESSION]:
        'Minimize long JavaScript tasks and optimize event handlers.',

      [InsightFlag.PERF_TTFB_REGRESSION]:
        'Reduce server response time using caching, CDN, or backend optimization.',

      [InsightFlag.PERFORMANCE_REGRESSION]:
        'Audit recent deployments and investigate performance bottlenecks across core web vitals.',

      [InsightFlag.ENGAGEMENT_DISTRIBUTION_DROP]:
        'This component is underperforming relative to its historical distribution. Review content clarity, visual hierarchy, and user attention flow. Consider A/B testing layout or messaging adjustments.',

      [InsightFlag.ENGAGEMENT_TREND_DOWN]:
        'Engagement is declining over time. Review recent UI or content changes, traffic source shifts, or behavioral patterns that may be contributing to gradual disengagement.',

      [InsightFlag.VISIBILITY_DROP]:
        'Ensure this component is visible above the fold or not hidden behind interaction barriers. Verify intersection observer tracking accuracy.',

      [InsightFlag.FUNNEL_BOTTLENECK]:
        'Simplify this funnel step, reduce friction, and clarify user expectations to improve progression.',

      [InsightFlag.COHORT_IMBALANCE]:
        'Analyze user segments to identify behavior discrepancies across cohorts. Adjust personalization or messaging accordingly.',

      [InsightFlag.HIGH_FORM_ABANDON]:
        'Reduce form length, clarify required fields, and provide inline validation to improve completion rates.',

      [InsightFlag.LOW_FORM_COMPLETION]:
        'Review form usability and simplify the submission process to improve completion rates.',

      [InsightFlag.HIGH_FORM_ERRORS]:
        'Improve validation feedback and reduce ambiguous input requirements.',

      [InsightFlag.HIGH_RAGE_CLICKS]:
        'Investigate potential UI frustration points. Ensure interactive elements respond clearly and consistently.',

      [InsightFlag.HIGH_EXIT_INTENT]:
        'Evaluate whether key information or value propositions are visible before users attempt to leave the page.',

      [InsightFlag.ANOMALY_DETECTED]:
        'Investigate unusual behavioral or performance deviations that may indicate tracking errors or unexpected user behavior.',

      [InsightFlag.NEW_BEST_PERFORMER]:
        'Identify what differentiates this component and replicate its strengths across similar elements.',
    };

    return (
      recommendations[flag] ??
      'Review this insight and consider optimization opportunities.'
    );
  }
}
