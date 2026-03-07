// src/modules/ai-reasoning/repositories/ai-reasoning.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { eq, desc } from 'drizzle-orm';
import {
  aiRecommendations,
  NewAIRecommendationRow,
  AIRecommendationRow,
  StoredAIRecommendation,
  StoredRecommendationSummary,
  StoredRecommendationMetadata,
} from 'src/database/drizzle/schema';
import {
  AIReasoningResult,
  AIRecommendation,
} from '../domain/recommendation.types';

@Injectable()
export class AIReasoningRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async saveRecommendations(
    projectId: string,
    result: AIReasoningResult,
  ): Promise<string> {
    const row: NewAIRecommendationRow = {
      projectId,
      recommendations: result.recommendations as StoredAIRecommendation[],
      summary: result.summary as StoredRecommendationSummary,
      metadata: result.metadata as StoredRecommendationMetadata,
      reasoningVersion: result.metadata.reasoningVersion,
      commitSha: result.metadata.commitSha,
    };

    const [inserted] = await this.db
      .insert(aiRecommendations)
      .values(row)
      .returning();

    return inserted.id;
  }

  async getLatestRecommendations(
    projectId: string,
  ): Promise<AIReasoningResult | null> {
    const [row] = await this.db
      .select()
      .from(aiRecommendations)
      .where(eq(aiRecommendations.projectId, projectId))
      .orderBy(desc(aiRecommendations.generatedAt))
      .limit(1);

    if (!row) return null;

    return this.rowToResult(row);
  }

  async getRecommendationHistory(
    projectId: string,
    limit: number,
  ): Promise<AIReasoningResult[]> {
    const rows = await this.db
      .select()
      .from(aiRecommendations)
      .where(eq(aiRecommendations.projectId, projectId))
      .orderBy(desc(aiRecommendations.generatedAt))
      .limit(limit);

    return rows.map(this.rowToResult);
  }

  async getByHash(
    projectId: string,
    recommendationHash: string,
  ): Promise<AIRecommendation | null> {
    const latest = await this.getLatestRecommendations(projectId);
    if (!latest) return null;

    return (
      latest.recommendations.find(
        (r) => r.recommendationHash === recommendationHash,
      ) ?? null
    );
  }

  private rowToResult(row: AIRecommendationRow): AIReasoningResult {
    return {
      recommendations:
        row.recommendations as unknown as AIReasoningResult['recommendations'],
      summary: row.summary as unknown as AIReasoningResult['summary'],
      metadata: row.metadata as unknown as AIReasoningResult['metadata'],
    };
  }
}
