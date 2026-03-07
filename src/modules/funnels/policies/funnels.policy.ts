// src/modules/funnels/policies/funnels.policy.ts

import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../../projects/services/projects.service';
import { OrganizationPolicy } from '../../organizations/policies/organization.policy';

@Injectable()
export class FunnelsPolicy {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  async assertCanManageFunnels(userId: string, projectId: string): Promise<void> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertOwner(project.organizationId, userId);
  }

  async assertCanViewProject(userId: string, projectId: string): Promise<void> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, userId);
  }
}