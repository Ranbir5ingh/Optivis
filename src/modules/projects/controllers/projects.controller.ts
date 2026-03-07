// src/modules/projects/controllers/projects.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { ProjectsPolicy } from '../policies/project.policy';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/domain/auth-user.model';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { ProjectModel } from '../domain/project.model';
import { PaginatedResult } from 'src/shared/types/pagination';
import { ConfigService } from '@nestjs/config';
import { ProjectKeysService } from '../../project-keys/project-keys.service';
import { SetupStatusDto } from '../dto/setup-status.dto';
import { ProjectSettingsService } from '../services/project-settings.service';
import { IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ProjectsService } from '../services/projects.service';

class UpdateProjectSettingsDto {
  @IsOptional()
  @IsNumber()
  sessionSampleRate?: number;

  @IsOptional()
  @IsNumber()
  rawEventsRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  sessionMetricsRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  hourlySummariesRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  enableAutoAggregation?: boolean;

  @IsOptional()
  @IsBoolean()
  enableInsights?: boolean;
}

@Controller('organizations/:organizationId/projects')
@UseGuards(JwtAccessGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectPolicy: ProjectsPolicy,
    private readonly projectKeys: ProjectKeysService,
    private readonly settingsService: ProjectSettingsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<ProjectModel>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    const project = await this.projectsService.create({
      ...dto,
      organizationId,
    });
    return { status: 'success', data: project };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListProjectsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<PaginatedResult<ProjectModel>>> {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const projects = await this.projectsService.list(organizationId, query);
    return { status: 'success', data: projects };
  }

  @Get(':projectId')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<ProjectModel>> {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const project = await this.projectsService.getByIdOrThrow(projectId);
    return { status: 'success', data: project };
  }

  @Patch(':projectId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<ProjectModel>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    const project = await this.projectsService.update(projectId, dto);
    return { status: 'success', data: project };
  }

  @Get(':projectId/settings')
  @HttpCode(HttpStatus.OK)
  async getSettings(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const settings = await this.settingsService.getSettings(projectId);
    return { status: 'success', data: settings };
  }

  @Patch(':projectId/settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectSettingsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    const settings = await this.settingsService.updateSettings(projectId, dto);
    return { status: 'success', data: settings };
  }

  @Get(':projectId/setup-status')
  @HttpCode(HttpStatus.OK)
  async getSetupStatus(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<SetupStatusDto>> {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const status = await this.projectsService.getSetupStatus(
      projectId,
      organizationId,
    );
    return { status: 'success', data: status };
  }

  @Get(':projectId/keys')
  @HttpCode(HttpStatus.OK)
  async getProjectKeys(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ keys: unknown[] }>> {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const keys = await this.projectKeys.listForProject(projectId);
    return { status: 'success', data: { keys } };
  }

  @Post(':projectId/keys')
  @HttpCode(HttpStatus.CREATED)
  async generateKey(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ key: unknown }>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    const key = await this.projectKeys.createForProject(projectId);
    return { status: 'success', data: { key } };
  }

  @Delete(':projectId/keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeKey(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    await this.projectKeys.revoke(keyId);
  }

  @Post(':projectId/github/connect')
  @HttpCode(HttpStatus.OK)
  async connectGithub(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<{ redirectUrl: string }>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );

    const state = this.projectsService.createGithubState({
      organizationId,
      userId: user.userId,
    });

    const appSlug = this.config.get<string>('GITHUB_APP_SLUG') || 'webruit';

    return {
      status: 'success',
      data: {
        redirectUrl: `https://github.com/apps/${appSlug}/installations/new?state=${state}`,
      },
    };
  }

  @Get(':projectId/github')
  @HttpCode(HttpStatus.OK)
  async getGithubStatus(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<
    ApiSuccessResponse<{
      connected: boolean;
      repository: {
        owner: string;
        name: string;
        defaultBranch: string;
        connectedAt: Date;
      } | null;
    }>
  > {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const connection =
      await this.projectsService.getGithubConnection(projectId);

    return {
      status: 'success',
      data: {
        connected: !!connection,
        repository: connection
          ? {
              owner: connection.repoOwner,
              name: connection.repoName,
              defaultBranch: connection.defaultBranch,
              connectedAt: connection.connectedAt,
            }
          : null,
      },
    };
  }

  @Delete(':projectId/github')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectGithub(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    await this.projectsService.disconnectGithub(projectId);
  }

  @Get(':projectId/github/installation-status')
  @HttpCode(HttpStatus.OK)
  async getGithubInstallationStatus(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<
    ApiSuccessResponse<{
      isInstallationConnected: boolean;
      hasRepositorySelected: boolean;
      repository: { owner: string; name: string; branch: string } | null;
    }>
  > {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const status = await this.projectsService.getGithubConnectionStatus(
      projectId,
      organizationId,
    );
    return { status: 'success', data: status };
  }

  @Get(':projectId/github/repositories')
  @HttpCode(HttpStatus.OK)
  async listGithubRepositories(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<
    ApiSuccessResponse<
      Array<{
        id: number;
        name: string;
        fullName: string;
        defaultBranch: string;
        private: boolean;
        htmlUrl: string;
      }>
    >
  > {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const repositories =
      await this.projectsService.listRepositories(organizationId);
    return { status: 'success', data: repositories };
  }

  @Get(':projectId/github/branches')
  @HttpCode(HttpStatus.OK)
  async listGithubBranches(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @CurrentUser() user: AuthUser,
  ): Promise<
    ApiSuccessResponse<
      Array<{
        name: string;
        isDefault: boolean;
        commitSha: string;
      }>
    >
  > {
    await this.projectPolicy.assertCanViewProject(user.userId, organizationId);
    const branches = await this.projectsService.listBranches(
      organizationId,
      owner,
      repo,
    );
    return { status: 'success', data: branches };
  }

  @Post(':projectId/github/select-repository')
  @HttpCode(HttpStatus.OK)
  async selectGithubRepository(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: { owner: string; name: string; defaultBranch: string },
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    await this.projectsService.selectRepository(projectId, organizationId, dto);
    return { status: 'success', data: null };
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Param('organizationId') organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.projectPolicy.assertCanManageProject(
      user.userId,
      organizationId,
    );
    await this.projectsService.archive(projectId);
  }
}
