// src/database/drizzle/schema/ai-recommendations.schema.ts

import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  index,
  text,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const aiRecommendations = pgTable(
  'ai_recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    recommendations: jsonb('recommendations')
      .$type<
        Array<{
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
        }>
      >()
      .notNull(),

    summary: jsonb('summary')
      .$type<{
        totalIssues: number;
        criticalIssues: number;
        estimatedImprovementPotential: string;
      }>()
      .notNull(),

    metadata: jsonb('metadata')
      .$type<{
        tokensUsed: {
          input: number;
          output: number;
        };
        model: string;
        generatedAt: string;
        reasoningVersion: string;
        commitSha?: string;
      }>()
      .notNull(),

    reasoningVersion: text('reasoning_version').notNull(),

    commitSha: text('commit_sha'),

    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_ai_recommendations_project').on(
      t.projectId,
      t.generatedAt.desc(),
    ),
    index('idx_ai_recommendations_version').on(t.reasoningVersion),
    index('idx_ai_recommendations_commit').on(t.commitSha),
  ],
);

export type AIRecommendationRow = typeof aiRecommendations.$inferSelect;
export type NewAIRecommendationRow = typeof aiRecommendations.$inferInsert;
export type StoredAIRecommendation =
  (typeof aiRecommendations.$inferInsert)['recommendations'][number];
export type StoredRecommendationSummary =
  (typeof aiRecommendations.$inferInsert)['summary'];
export type StoredRecommendationMetadata =
  (typeof aiRecommendations.$inferInsert)['metadata'];
