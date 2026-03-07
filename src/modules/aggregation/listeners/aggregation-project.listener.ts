// src/modules/aggregation/listeners/aggregation-project.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from 'src/modules/projects/events/project-created.event';
import { CursorInitializationService } from '../services/cursor-initialization.service';

@Injectable()
export class AggregationProjectListener {
  constructor(
    private readonly cursorInit: CursorInitializationService,
  ) {}

  @OnEvent('project.created')
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    await this.cursorInit.initializeProjectCursors(event.projectId);
  }
}