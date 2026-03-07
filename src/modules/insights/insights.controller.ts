// src/modules/insights/insights.controller.ts

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Body,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/modules/auth/domain/auth-user.model';

import { InsightEngineService } from './engine/insight-engine.service';
import { InsightMapperService } from './engine/insight-mapper.service';
import { FunnelInsightsService } from './services/funnel-insights.service';
import { InsightsRepository } from './repositories/insights.repository';
import { OrganizationPolicy } from '../organizations/policies/organization.policy';
import { ProjectsService } from '../projects/services/projects.service';

import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { InsightsFilterDto } from './dto/insights-filter.dto';
import { InsightsResponseDto } from './dto/response/insights.response.dto';
import { FunnelAnalysisResponse } from './services/funnel-insights.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { TriggerInsightsDto } from './dto/trigger-insights.dto';

@Controller('v1/insights')
@UseGuards(JwtAccessGuard)
export class InsightsController {
  constructor(
    private readonly insightEngine: InsightEngineService,
    private readonly insightMapper: InsightMapperService,
    private readonly insightsRepo: InsightsRepository,
    private readonly funnelInsights: FunnelInsightsService,
    private readonly projectsService: ProjectsService,
    private readonly orgPolicy: OrganizationPolicy,
  ) {}

  @Get('projects/:projectId')
  @HttpCode(HttpStatus.OK)
  async getInsights(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() filter: InsightsFilterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<InsightsResponseDto>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const persistedInsights =
      await this.insightsRepo.getUnresolvedInsights(projectId);

    const mappedInsights = persistedInsights.map((insight) =>
      this.insightMapper.mapToDto(insight),
    );

    const critical = mappedInsights.filter((i) => i.severity === 'high').length;
    const warnings = mappedInsights.filter(
      (i) => i.severity === 'medium',
    ).length;

    return {
      status: 'success',
      data: {
        insights: mappedInsights,
        summary: {
          total: mappedInsights.length,
          critical,
          warnings,
        },
      },
    };
  }

  @Get('projects/:projectId/active')
  @HttpCode(HttpStatus.OK)
  async getActiveInsights(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<InsightsResponseDto>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const detectedInsights =
      await this.insightsRepo.getUnresolvedInsights(projectId);

    const mappedInsights = detectedInsights.map((insight) =>
      this.insightMapper.mapToDto(insight),
    );

    const critical = mappedInsights.filter((i) => i.severity === 'high').length;
    const warnings = mappedInsights.filter(
      (i) => i.severity === 'medium',
    ).length;

    return {
      status: 'success',
      data: {
        insights: mappedInsights,
        summary: {
          total: mappedInsights.length,
          critical,
          warnings,
        },
      },
    };
  }

  @Get('projects/:projectId/funnels/:funnelId/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeFunnel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('funnelId', ParseUUIDPipe) funnelId: string,
    @Query() filter: AnalyticsFilterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<FunnelAnalysisResponse>> {
    const project = await this.projectsService.getByIdOrThrow(projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const startDate = new Date(filter.startDate);
    const endDate = new Date(filter.endDate);

    const analysis = await this.funnelInsights.analyzeFunnel(
      projectId,
      funnelId,
      startDate,
      endDate,
    );

    return {
      status: 'success',
      data: analysis,
    };
  }

  @Post('trigger')
  @HttpCode(HttpStatus.NO_CONTENT)
  async triggerAnalysis(
    @Body() dto: TriggerInsightsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const project = await this.projectsService.getByIdOrThrow(dto.projectId);
    await this.orgPolicy.assertMember(project.organizationId, user.userId);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await this.insightEngine.analyzeProject(
      dto.projectId,
      yesterday,
      new Date(),
    );
  }
}
