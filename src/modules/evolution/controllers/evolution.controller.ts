// src/modules/evolution/controllers/evolution.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/modules/auth/domain/auth-user.model';
import { RecommendationLifecycleService } from '../services/recommendation-lifecycle.service';
import { RecommendationInstancesService } from '../services/recommendation-instances.service';
import { ProjectsService } from 'src/modules/projects/services/projects.service';
import { OrganizationPolicy } from 'src/modules/organizations/policies/organization.policy';
import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { PaginatedResult } from 'src/shared/types/pagination';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { RecommendationInstance } from '../domain/recommendation-instance.types';

@Controller('v1/evolution')
@UseGuards(JwtAccessGuard)
export class EvolutionController {
  constructor(
    private readonly lifecycleService: RecommendationLifecycleService,
    private readonly instancesService: RecommendationInstancesService,
    private readonly projectsService: ProjectsService,
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  @Post('instances/:instanceId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptRecommendation(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ instanceId: string; status: string }>> {
    await this.lifecycleService.acceptRecommendation(instanceId);

    return {
      status: 'success',
      data: {
        instanceId,
        status: 'accepted',
      },
    };
  }

  @Post('instances/:instanceId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectRecommendation(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ instanceId: string; status: string }>> {
    await this.lifecycleService.rejectRecommendation(instanceId);

    return {
      status: 'success',
      data: {
        instanceId,
        status: 'rejected',
      },
    };
  }

  @Get('projects/:projectId/instances')
  @HttpCode(HttpStatus.OK)
  async getProjectRecommendations(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<PaginatedResult<RecommendationInstance>>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const result = await this.instancesService.getProjectRecommendations(
      projectId,
      pagination.page,
      pagination.limit,
    );

    return {
      status: 'success',
      data: result,
    };
  }

  @Get('projects/:projectId/instances/active')
  @HttpCode(HttpStatus.OK)
  async getActiveRecommendations(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<RecommendationInstance[]>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const instances =
      await this.instancesService.getActiveRecommendations(projectId);

    return {
      status: 'success',
      data: instances,
    };
  }

  @Get('projects/:projectId/instances/:instanceId')
  @HttpCode(HttpStatus.OK)
  async getRecommendationInstance(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<RecommendationInstance>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const instance =
      await this.instancesService.getRecommendationById(instanceId);

    return {
      status: 'success',
      data: instance,
    };
  }

  @Get('projects/:projectId/active-count')
  @HttpCode(HttpStatus.OK)
  async getActiveRecommendationsCount(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ count: number }>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const count =
      await this.instancesService.getActiveRecommendationsCount(projectId);

    return {
      status: 'success',
      data: { count },
    };
  }
}
