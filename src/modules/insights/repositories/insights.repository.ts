// src/modules/insights/repositories/insights.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { and, desc, eq, gte, isNull, inArray, lte } from 'drizzle-orm';
import {
  detectedInsights,
  NewDetectedInsightRow,
  DetectedInsightRow,
} from 'src/database/drizzle/schema';
import {
  BaselineType,
  DetectedInsight,
} from '../domain/detected-insight.model';
import { subtractDays } from 'src/shared/utils/date.utils';
import { InsightFlag, InsightSeverity } from '../domain/insight-flag.enum';
import { InsightStatus } from '../domain/insight-status.enum';
import { PersistedInsight } from '../domain/persisted-insight.model';

@Injectable()
export class InsightsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async upsertInsights(insights: DetectedInsight[]): Promise<void> {
    if (insights.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const insight of insights) {
        const existing = await this.findActiveInsightInTx(
          tx,
          insight.projectId,
          insight.flag,
          insight.componentId,
          insight.elementId,
        );

        const baselineType = insight.baselineType || 'historical';
        const baselineWindowDays = insight.baselineWindowDays || 30;
        const context = insight.context || undefined;
        const comparison = insight.comparison || undefined;
        const confidenceMetadata = insight.confidenceMetadata || undefined;

        if (existing) {
          if (existing.status === 'resolved') {
            await tx
              .update(detectedInsights)
              .set({
                status: InsightStatus.REGRESSED,
                regressedAt: new Date(),
                regressedFrom: existing.status,
                severity: insight.severity,
                reason: insight.reason,
                value: insight.value || null,
                baseline: insight.baseline || null,
                percentageChange: insight.percentageChange || null,
                confidence: insight.confidence || null,
                zScore: insight.zScore || null,
                pValue: insight.pValue || null,
                confidenceMetadata,
                baselineType,
                baselineWindowDays,
                context,
                comparison,
                lastSeenAt: insight.detectedAt,
              })
              .where(eq(detectedInsights.id, existing.id));
          } else {
            const newStatus =
              existing.status === 'new'
                ? InsightStatus.ACTIVE
                : existing.status;

            await tx
              .update(detectedInsights)
              .set({
                status: newStatus,
                severity: insight.severity,
                reason: insight.reason,
                value: insight.value || null,
                baseline: insight.baseline || null,
                percentageChange: insight.percentageChange || null,
                confidence: insight.confidence || null,
                zScore: insight.zScore || null,
                pValue: insight.pValue || null,
                confidenceMetadata,
                baselineType,
                baselineWindowDays,
                context,
                comparison,
                lastSeenAt: insight.detectedAt,
              })
              .where(eq(detectedInsights.id, existing.id));
          }
        } else {
          const row: NewDetectedInsightRow = {
            projectId: insight.projectId,
            componentId: insight.componentId || null,
            elementId: insight.elementId || null,
            flag: insight.flag,
            severity: insight.severity,
            reason: insight.reason,
            value: insight.value || null,
            baseline: insight.baseline || null,
            percentageChange: insight.percentageChange || null,
            confidence: insight.confidence || null,
            zScore: insight.zScore || null,
            pValue: insight.pValue || null,
            confidenceMetadata,
            baselineType,
            baselineWindowDays,
            context,
            comparison,
            status: InsightStatus.NEW,
            firstDetectedAt: insight.detectedAt,
            lastSeenAt: insight.detectedAt,
          };

          await tx.insert(detectedInsights).values(row);
        }
      }
    });
  }

  private async findActiveInsightInTx(
    tx: NodePgDatabase,
    projectId: string,
    flag: string,
    componentId?: string,
    elementId?: string,
  ): Promise<DetectedInsightRow | null> {
    const [row] = await tx
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          eq(detectedInsights.flag, flag),
          componentId
            ? eq(detectedInsights.componentId, componentId)
            : isNull(detectedInsights.componentId),
          elementId
            ? eq(detectedInsights.elementId, elementId)
            : isNull(detectedInsights.elementId),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt))
      .limit(1);

    return row ?? null;
  }

  async resolveStaleInsights(
    projectId: string,
    activeFlags: Set<string>,
  ): Promise<void> {
    const activeStatuses = [
      InsightStatus.NEW,
      InsightStatus.ACTIVE,
      InsightStatus.ACKNOWLEDGED,
      InsightStatus.ACTED_UPON,
      InsightStatus.REGRESSED,
    ];

    const activeInsights = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          inArray(detectedInsights.status, activeStatuses),
        ),
      );

    for (const insight of activeInsights) {
      const key = this.createInsightKey(
        insight.flag,
        insight.componentId,
        insight.elementId,
      );

      if (!activeFlags.has(key)) {
        await this.db
          .update(detectedInsights)
          .set({
            status: InsightStatus.RESOLVED,
            resolvedAt: new Date(),
          })
          .where(eq(detectedInsights.id, insight.id));
      }
    }
  }

  async acknowledgeInsight(insightId: string, userId: string): Promise<void> {
    await this.db
      .update(detectedInsights)
      .set({
        status: InsightStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      })
      .where(eq(detectedInsights.id, insightId));
  }

  async markActedUpon(
    insightId: string,
    userId: string,
    actionTaken: string,
  ): Promise<void> {
    await this.db
      .update(detectedInsights)
      .set({
        status: InsightStatus.ACTED_UPON,
        actedUponAt: new Date(),
        actedUponBy: userId,
        actionTaken,
      })
      .where(eq(detectedInsights.id, insightId));
  }

  async resolveInsight(insightId: string, resolvedBy: string): Promise<void> {
    await this.db
      .update(detectedInsights)
      .set({
        status: InsightStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy,
      })
      .where(eq(detectedInsights.id, insightId));
  }

  async findActiveInsight(
    projectId: string,
    flag: string,
    componentId?: string,
    elementId?: string,
  ): Promise<DetectedInsightRow | null> {
    const [row] = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          eq(detectedInsights.flag, flag),
          componentId
            ? eq(detectedInsights.componentId, componentId)
            : isNull(detectedInsights.componentId),
          elementId
            ? eq(detectedInsights.elementId, elementId)
            : isNull(detectedInsights.elementId),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt))
      .limit(1);

    return row ?? null;
  }

  async getRecentInsights(
    projectId: string,
    hours: number = 24,
  ): Promise<PersistedInsight[]> {
    const cutoffDate = subtractDays(new Date(), hours / 24);

    const rows = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          gte(detectedInsights.firstDetectedAt, cutoffDate),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt));

    return rows.map(this.rowToPersistedInsight);
  }

  async getInsightsByStatus(
    projectId: string,
    statuses: InsightStatus[],
  ): Promise<PersistedInsight[]> {
    const rows = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          inArray(detectedInsights.status, statuses),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt));

    return rows.map(this.rowToPersistedInsight);
  }

  async getUnresolvedInsights(projectId: string): Promise<PersistedInsight[]> {
    const activeStatuses = [
      InsightStatus.NEW,
      InsightStatus.ACTIVE,
      InsightStatus.ACKNOWLEDGED,
      InsightStatus.ACTED_UPON,
      InsightStatus.REGRESSED,
    ];

    return this.getInsightsByStatus(projectId, activeStatuses);
  }

  async getInsightsBySeverity(
    projectId: string,
    severity: 'high' | 'medium' | 'low' | 'info',
    limit: number = 50,
  ): Promise<PersistedInsight[]> {
    const activeStatuses = [
      InsightStatus.NEW,
      InsightStatus.ACTIVE,
      InsightStatus.ACKNOWLEDGED,
      InsightStatus.ACTED_UPON,
      InsightStatus.REGRESSED,
    ];

    const rows = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          eq(detectedInsights.severity, severity),
          inArray(detectedInsights.status, activeStatuses),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt))
      .limit(limit);

    return rows.map(this.rowToPersistedInsight);
  }

  async getInsightsByComponent(
    projectId: string,
    componentId: string,
    limit: number = 50,
  ): Promise<PersistedInsight[]> {
    const rows = await this.db
      .select()
      .from(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          eq(detectedInsights.componentId, componentId),
        ),
      )
      .orderBy(desc(detectedInsights.firstDetectedAt))
      .limit(limit);

    return rows.map(this.rowToPersistedInsight);
  }

  async getInsightById(insightId: string): Promise<PersistedInsight | null> {
    const [row] = await this.db
      .select()
      .from(detectedInsights)
      .where(eq(detectedInsights.id, insightId))
      .limit(1);

    return row ? this.rowToPersistedInsight(row) : null;
  }

  async deleteOldInsights(
    projectId: string,
    olderThanDays: number,
  ): Promise<number> {
    const cutoffDate = subtractDays(new Date(), olderThanDays);

    const result = await this.db
      .delete(detectedInsights)
      .where(
        and(
          eq(detectedInsights.projectId, projectId),
          lte(detectedInsights.firstDetectedAt, cutoffDate),
          eq(detectedInsights.status, InsightStatus.RESOLVED),
        ),
      );

    return (result as { rowCount?: number }).rowCount || 0;
  }

  private createInsightKey(
    flag: string,
    componentId?: string | null,
    elementId?: string | null,
  ): string {
    return `${flag}:${componentId || 'null'}:${elementId || 'null'}`;
  }

  private rowToPersistedInsight(row: DetectedInsightRow): PersistedInsight {
    return {
      id: row.id,
      flag: row.flag as InsightFlag,
      severity: row.severity as InsightSeverity,
      status: row.status as InsightStatus,
      projectId: row.projectId,
      componentId: row.componentId || undefined,
      elementId: row.elementId || undefined,
      reason: row.reason,
      value: row.value || undefined,
      baseline: row.baseline || undefined,
      percentageChange: row.percentageChange || undefined,
      detectedAt: row.firstDetectedAt,
      firstDetectedAt: row.firstDetectedAt,
      lastSeenAt: row.lastSeenAt,
      confidence: row.confidence || undefined,
      confidenceMetadata: row.confidenceMetadata || undefined,
      zScore: row.zScore || undefined,
      pValue: row.pValue || undefined,
      baselineType: (row.baselineType as BaselineType) || undefined,
      baselineWindowDays: row.baselineWindowDays || undefined,
      context: row.context || undefined,
      comparison: row.comparison || undefined,
    };
  }
}
