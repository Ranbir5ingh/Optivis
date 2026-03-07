// src/modules/project-summary/controllers/project-summary.controller.ts

import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ProjectSummaryService } from './services/project-summary.service';
import { ProjectsService } from '../projects/services/projects.service';
import { OrganizationPolicy } from '../organizations/policies/organization.policy';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/domain/auth-user.model';
import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { ProjectSummaryModel } from './domain/project-summary.model';

@Controller('v1/projects/:projectId/summary')
@UseGuards(JwtAccessGuard)
export class ProjectSummaryController {
  constructor(
    private readonly projectSummaryService: ProjectSummaryService,
    private readonly projectsService: ProjectsService,
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getSummary(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<ProjectSummaryModel>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const summary = await this.projectSummaryService.getSummary(projectId);

    return {
      status: 'success',
      data: {
        projectId: summary.projectId,
        projectName: summary.projectName,
        recommendationsActive: summary.recommendationsActive,
        healthScore: summary.healthScore,
        healthState: summary.healthState,
      },
    };
  }
}
