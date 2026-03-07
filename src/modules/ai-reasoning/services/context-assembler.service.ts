// src/modules/ai-reasoning/services/context-assembler.service.ts

import { Injectable } from '@nestjs/common';
import { InsightsRepository } from 'src/modules/insights/repositories/insights.repository';
import { CodeFetchService } from 'src/modules/code-intelligence/services/code-fetch.service';
import { CodeMetadataService } from 'src/modules/code-intelligence/services/code-metadata.service';
import { FunnelsRepository } from 'src/modules/funnels/funnels.repository';
import {
  DetectedInsight,
  InsightContext,
} from 'src/modules/insights/domain/detected-insight.model';

export interface AssembledContext {
  insights: Array<{
    id: string;
    flag: string;
    severity: string;
    componentId?: string;
    elementId?: string;
    reason: string;
    value?: number;
    baseline?: number;
    percentageChange?: number;
    confidence?: number;
    confidenceMetadata?: {
      model: 'statistical' | 'heuristic';
      pValue?: number;
      zScore?: number;
      effectSize?: number;
      sampleSizeWeight?: number;
    };
    zScore?: number;
    pValue?: number;
    baselineType?: string;
    baselineWindowDays?: number;
    context?: InsightContext;
    comparison?: {
      mode: 'historical' | 'heuristic' | 'cohort';
      lens: 'distribution' | 'trend' | 'statistical' | 'threshold';
      direction: 'increase' | 'decrease';
      baselinePercentile?: number;
      baselineFallbackReason?: string;
    };
  }>;
  codeContext: Array<{
    componentId: string;
    name: string;
    filepath: string;
    code: string;
    language: string;
  }>;
  funnelContext: Array<{
    funnelId: string;
    funnelName: string;
    steps: Array<{
      index: number;
      name: string;
    }>;
    associatedInsights: string[];
  }>;
  metadata: {
    projectId: string;
    totalInsights: number;
    criticalInsights: number;
    componentsAnalyzed: number;
    funnelsAnalyzed: number;
  };
}

@Injectable()
export class ContextAssemblerService {
  constructor(
    private readonly insightsRepo: InsightsRepository,
    private readonly codeFetch: CodeFetchService,
    private readonly codeMetadata: CodeMetadataService,
    private readonly funnelsRepo: FunnelsRepository,
  ) {}

  async assembleContext(
    projectId: string,
    options: {
      maxInsights?: number;
      maxComponents?: number;
      severityFilter?: Array<'high' | 'medium' | 'low' | 'info'>;
    } = {},
  ): Promise<AssembledContext> {
    const maxInsights = options.maxInsights || 10;
    const maxComponents = options.maxComponents || 5;
    const severityFilter = options.severityFilter || ['high', 'medium'];

    const allInsights =
      await this.insightsRepo.getUnresolvedInsights(projectId);

    const filteredInsights = allInsights
      .filter((insight) => severityFilter.includes(insight.severity))
      .slice(0, maxInsights);

    const componentIds = new Set<string>();
    const funnelInsightIds = new Set<string>();
    const funnelIds = new Set<string>();

    filteredInsights.forEach((insight) => {
      if (insight.componentId) {
        componentIds.add(insight.componentId);
      }
      if (insight.context?.type === 'funnel' && insight.context.funnelId) {
        funnelIds.add(insight.context.funnelId);
        funnelInsightIds.add(insight.flag);
      }
    });

    const limitedComponentIds = Array.from(componentIds).slice(
      0,
      maxComponents,
    );

    const [codeContext, funnelContext] = await Promise.all([
      this.fetchCodeForComponents(projectId, limitedComponentIds),
      this.fetchFunnelContext(
        projectId,
        Array.from(funnelIds),
        funnelInsightIds,
      ),
    ]);

    const criticalCount = filteredInsights.filter(
      (i) => i.severity === 'high',
    ).length;

    return {
      insights: filteredInsights.map((insight) => ({
        id: insight.id,
        flag: insight.flag,
        severity: insight.severity,
        componentId: insight.componentId,
        elementId: insight.elementId,
        reason: insight.reason,
        value: insight.value,
        baseline: insight.baseline,
        percentageChange: insight.percentageChange,
        confidence: insight.confidence,
        confidenceMetadata: insight.confidenceMetadata,
        zScore: insight.zScore,
        pValue: insight.pValue,
        baselineType: insight.baselineType,
        baselineWindowDays: insight.baselineWindowDays,
        context: insight.context,
        comparison: insight.comparison
          ? {
              mode: insight.comparison.mode,
              lens: insight.comparison.lens,
              direction: insight.comparison.direction,
              baselinePercentile: insight.comparison.baselinePercentile,
              baselineFallbackReason: insight.comparison.baselineFallbackReason,
            }
          : undefined,
      })),

      codeContext,
      funnelContext,
      metadata: {
        projectId,
        totalInsights: filteredInsights.length,
        criticalInsights: criticalCount,
        componentsAnalyzed: codeContext.length,
        funnelsAnalyzed: funnelContext.length,
      },
    };
  }

  private async fetchCodeForComponents(
    projectId: string,
    componentIds: string[],
  ) {
    const codePromises = componentIds.map(async (componentId) => {
      try {
        return await this.codeFetch.fetchComponentCode(projectId, componentId);
      } catch (error) {
        console.warn(
          `[ContextAssembler] Failed to fetch code for component ${componentId}:`,
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    });

    const results = await Promise.all(codePromises);
    return results.filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
  }

  private async fetchFunnelContext(
    projectId: string,
    funnelIds: string[],
    associatedInsightIds: Set<string>,
  ): Promise<
    Array<{
      funnelId: string;
      funnelName: string;
      steps: Array<{ index: number; name: string }>;
      associatedInsights: string[];
    }>
  > {
    if (funnelIds.length === 0) {
      return [];
    }

    const funnelPromises = funnelIds.map(async (funnelId) => {
      try {
        const funnel = await this.funnelsRepo.findById(funnelId);
        if (!funnel) return null;

        return {
          funnelId: funnel.id,
          funnelName: funnel.name,
          steps: (funnel.steps as Array<{ index: number; name: string }>).map(
            (step) => ({
              index: step.index,
              name: step.name,
            }),
          ),
          associatedInsights: Array.from(associatedInsightIds),
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(funnelPromises);
    return results.filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
  }
}
