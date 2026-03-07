// src/modules/funnels/services/funnels.service.ts

import { Injectable } from '@nestjs/common';
import { FunnelsRepository } from '../funnels.repository';
import { CreateFunnelDto } from '../dto/create-funnel.dto';
import { UpdateFunnelDto } from '../dto/update-funnel.dto';
import { DomainError } from 'src/common/exceptions/domain-error';

export interface FunnelDefinitionModel {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  steps: Array<{
    index: number;
    name: string;
    paths: string[];
    timeoutMinutes?: number;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FunnelsService {
  constructor(
    private readonly repo: FunnelsRepository,
  ) {}

  async create(
    projectId: string,
    dto: CreateFunnelDto
  ): Promise<FunnelDefinitionModel> {
    const sortedSteps = [...dto.steps].sort((a, b) => a.index - b.index);
    
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].index !== i + 1) {
        throw new DomainError(
          'INVALID_STEP_INDICES',
          'Step indices must be sequential starting from 1',
          'validation',
          { steps: dto.steps }
        );
      }
    }

    if (sortedSteps.length < 2) {
      throw new DomainError(
        'INSUFFICIENT_STEPS',
        'Funnel must have at least 2 steps',
        'validation',
        { stepCount: sortedSteps.length }
      );
    }

    const created = await this.repo.create({
      projectId,
      name: dto.name,
      description: dto.description,
      steps: sortedSteps,
      isActive: true,
    });

    return this.toModel(created);
  }

  async list(projectId: string): Promise<FunnelDefinitionModel[]> {
    const rows = await this.repo.findByProjectId(projectId);
    return rows.map(row => this.toModel(row));
  }

  async getById(id: string): Promise<FunnelDefinitionModel> {
    const row = await this.repo.findById(id);
    
    if (!row) {
      throw new DomainError(
        'FUNNEL_NOT_FOUND',
        'Funnel definition not found',
        'not_found',
        { id }
      );
    }

    return this.toModel(row);
  }

  async update(
    id: string,
    dto: UpdateFunnelDto
  ): Promise<FunnelDefinitionModel> {
    const existing = await this.repo.findById(id);
    
    if (!existing) {
      throw new DomainError(
        'FUNNEL_NOT_FOUND',
        'Funnel definition not found',
        'not_found',
        { id }
      );
    }

    if (dto.steps) {
      const sortedSteps = [...dto.steps].sort((a, b) => a.index - b.index);
      
      for (let i = 0; i < sortedSteps.length; i++) {
        if (sortedSteps[i].index !== i + 1) {
          throw new DomainError(
            'INVALID_STEP_INDICES',
            'Step indices must be sequential starting from 1',
            'validation',
            { steps: dto.steps }
          );
        }
      }
    }

    const updated = await this.repo.update(id, dto);
    return this.toModel(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    
    if (!existing) {
      throw new DomainError(
        'FUNNEL_NOT_FOUND',
        'Funnel definition not found',
        'not_found',
        { id }
      );
    }

    await this.repo.delete(id);
  }

  private toModel(row: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    steps: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FunnelDefinitionModel {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description || undefined,
      steps: row.steps as FunnelDefinitionModel['steps'],
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}