import { Inject, Injectable } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  funnelDefinitions,
  FunnelDefinitionRow,
  NewFunnelDefinitionRow,
  FunnelMetricsRow,
  funnelMetrics,
} from 'src/database/drizzle/schema';

@Injectable()
export class FunnelsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async create(data: NewFunnelDefinitionRow): Promise<FunnelDefinitionRow> {
    const [created] = await this.db
      .insert(funnelDefinitions)
      .values(data)
      .returning();
    return created;
  }

  async findById(id: string): Promise<FunnelDefinitionRow | null> {
    const [row] = await this.db
      .select()
      .from(funnelDefinitions)
      .where(eq(funnelDefinitions.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByProjectId(projectId: string): Promise<FunnelDefinitionRow[]> {
    return this.db
      .select()
      .from(funnelDefinitions)
      .where(
        and(
          eq(funnelDefinitions.projectId, projectId),
          eq(funnelDefinitions.isActive, true),
        ),
      );
  }

  async findByProjectAndName(
  projectId: string,
  funnelName: string,
): Promise<FunnelDefinitionRow | null> {
  const [row] = await this.db
    .select()
    .from(funnelDefinitions)
    .where(
      and(
        eq(funnelDefinitions.projectId, projectId),
        eq(funnelDefinitions.name, funnelName),
        eq(funnelDefinitions.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

  async getAllFunnelMetrics(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FunnelMetricsRow[]> {
    return this.db
      .select()
      .from(funnelMetrics)
      .where(
        and(
          eq(funnelMetrics.projectId, projectId),
          gte(funnelMetrics.date, startDate),
          lte(funnelMetrics.date, endDate),
        ),
      )
      .orderBy(funnelMetrics.funnelName, funnelMetrics.stepIndex);
  }

  async getFunnelMetrics(
    projectId: string,
    funnelName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FunnelMetricsRow[]> {
    return this.db
      .select()
      .from(funnelMetrics)
      .where(
        and(
          eq(funnelMetrics.projectId, projectId),
          eq(funnelMetrics.funnelName, funnelName),
          gte(funnelMetrics.date, startDate),
          lte(funnelMetrics.date, endDate),
        ),
      )
      .orderBy(funnelMetrics.stepIndex);
  }

  async update(
    id: string,
    data: Partial<NewFunnelDefinitionRow>,
  ): Promise<FunnelDefinitionRow> {
    const [updated] = await this.db
      .update(funnelDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(funnelDefinitions.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(funnelDefinitions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(funnelDefinitions.id, id));
  }
}
