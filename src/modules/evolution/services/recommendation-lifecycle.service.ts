// src/modules/evolution/services/recommendation-lifecycle.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';
import { RecommendationStateMachineService } from './recommendation-state-machine.service';
import { DomainError } from 'src/common/exceptions/domain-error';
import {
  RecommendationInstanceMetadata,
  RecommendationInstanceStatus,
} from '../domain/recommendation-instance.types';
import { StoredRecommendationSnapshot } from '../domain/recommendation-instance.types';

@Injectable()
export class RecommendationLifecycleService {
  private readonly logger = new Logger(RecommendationLifecycleService.name);

  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly jobsRepo: EvolutionJobsRepository,
    private readonly stateMachine: RecommendationStateMachineService,
  ) {}

  async createInstance(
    projectId: string,
    recommendationHash: string,
    snapshotId: string,
    recommendationSnapshot: StoredRecommendationSnapshot,
    metadata: RecommendationInstanceMetadata,
  ): Promise<string> {
    const existing = await this.instancesRepo.getByHash(
      projectId,
      recommendationHash,
    );

    if (
      existing &&
      existing.status !== 'rejected' &&
      existing.status !== 'expired'
    ) {
      this.logger.debug(
        `Instance already exists for ${recommendationHash} with status ${existing.status}`,
      );
      return existing.id;
    }

    const instance = await this.instancesRepo.create({
      projectId,
      recommendationHash,
      snapshotId,
      recommendationSnapshot,
      status: 'new',
      metadata,
    });

    this.logger.debug(`Created recommendation instance ${instance.id}`);
    return instance.id;
  }

  async acceptRecommendation(instanceId: string): Promise<void> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    this.stateMachine.assertValidTransition(
      instance.status as RecommendationInstanceStatus,
      'accepted',
    );

    await this.instancesRepo.updateStatus(instanceId, 'accepted', {
      acceptedAt: new Date(),
    });

    await this.jobsRepo.create({
      projectId: instance.projectId,
      instanceId,
      jobType: 'generate_patch',
      status: 'pending',
      maxRetries: 3,
    });

    this.logger.log(`Accepted recommendation ${instanceId}`);
  }

  async rejectRecommendation(instanceId: string): Promise<void> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    this.stateMachine.assertValidTransition(
      instance.status as RecommendationInstanceStatus,
      'rejected',
    );

    await this.instancesRepo.updateStatus(instanceId, 'rejected', {
      rejectedAt: new Date(),
    });

    this.logger.log(`Rejected recommendation ${instanceId}`);
  }

  async getActiveRecommendations(projectId: string): Promise<number> {
    const instances = await this.instancesRepo.getActiveForProject(projectId);
    return instances.length;
  }
}
