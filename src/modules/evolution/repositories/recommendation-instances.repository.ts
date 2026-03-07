// src/modules/evolution/repositories/recommendation-instances.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, desc, gte, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  recommendationInstances,
  RecommendationInstanceRow,
  NewRecommendationInstanceRow,
} from 'src/database/drizzle/schema';
import {
  RecommendationInstance,
  RecommendationInstanceStatus,
} from '../domain/recommendation-instance.types';

@Injectable()
export class RecommendationInstancesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(
    data: NewRecommendationInstanceRow,
  ): Promise<RecommendationInstanceRow> {
    const [row] = await this.db
      .insert(recommendationInstances)
      .values(data)
      .returning();

    return row;
  }

  async getByHash(
    projectId: string,
    recommendationHash: string,
  ): Promise<RecommendationInstance | null> {
    const [row] = await this.db
      .select()
      .from(recommendationInstances)
      .where(
        and(
          eq(recommendationInstances.projectId, projectId),
          eq(recommendationInstances.recommendationHash, recommendationHash),
        ),
      )
      .limit(1);

    return row ? this.castToRecommendationInstance(row) : null;
  }

  async getById(instanceId: string): Promise<RecommendationInstance | null> {
    const [row] = await this.db
      .select()
      .from(recommendationInstances)
      .where(eq(recommendationInstances.id, instanceId))
      .limit(1);

    return row ? this.castToRecommendationInstance(row) : null;
  }

  async updateStatus(
    instanceId: string,
    status: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(recommendationInstances)
      .set({
        status,
        updatedAt: new Date(),
        ...data,
      })
      .where(eq(recommendationInstances.id, instanceId));
  }

  async findByProjectId(
    projectId: string,
    limit: number,
    offset: number,
  ): Promise<RecommendationInstance[]> {
    const rows = await this.db
      .select()
      .from(recommendationInstances)
      .where(eq(recommendationInstances.projectId, projectId))
      .orderBy(desc(recommendationInstances.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.castToRecommendationInstance(row));
  }

  async countByProjectId(projectId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(recommendationInstances)
      .where(eq(recommendationInstances.projectId, projectId));

    return result?.count ?? 0;
  }

  async getActiveForProject(
    projectId: string,
  ): Promise<RecommendationInstance[]> {
    const rows = await this.db
      .select()
      .from(recommendationInstances)
      .where(
        and(
          eq(recommendationInstances.projectId, projectId),
          isNull(recommendationInstances.rejectedAt),
          isNull(recommendationInstances.expiredAt),
        ),
      )
      .orderBy(desc(recommendationInstances.createdAt));

    return rows.map((row) => this.castToRecommendationInstance(row));
  }

  async getReadyForEvaluation(
    projectId: string,
  ): Promise<RecommendationInstance[]> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(recommendationInstances)
      .where(
        and(
          eq(recommendationInstances.projectId, projectId),
          eq(recommendationInstances.status, 'merged'),
          gte(recommendationInstances.evaluationWindowEndsAt, now),
          isNull(recommendationInstances.impactEvaluatedAt),
        ),
      );

    return rows.map((row) => this.castToRecommendationInstance(row));
  }

  async getExpired(projectId: string): Promise<RecommendationInstance[]> {
    const now = new Date();

    const rows = await this.db
      .select()
      .from(recommendationInstances)
      .where(
        and(
          eq(recommendationInstances.projectId, projectId),
          lte(recommendationInstances.evaluationWindowEndsAt, now),
          isNull(recommendationInstances.expiredAt),
        ),
      );

    return rows.map((row) => this.castToRecommendationInstance(row));
  }

  async getByPRNumber(prNumber: string): Promise<RecommendationInstance[]> {
    const rows = await this.db
      .select()
      .from(recommendationInstances)
      .where(eq(recommendationInstances.prNumber, prNumber));

    return rows.map((row) => this.castToRecommendationInstance(row));
  }

  private castToRecommendationInstance(
    row: RecommendationInstanceRow,
  ): RecommendationInstance {
    return {
      id: row.id,
      projectId: row.projectId,
      recommendationHash: row.recommendationHash,
      snapshotId: row.snapshotId,
      recommendationSnapshot: row.recommendationSnapshot,
      status: row.status as RecommendationInstanceStatus,
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
      rejectedAt: row.rejectedAt,
      patchGeneratedAt: row.patchGeneratedAt,
      patchHash: row.patchHash,
      diffContent: row.diffContent,
      prCreatedAt: row.prCreatedAt,
      prUrl: row.prUrl,
      prNumber: row.prNumber,
      mergedAt: row.mergedAt,
      commitSha: row.commitSha,
      evaluationWindowEndsAt: row.evaluationWindowEndsAt,
      impactEvaluatedAt: row.impactEvaluatedAt,
      baselineMetricValue: row.baselineMetricValue,
      postMetricValue: row.postMetricValue,
      impactScore: row.impactScore,
      metadata: row.metadata,
      expiredAt: row.expiredAt,
      updatedAt: row.updatedAt,
    };
  }
}
