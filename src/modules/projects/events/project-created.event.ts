// src/modules/projects/events/project-created.event.ts

export class ProjectCreatedEvent {
  constructor(public readonly projectId: string) {}
}