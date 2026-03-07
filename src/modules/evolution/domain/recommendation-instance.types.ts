// src/modules/evolution/domain/recommendation-instance.types.ts

export type RecommendationInstanceStatus =
  | 'new'
  | 'accepted'
  | 'rejected'
  | 'patch_generated'
  | 'pr_created'
  | 'merged'
  | 'evaluating'
  | 'validated'
  | 'invalidated'
  | 'expired';

export type EvolutionJobType =
  | 'generate_patch'
  | 'create_pr'
  | 'evaluate_impact';

export interface RecommendationInstanceMetadata {
  metricType: string;
  expectedDelta: number;
  evaluationWindowDays: number;
  successCriteria: string;
  failureReason?: string;
}

export interface StoredRecommendationSnapshot {
  id: string;
  insightFlag: string;
  sourceInsightIds: string[];
  componentId?: string;
  actionType: string;
  riskLevel: string;
  priority: string;
  confidence: number;
  title: string;
  explanation: string;
  recommendation: string;
  implementationSteps: string[];
  expectedImpact: string;
  reasoning: string;
  scope: {
    componentIds: string[];
    files: string[];
    estimatedLinesChanged: number;
  };
  successMetric: {
    metric: string;
    expectedDelta: number;
    evaluationWindowDays: number;
  };
  requiresMoreContext: boolean;
  recommendationHash: string;
}

export interface RecommendationInstance {
  id: string;
  projectId: string;
  recommendationHash: string;
  snapshotId: string;
  recommendationSnapshot: StoredRecommendationSnapshot;
  status: RecommendationInstanceStatus;
  createdAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  patchGeneratedAt: Date | null;
  patchHash: string | null;
  diffContent: string | null;
  prCreatedAt: Date | null;
  prUrl: string | null;
  prNumber: string | null;
  mergedAt: Date | null;
  commitSha: string | null;
  evaluationWindowEndsAt: Date | null;
  impactEvaluatedAt: Date | null;
  baselineMetricValue: number | null;
  postMetricValue: number | null;
  impactScore: number | null;
  metadata: RecommendationInstanceMetadata;
  expiredAt: Date | null;
  updatedAt: Date;
}