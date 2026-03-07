// src/modules/ai-reasoning/domain/recommendation.types.ts

export type ActionType =
  | 'copy_change'
  | 'style_change'
  | 'layout_change'
  | 'logic_change'
  | 'performance_optimization'
  | 'experiment';

export type RiskLevel = 'low' | 'medium' | 'high';

export type Priority = 'high' | 'medium' | 'low';

export type MetricType =
  | 'ctr'
  | 'engagement'
  | 'scroll_depth'
  | 'ttfb'
  | 'bounce_rate'
  | 'conversion_rate'
  | 'time_on_page';

export interface RecommendationScope {
  componentIds: string[];
  files: string[];
  estimatedLinesChanged: number;
}

export interface SuccessMetric {
  metric: MetricType;
  expectedDelta: number;
  evaluationWindowDays: number;
}

export interface AIRecommendation {
  id: string;
  insightFlag: string;
  sourceInsightIds: string[];
  componentId?: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  priority: Priority;
  confidence: number;
  title: string;
  explanation: string;
  recommendation: string;
  implementationSteps: string[];
  expectedImpact: string;
  reasoning: string;
  scope: RecommendationScope;
  successMetric: SuccessMetric;
  requiresMoreContext: boolean;
  recommendationHash: string;
}

export interface RecommendationSummary {
  totalIssues: number;
  criticalIssues: number;
  estimatedImprovementPotential: string;
}

export interface AIReasoningResult {
  recommendations: AIRecommendation[];
  summary: RecommendationSummary;
  metadata: {
    tokensUsed: {
      input: number;
      output: number;
    };
    model: string;
    generatedAt: string;
    reasoningVersion: string;
    commitSha?: string;
  };
}
