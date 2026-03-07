// src/modules/tracking/tracking.controller.ts

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TrackingService } from './services/tracking.service';
import { IngestTrackingBatchDto } from './dto/ingest-batch.dto';
import { ProjectKeyGuard } from '../project-keys/guards/project-key.guard';
import { ProjectId } from '../project-keys/decorators/project-id.decorator';

@Controller('v1/track')
@UseGuards(ProjectKeyGuard)
@Throttle({ default: { limit: 1000, ttl: 60000 } })
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async ingest(
    @Body() dto: IngestTrackingBatchDto,
    @ProjectId() projectId: string,
    @Headers('x-visitor-id') visitorId: string,
    @Headers('x-session-id') sessionId: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer?: string
  ): Promise<void> {
    await this.service.ingest(projectId, visitorId, sessionId, dto, {
      userAgent: userAgent || 'unknown',
      referrer,
    });
  }
}