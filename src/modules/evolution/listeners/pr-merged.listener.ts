// src/modules/evolution/listeners/pr-merged.listener.ts

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';

interface PRMergedEvent {
  prNumber: string;
  mergeCommitSha: string;
}

@Injectable()
export class PRMergedListener {
  private readonly logger = new Logger(PRMergedListener.name);

  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly jobsRepo: EvolutionJobsRepository,
  ) {}

  @OnEvent('github.pr_merged')
  async handlePRMerged(event: PRMergedEvent): Promise<void> {
    try {
      const instances = await this.instancesRepo.getByPRNumber(event.prNumber);

      if (!instances || instances.length === 0) {
        this.logger.warn(
          `No recommendation instances found for PR #${event.prNumber}`,
        );
        return;
      }

      for (const instance of instances) {
        const evaluationWindowDays =
          instance.metadata.evaluationWindowDays || 7;
        const evaluationWindowEndsAt = new Date();
        evaluationWindowEndsAt.setDate(
          evaluationWindowEndsAt.getDate() + evaluationWindowDays,
        );

        await this.instancesRepo.updateStatus(instance.id, 'merged', {
          mergedAt: new Date(),
          commitSha: event.mergeCommitSha,
          evaluationWindowEndsAt,
        });

        await this.jobsRepo.create({
          projectId: instance.projectId,
          instanceId: instance.id,
          jobType: 'evaluate_impact',
          status: 'pending',
          maxRetries: 3,
        });

        this.logger.log(
          `Updated instance ${instance.id} to merged status and enqueued impact evaluation`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle PR merged event: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}