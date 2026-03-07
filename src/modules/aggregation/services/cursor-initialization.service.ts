// src/modules/aggregation/services/cursor-initialization.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AggregationCursorRepository } from '../repositories/aggregation-cursor.repository';

@Injectable()
export class CursorInitializationService {
  private readonly logger = new Logger(CursorInitializationService.name);

  private readonly PIPELINES = [
    'hourly_page_metrics',
    'hourly_component_metrics',
    'hourly_element_metrics',
    'hourly_session_metrics',
    'daily_page_metrics',
    'daily_session_metrics',
    'daily_component_metrics',
    'daily_element_metrics',
    'daily_performance_metrics',
    'daily_form_metrics',
    'daily_behavioral_metrics',
    'daily_funnel_metrics',
  ];

  constructor(private readonly cursorRepo: AggregationCursorRepository) {}

  async initializeProjectCursors(
    projectId: string,
    tx?: NodePgDatabase,
  ): Promise<void> {
    try {
      for (const pipeline of this.PIPELINES) {
        await this.cursorRepo.initializeCursor(projectId, pipeline, tx);
      }
      this.logger.log(`✅ Initialized cursors for project ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize cursors for project ${projectId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
