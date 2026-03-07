// src/database/drizzle/schema/recommendation-instances.schema.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
  doublePrecision,
  jsonb,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const recommendationInstances = pgTable(
  'recommendation_instances',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    recommendationHash: text('recommendation_hash').notNull(),
    snapshotId: uuid('snapshot_id').notNull(),

    recommendationSnapshot: jsonb('recommendation_snapshot')
      .$type<{
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
      }>()
      .notNull(),

    status: text('status').notNull().default('new'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),

    patchGeneratedAt: timestamp('patch_generated_at', { withTimezone: true }),
    patchHash: text('patch_hash'),
    diffContent: text('diff_content'),

    prCreatedAt: timestamp('pr_created_at', { withTimezone: true }),
    prUrl: text('pr_url'),
    prNumber: text('pr_number'),

    mergedAt: timestamp('merged_at', { withTimezone: true }),
    commitSha: text('commit_sha'),

    evaluationWindowEndsAt: timestamp('evaluation_window_ends_at', {
      withTimezone: true,
    }),
    impactEvaluatedAt: timestamp('impact_evaluated_at', { withTimezone: true }),

    baselineMetricValue: doublePrecision('baseline_metric_value'),
    postMetricValue: doublePrecision('post_metric_value'),
    impactScore: doublePrecision('impact_score'),

    metadata: jsonb('metadata')
      .$type<{
        metricType: string;
        expectedDelta: number;
        evaluationWindowDays: number;
        successCriteria: string;
        failureReason?: string;
      }>()
      .notNull(),

    expiredAt: timestamp('expired_at', { withTimezone: true }),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_instance').on(t.projectId, t.recommendationHash),
    index('idx_instances_project').on(t.projectId, t.status),
    index('idx_instances_project_hash').on(t.projectId, t.recommendationHash),
    index('idx_instances_status').on(t.status),
    index('idx_instances_evaluation_window').on(
      t.projectId,
      t.evaluationWindowEndsAt,
    ),
  ],
);

export type RecommendationInstanceRow =
  typeof recommendationInstances.$inferSelect;
export type NewRecommendationInstanceRow =
  typeof recommendationInstances.$inferInsert;