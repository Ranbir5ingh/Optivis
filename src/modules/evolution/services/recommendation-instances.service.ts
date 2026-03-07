// src/modules/evolution/services/recommendation-instances.service.ts

import { Injectable } from '@nestjs/common';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { DomainError } from 'src/common/exceptions/domain-error';
import { PaginatedResult } from 'src/shared/types/pagination';
import { RecommendationInstance } from '../domain/recommendation-instance.types';

@Injectable()
export class RecommendationInstancesService {
  constructor(
    private readonly instancesRepo: RecommendationInstancesRepository,
  ) {}

  async getProjectRecommendations(
    projectId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<RecommendationInstance>> {
    const offset = (page - 1) * limit;

    const [instances, total] = await Promise.all([
      this.instancesRepo.findByProjectId(projectId, limit, offset),
      this.instancesRepo.countByProjectId(projectId),
    ]);

    return {
      items: instances,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getActiveRecommendations(
    projectId: string,
  ): Promise<RecommendationInstance[]> {
    return this.instancesRepo.getActiveForProject(projectId);
  }

  async getRecommendationById(
    instanceId: string,
  ): Promise<RecommendationInstance> {
    const instance = await this.instancesRepo.getById(instanceId);

    if (!instance) {
      throw new DomainError(
        'INSTANCE_NOT_FOUND',
        'Recommendation instance not found',
        'not_found',
      );
    }

    return instance;
  }

  async getActiveRecommendationsCount(projectId: string): Promise<number> {
    const instances = await this.instancesRepo.getActiveForProject(projectId);
    return instances.length;
  }
}