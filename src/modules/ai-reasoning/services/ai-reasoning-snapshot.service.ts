// src/modules/ai-reasoning/services/ai-reasoning-snapshot.service.ts

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InsightsRepository } from 'src/modules/insights/repositories/insights.repository';
import { InsightStatus } from 'src/modules/insights/domain/insight-status.enum';

@Injectable()
export class AIReasoningSnapshotService {
  constructor(
    private readonly insightsRepository: InsightsRepository,
  ) {}

  async generateInsightSnapshot(projectId: string): Promise<string> {
    const unresolved = await this.insightsRepository.getInsightsByStatus(
      projectId,
      [
        InsightStatus.NEW,
        InsightStatus.ACTIVE,
        InsightStatus.ACKNOWLEDGED,
        InsightStatus.ACTED_UPON,
        InsightStatus.REGRESSED,
      ],
    );

    if (unresolved.length === 0) {
      return this.hashString('empty');
    }

    const snapshotData = unresolved
      .map((insight) => `${insight.id}|${insight.severity}|${insight.value || 0}`)
      .sort()
      .join('::');

    return this.hashString(snapshotData);
  }

  private hashString(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 32);
  }
}