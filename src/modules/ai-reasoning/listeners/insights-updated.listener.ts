// src/modules/ai-reasoning/listeners/insights-updated.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InsightsUpdatedEvent } from 'src/modules/insights/events/insights-updated.event';
import { AIReasoningService } from '../services/ai-reasoning.service';

@Injectable()
export class InsightsUpdatedListener {
  constructor(private readonly aiReasoningService: AIReasoningService) {}

  @OnEvent('insights.updated')
  async handleInsightsUpdated(event: InsightsUpdatedEvent): Promise<void> {
    if (event.highSeverityInsights > 0) {
      await this.aiReasoningService.enqueueRecommendationJob(
        event.projectId,
        'auto_insight',
      );
    }
  }
}