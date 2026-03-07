// src/modules/insights/events/insights-updated.event.ts

/**
 * Domain Event: Insights Updated
 * 
 * Emitted when insights are detected and persisted for a project.
 * Allows decoupled modules (like AI Reasoning) to react to insight changes
 * without creating circular module dependencies.
 * 
 * @example
 * this.eventEmitter.emit('insights.updated', new InsightsUpdatedEvent(projectId, highSeverityCount));
 */
export class InsightsUpdatedEvent {
  constructor(
    public readonly projectId: string,
    public readonly highSeverityInsights: number,
  ) {}
}