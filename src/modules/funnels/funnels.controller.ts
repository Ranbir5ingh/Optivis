// src/modules/funnels/funnels.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/modules/auth/domain/auth-user.model';
import { FunnelsService } from './services/funnels.service';
import { CreateFunnelDto } from './dto/create-funnel.dto';
import { UpdateFunnelDto } from './dto/update-funnel.dto';
import { FunnelsPolicy } from './policies/funnels.policy';
import { ApiSuccessResponse } from 'src/shared/types/api-response';

@Controller('v1/projects/:projectId/funnels')
@UseGuards(JwtAccessGuard)
export class FunnelsController {
  constructor(
    private readonly funnelsService: FunnelsService,
    private readonly funnelsPolicy: FunnelsPolicy,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateFunnelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<any>> {
    await this.funnelsPolicy.assertCanManageFunnels(user.userId, projectId);
    const funnel = await this.funnelsService.create(projectId, dto);
    return { status: 'success', data: funnel };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<any>> {
    await this.funnelsPolicy.assertCanViewProject(user.userId, projectId);
    const funnels = await this.funnelsService.list(projectId);
    return { status: 'success', data: { funnels } };
  }

  @Get(':funnelId')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('funnelId', ParseUUIDPipe) funnelId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<any>> {
    await this.funnelsPolicy.assertCanViewProject(user.userId, projectId);
    const funnel = await this.funnelsService.getById(funnelId);
    return { status: 'success', data: funnel };
  }

  @Put(':funnelId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('funnelId', ParseUUIDPipe) funnelId: string,
    @Body() dto: UpdateFunnelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<any>> {
    await this.funnelsPolicy.assertCanManageFunnels(user.userId, projectId);
    const funnel = await this.funnelsService.update(funnelId, dto);
    return { status: 'success', data: funnel };
  }

  @Delete(':funnelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('funnelId', ParseUUIDPipe) funnelId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.funnelsPolicy.assertCanManageFunnels(user.userId, projectId);
    await this.funnelsService.delete(funnelId);
  }
}