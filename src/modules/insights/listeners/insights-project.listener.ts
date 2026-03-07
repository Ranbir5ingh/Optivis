// src/modules/insights/listeners/insights-project.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from 'src/modules/projects/events/project-created.event';
import { InsightsCursorInitializationService } from '../services/insights-cursor-initialization.service';

@Injectable()
export class InsightsProjectListener {
  constructor(
    private readonly insightsCursorInit: InsightsCursorInitializationService,
  ) {}

  @OnEvent('project.created')
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    await this.insightsCursorInit.initializeProjectCursor(event.projectId);
  }
}