// src/modules/evolution/listeners/evolution-project.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from 'src/modules/projects/events/project-created.event';
import { EvolutionCursorInitializationService } from '../services/evolution-cursor-initialization.service';

@Injectable()
export class EvolutionProjectListener {
  constructor(
    private readonly cursorInit: EvolutionCursorInitializationService,
  ) {}

  @OnEvent('project.created')
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    await this.cursorInit.initializeProjectCursors(event.projectId);
  }
}