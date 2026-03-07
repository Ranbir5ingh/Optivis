// src/modules/projects/services/project-settings.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { projectSettings } from 'src/database/drizzle/schema';
import { eq } from 'drizzle-orm';
import { DomainError } from 'src/common/exceptions/domain-error';

export interface ProjectSettingsModel {
  projectId: string;
  sessionSampleRate: number;
  rawEventsRetentionDays: number;
  sessionMetricsRetentionDays: number;
  hourlySummariesRetentionDays: number;
  enableAutoAggregation: boolean;
  enableInsights: boolean;
}

export class UpdateProjectSettingsDto {
  sessionSampleRate?: number;
  rawEventsRetentionDays?: number;
  sessionMetricsRetentionDays?: number;
  hourlySummariesRetentionDays?: number;
  enableAutoAggregation?: boolean;
  enableInsights?: boolean;
}

@Injectable()
export class ProjectSettingsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getSettings(projectId: string): Promise<ProjectSettingsModel> {
    const [row] = await this.db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId))
      .limit(1);

    if (!row) {
      throw new DomainError(
        'SETTINGS_NOT_FOUND',
        'Project settings not found',
        'not_found',
        { projectId },
      );
    }

    return this.toModel(row);
  }

  async updateSettings(
    projectId: string,
    updates: UpdateProjectSettingsDto,
  ): Promise<ProjectSettingsModel> {
    const [updated] = await this.db
      .update(projectSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(projectSettings.projectId, projectId))
      .returning();

    if (!updated) {
      throw new DomainError(
        'SETTINGS_NOT_FOUND',
        'Project settings not found',
        'not_found',
        { projectId },
      );
    }

    return this.toModel(updated);
  }

  private toModel(row: typeof projectSettings.$inferSelect): ProjectSettingsModel {
    return {
      projectId: row.projectId,
      sessionSampleRate: row.sessionSampleRate,
      rawEventsRetentionDays: row.rawEventsRetentionDays,
      sessionMetricsRetentionDays: row.sessionMetricsRetentionDays,
      hourlySummariesRetentionDays: row.hourlySummariesRetentionDays,
      enableAutoAggregation: row.enableAutoAggregation,
      enableInsights: row.enableInsights,
    };
  }
}