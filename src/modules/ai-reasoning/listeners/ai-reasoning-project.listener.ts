// src/modules/ai-reasoning/listeners/ai-reasoning-project.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from 'src/modules/projects/events/project-created.event';
import { AIReasoningCursorInitializationService } from '../services/ai-reasoning-cursor-initialization.service';

@Injectable()
export class AIReasoningProjectListener {
  constructor(
    private readonly cursorInit: AIReasoningCursorInitializationService,
  ) {}

  @OnEvent('project.created')
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    await this.cursorInit.initializeProjectCursor(event.projectId);
  }
}