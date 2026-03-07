import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/modules/auth/guards/jwt-access.guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/modules/auth/domain/auth-user.model';

import { DailyComponentAggregatorService } from './aggregators/daily-component-aggregator.service';
import { DailyElementAggregatorService } from './aggregators/daily-element-aggregator.service';
import { DailyFunnelAggregatorService } from './aggregators/daily-funnel-aggregator.service';
import { DailyPerformanceAggregatorService } from './aggregators/daily-performance-aggregator.service';
import { DailyFormAggregatorService } from './aggregators/daily-form-aggregator.service';
import { DailyPageAggregatorService } from './aggregators/daily-page-aggregator.service';
import { DailySessionAggregatorService } from './aggregators/daily-session-aggregator.service';

import { ApiSuccessResponse } from 'src/shared/types/api-response';
import { IsString, IsDateString } from 'class-validator';
import { HourlyPageAggregatorService } from './aggregators/hourly-page-aggregator.service';
import { HourlyComponentAggregatorService } from './aggregators/hourly-component-aggregator.service';
import { HourlyElementAggregatorService } from './aggregators/hourly-element-aggregator.service';
import { HourlySessionAggregatorService } from './aggregators/hourly-session-aggregator.service';
import { DailyBehavioralAggregatorService } from './aggregators/daily-behavioral-aggregator.service';

class TriggerAggregationDto {
  @IsString()
  projectId: string;

  @IsDateString()
  date: string; // ISO 8601 date
}

// src/modules/aggregation/aggregation.controller.ts

@Controller('v1/aggregation')
@UseGuards(JwtAccessGuard)
export class AggregationController {
  constructor(
    private readonly hourlyPage: HourlyPageAggregatorService,
    private readonly hourlyComponent: HourlyComponentAggregatorService,
    private readonly hourlyElement: HourlyElementAggregatorService,
    private readonly hourlySession: HourlySessionAggregatorService,

    private readonly dailyPerformance: DailyPerformanceAggregatorService,
    private readonly dailyForm: DailyFormAggregatorService,
    private readonly dailyPage: DailyPageAggregatorService,
    private readonly dailySession: DailySessionAggregatorService,
    private readonly dailyComponent: DailyComponentAggregatorService,
    private readonly dailyElement: DailyElementAggregatorService,
    private readonly dailyFunnel: DailyFunnelAggregatorService,
    private readonly dailyBehavioral: DailyBehavioralAggregatorService,
  ) {}

  @Post('hourly/page')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hourlyPageAgg(@Body() dto: TriggerAggregationDto) {
    await this.hourlyPage.aggregateHour(dto.projectId, new Date(dto.date));
  }

  @Post('hourly/component')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hourlyComponentAgg(@Body() dto: TriggerAggregationDto) {
    await this.hourlyComponent.aggregateHour(dto.projectId, new Date(dto.date));
  }

  @Post('hourly/element')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hourlyElementAgg(@Body() dto: TriggerAggregationDto) {
    await this.hourlyElement.aggregateHour(dto.projectId, new Date(dto.date));
  }

  @Post('hourly/session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hourlySessionAgg(@Body() dto: TriggerAggregationDto) {
    await this.hourlySession.aggregateHour(dto.projectId, new Date(dto.date));
  }

  @Post('daily/performance')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyPerformanceAgg(@Body() dto: TriggerAggregationDto): Promise<void> {
    await this.dailyPerformance.aggregateDate(
      dto.projectId,
      new Date(dto.date),
    );
  }

  @Post('daily/form')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyFormAgg(@Body() dto: TriggerAggregationDto): Promise<void> {
    await this.dailyForm.aggregateDate(dto.projectId, new Date(dto.date));
  }

  @Post('daily/page')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyPageAgg(@Body() dto: TriggerAggregationDto) {
    await this.dailyPage.aggregateDate(dto.projectId, new Date(dto.date));
  }

  @Post('daily/session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailySessionAgg(@Body() dto: TriggerAggregationDto) {
    await this.dailySession.aggregateDate(dto.projectId, new Date(dto.date));
  }

  @Post('daily/component')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyComponentAgg(@Body() dto: TriggerAggregationDto) {
    await this.dailyComponent.aggregateDate(dto.projectId, new Date(dto.date));
  }

  @Post('daily/element')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyElementAgg(@Body() dto: TriggerAggregationDto) {
    await this.dailyElement.aggregateDate(dto.projectId, new Date(dto.date));
  }

  @Post('daily/funnel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyFunnelAgg(@Body() dto: TriggerAggregationDto) {
    await this.dailyFunnel.aggregateFunnels(dto.projectId, new Date(dto.date));
  }

  @Post('daily/behavioral')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dailyBehavioralAgg(@Body() dto: TriggerAggregationDto): Promise<void> {
    await this.dailyBehavioral.aggregateDate(dto.projectId, new Date(dto.date));
  }
}
