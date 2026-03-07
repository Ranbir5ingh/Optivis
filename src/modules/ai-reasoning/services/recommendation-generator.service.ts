// src/modules/ai-reasoning/services/recommendation-generator.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AIProvider } from '../providers/ai-provider.interface';
import { AI_PROVIDER } from '../providers/ai-provider.tokens';
import { PromptBuilderService } from './prompt-builder.service';
import { AssembledContext } from './context-assembler.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import {
  AIRecommendation,
  RecommendationSummary,
  AIReasoningResult,
  ActionType,
  RiskLevel,
  Priority,
  MetricType,
} from '../domain/recommendation.types';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const REASONING_VERSION = '1.0.0';

@Injectable()
export class RecommendationGeneratorService {
  private readonly logger = new Logger(RecommendationGeneratorService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly promptBuilder: PromptBuilderService,
    private readonly config: ConfigService,
  ) {}

  async generate(
    context: AssembledContext,
    commitSha?: string,
  ): Promise<AIReasoningResult> {
    if (context.insights.length === 0) {
      return this.emptyResult(commitSha);
    }

    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.promptBuilder.buildUserPrompt(context);

    const response = await this.ai.complete({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 4096,
      temperature: 0.7,
    });

    const parsed = this.parseResponse(response.text, context);

    const deduplicatedRecs = this.deduplicateRecommendations(
      parsed.recommendations,
    );

    return {
      recommendations: deduplicatedRecs,
      summary: parsed.summary,
      metadata: {
        tokensUsed: {
          input: response.usage?.inputTokens || 0,
          output: response.usage?.outputTokens || 0,
        },
        model: response.model,
        generatedAt: new Date().toISOString(),
        reasoningVersion: REASONING_VERSION,
        commitSha,
      },
    };
  }

  private parseResponse(
    text: string,
    context: AssembledContext,
  ): {
    recommendations: AIRecommendation[];
    summary: RecommendationSummary;
  } {
    try {
      const jsonMatch =
        text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        throw new Error(
          'Invalid response structure: missing recommendations array',
        );
      }

      const insightIdMap = new Map(context.insights.map((i) => [i.id, i]));
      const insightFlagSet = new Set(context.insights.map((i) => i.flag));

      const recommendations: AIRecommendation[] = parsed.recommendations
        .map((rec: unknown) => {
          const r = rec as Record<string, unknown>;
          const sourceInsightIds = Array.isArray(r.sourceInsightIds)
            ? (r.sourceInsightIds as string[])
            : [];

          if (sourceInsightIds.length === 0) {
            this.logger.warn(
              `Rejecting recommendation without source insights: ${r.insightFlag}`,
            );
            return null;
          }

          const validSourceIds = sourceInsightIds.filter((id) =>
            insightIdMap.has(id),
          );

          if (validSourceIds.length === 0) {
            this.logger.warn(
              `Rejecting recommendation with invalid source insight IDs: ${r.insightFlag}`,
            );
            return null;
          }

          const insightFlag = String(r.insightFlag || 'UNKNOWN');
          if (!insightFlagSet.has(insightFlag)) {
            this.logger.warn(
              `Recommendation insightFlag "${insightFlag}" does not match any detected insight`,
            );
            return null;
          }

          const sourceInsights = validSourceIds
            .map((id) => insightIdMap.get(id))
            .filter((insight) => insight !== undefined);

          const derivedConfidence =
            this.deriveConfidenceFromInsights(sourceInsights);

          const recommendationHash = this.generateHash(
            validSourceIds,
            r.componentId as string | undefined,
            r.actionType as string,
          );

          return {
            id: String(r.id || uuidv4()),
            insightFlag,
            sourceInsightIds: validSourceIds,
            componentId: r.componentId ? String(r.componentId) : undefined,
            actionType: this.validateActionType(r.actionType),
            riskLevel: this.validateRiskLevel(r.riskLevel),
            priority: this.validatePriority(r.priority),
            confidence: derivedConfidence,
            title: String(r.title || 'Untitled Recommendation'),
            explanation: String(r.explanation || ''),
            recommendation: String(r.recommendation || ''),
            implementationSteps: Array.isArray(r.implementationSteps)
              ? r.implementationSteps.map(String)
              : [],
            expectedImpact: String(r.expectedImpact || 'Unknown impact'),
            reasoning: String(r.reasoning || ''),
            scope: this.validateScope(r.scope),
            successMetric: this.validateSuccessMetric(r.successMetric),
            requiresMoreContext: Boolean(r.requiresMoreContext),
            recommendationHash,
          };
        })
        .filter((rec): rec is AIRecommendation => rec !== null);

      const summary: RecommendationSummary = {
        totalIssues: Number(
          parsed.summary?.totalIssues || recommendations.length,
        ),
        criticalIssues: Number(parsed.summary?.criticalIssues || 0),
        estimatedImprovementPotential: String(
          parsed.summary?.estimatedImprovementPotential || 'To be determined',
        ),
      };

      return { recommendations, summary };
    } catch (error) {
      this.logger.error(
        `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new DomainError(
        'AI_RESPONSE_PARSE_FAILED',
        'Failed to parse AI recommendations',
        'unexpected',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  private deriveConfidenceFromInsights(
    sourceInsights: (AssembledContext['insights'][number] | undefined)[],
  ): number {
    if (sourceInsights.length === 0) {
      return 0.5;
    }

    const validInsights = sourceInsights.filter(
      (i) => i !== undefined,
    ) as AssembledContext['insights'];

    if (validInsights.length === 0) {
      return 0.5;
    }

    const statisticalInsights = validInsights.filter(
      (i) => i.confidenceMetadata?.model === 'statistical',
    );

    const heuristicInsights = validInsights.filter(
      (i) => i.confidenceMetadata?.model === 'heuristic',
    );

    let baseConfidence: number;

    if (statisticalInsights.length > 0) {
      const confidences = statisticalInsights.map((i) => i.confidence || 0.5);
      baseConfidence = Math.max(...confidences);

      if (statisticalInsights.length > 1) {
        const minConfidence = Math.min(...confidences);
        const confidenceDiff = baseConfidence - minConfidence;

        if (confidenceDiff > 0.25) {
          baseConfidence *= 0.85;
        }
      }

      if (heuristicInsights.length > statisticalInsights.length) {
        baseConfidence *= 0.9;
      }
    } else {
      const heuristicAvg =
        heuristicInsights.reduce((sum, i) => sum + (i.confidence || 0.5), 0) /
        heuristicInsights.length;
      baseConfidence = Math.min(heuristicAvg, 0.65);
    }

    let adjustedConfidence = baseConfidence;

    for (const insight of validInsights) {
      if (
        insight.confidenceMetadata?.sampleSizeWeight !== undefined &&
        insight.confidenceMetadata.sampleSizeWeight < 0.5
      ) {
        adjustedConfidence *= 0.85;
      }
    }

    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  private deduplicateRecommendations(
    recommendations: AIRecommendation[],
  ): AIRecommendation[] {
    const seen = new Map<string, AIRecommendation>();

    for (const rec of recommendations) {
      const key = rec.recommendationHash;
      if (!seen.has(key)) {
        seen.set(key, rec);
      }
    }

    return Array.from(seen.values());
  }

  private generateHash(
    sourceInsightIds: string[],
    componentId: string | undefined,
    actionType: string,
  ): string {
    const input = `${sourceInsightIds.sort().join(',')}:${componentId || 'none'}:${actionType}`;
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  private validateActionType(value: unknown): ActionType {
    const validTypes: ActionType[] = [
      'copy_change',
      'style_change',
      'layout_change',
      'logic_change',
      'performance_optimization',
      'experiment',
    ];
    if (validTypes.includes(value as ActionType)) {
      return value as ActionType;
    }
    return 'copy_change';
  }

  private validateRiskLevel(value: unknown): RiskLevel {
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return 'medium';
  }

  private validatePriority(value: unknown): Priority {
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return 'medium';
  }

  private validateConfidence(value: unknown): number {
    const num = Number(value);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }

  private validateScope(value: unknown): AIRecommendation['scope'] {
    if (!value || typeof value !== 'object') {
      return {
        componentIds: [],
        files: [],
        estimatedLinesChanged: 0,
      };
    }

    const scope = value as Record<string, unknown>;
    return {
      componentIds: Array.isArray(scope.componentIds)
        ? scope.componentIds.map(String)
        : [],
      files: Array.isArray(scope.files) ? scope.files.map(String) : [],
      estimatedLinesChanged: Number(scope.estimatedLinesChanged) || 0,
    };
  }

  private validateSuccessMetric(
    value: unknown,
  ): AIRecommendation['successMetric'] {
    if (!value || typeof value !== 'object') {
      return {
        metric: 'engagement',
        expectedDelta: 0,
        evaluationWindowDays: 7,
      };
    }

    const metric = value as Record<string, unknown>;
    const validMetrics: MetricType[] = [
      'ctr',
      'engagement',
      'scroll_depth',
      'ttfb',
      'bounce_rate',
      'conversion_rate',
      'time_on_page',
    ];

    return {
      metric: validMetrics.includes(metric.metric as MetricType)
        ? (metric.metric as MetricType)
        : 'engagement',
      expectedDelta: Number(metric.expectedDelta) || 0,
      evaluationWindowDays: Number(metric.evaluationWindowDays) || 7,
    };
  }

  private emptyResult(commitSha?: string): AIReasoningResult {
    return {
      recommendations: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        estimatedImprovementPotential: 'No issues detected',
      },
      metadata: {
        tokensUsed: { input: 0, output: 0 },
        model: 'none',
        generatedAt: new Date().toISOString(),
        reasoningVersion: REASONING_VERSION,
        commitSha,
      },
    };
  }
}
