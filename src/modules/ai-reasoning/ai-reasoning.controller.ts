// src/modules/ai-reasoning/ai-reasoning.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/modules/auth/domain/auth-user.model';

import { AIReasoningService } from './services/ai-reasoning.service';
import { ProjectsService } from '../projects/services/projects.service';
import { OrganizationPolicy } from '../organizations/policies/organization.policy';

import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { AIReasoningResult } from './domain/recommendation.types';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

@Controller('v1/ai-reasoning')
@UseGuards(JwtAccessGuard)
export class AIReasoningController {
  constructor(
    private readonly aiReasoning: AIReasoningService,
    private readonly projectsService: ProjectsService,
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  @Post('projects/:projectId/generate')
  @HttpCode(HttpStatus.OK)
  async generateRecommendations(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: GenerateRecommendationsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<AIReasoningResult>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const result = await this.aiReasoning.generateRecommendations(projectId, {
      maxInsights: query.maxInsights,
      maxComponents: query.maxComponents,
      severityFilter: query.severityFilter,
      commitSha: query.commitSha,
      saveToDatabase: true,
    });

    return {
      status: 'success',
      data: result,
    };
  }

  @Get('projects/:projectId/latest')
  @HttpCode(HttpStatus.OK)
  async getLatestRecommendations(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<AIReasoningResult | null>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const result = await this.aiReasoning.getLatestRecommendations(projectId);

    return {
      status: 'success',
      data: result,
    };
  }

  @Get('projects/:projectId/history')
  @HttpCode(HttpStatus.OK)
  async getRecommendationHistory(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<AIReasoningResult[]>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const results = await this.aiReasoning.getRecommendationHistory(
      projectId,
      10,
    );

    return {
      status: 'success',
      data: results,
    };
  }

  @Get('projects/:projectId/status')
  @HttpCode(HttpStatus.OK)
  async getRecommendationStatus(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<
    ApiSuccessResponse<{
      lastGeneratedAt: Date | null;
      jobStatus: string | null;
      triggerType: string | null;
      insightSnapshotHash: string | null;
    }>
  > {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const status = await this.aiReasoning.getRecommendationStatus(projectId);

    return {
      status: 'success',
      data: status,
    };
  }
}
