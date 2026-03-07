// src/modules/tracking/tracking.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import type { TrackingStorageAdapter } from '../adapters/tracking-storage.adapter';
import { IngestTrackingBatchDto } from '../dto/ingest-batch.dto';
import { TrackingEvent } from '../domain/tracking-event.model';
import { TrackingEventType } from '../domain/tracking-event-type.enum';
import { DomainError } from 'src/common/exceptions/domain-error';
import { EventPayloadValidator } from '../validators/event-payload.validator';
import { SessionWriteService } from '../services/session-write.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  constructor(
    @Inject('TrackingStorageAdapter')
    private readonly storage: TrackingStorageAdapter,
    private readonly sessionWriter: SessionWriteService,
  ) {}

  async ingest(
    projectId: string,
    visitorId: string,
    sessionId: string,
    dto: IngestTrackingBatchDto,
    context: { userAgent: string; referrer?: string },
  ): Promise<void> {
    if (
      !visitorId ||
      typeof visitorId !== 'string' ||
      visitorId.trim().length === 0
    ) {
      throw new DomainError(
        'INVALID_VISITOR_ID',
        'Visitor ID is required and must be a non-empty string',
        'validation',
      );
    }

    if (
      !sessionId ||
      typeof sessionId !== 'string' ||
      sessionId.trim().length === 0
    ) {
      throw new DomainError(
        'INVALID_SESSION_ID',
        'Session ID is required and must be a non-empty string',
        'validation',
      );
    }

    const trimmedVisitorId = visitorId.trim();
    const trimmedSessionId = sessionId.trim();

    for (const event of dto.events) {
      EventPayloadValidator.validate(event);
    }

    const now = new Date();

    const events: TrackingEvent[] = dto.events.map((e) => ({
      projectId,
      visitorId: trimmedVisitorId,
      sessionId: trimmedSessionId,
      type: e.type,
      componentId: e.componentId,
      elementId: e.elementId,
      path: e?.path,
      metadata: {
        ...e.metadata,
        userAgent: context.userAgent,
        referrer: context.referrer,
      },
      occurredAt: new Date(e.timestamp),
      receivedAt: now,
    }));

    const sessionEndEvents = events.filter(
      (e) => e.type === TrackingEventType.SESSION_END,
    );

    for (const sessionEndEvent of sessionEndEvents) {
      await this.handleSessionEnd(sessionEndEvent);
    }

    try {
      await this.storage.writeBatch(events);
    } catch (error) {
      try {
        this.logger.error(
          `Failed to write tracking batch for project ${projectId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      } catch (logError) {
        console.error(
          '[CRITICAL] Logger failed during tracking error:',
          logError,
        );
        console.error('[ORIGINAL ERROR]:', error);
      }
    }
  }

  private async handleSessionEnd(event: TrackingEvent): Promise<void> {
    const metadata = event.metadata as Record<string, unknown>;

    await this.sessionWriter.writeSession({
      projectId: event.projectId,
      visitorId: event.visitorId,
      sessionId: event.sessionId,
      startedAt: this.extractNumber(
        metadata.startedAt,
        event.occurredAt.getTime(),
      ),
      endedAt: event.occurredAt.getTime(),
      durationMs: this.extractNumber(metadata.durationMs, 0),
      pageCount: this.extractNumber(metadata.pageCount, 1),
      entryPath: this.extractString(metadata.entryPath),
      exitPath: this.extractString(metadata.exitPath),
      totalClicks: this.extractNumber(metadata.totalClicks, 0),
      maxScrollDepth: this.extractNumber(metadata.maxScrollDepth, 0),
      hasScrolled: this.extractBoolean(metadata.scrolled, false),
      bounced: this.extractBoolean(metadata.bounced, false),
      deviceType: this.extractString(metadata.deviceType),
      formsStarted: this.extractNumber(metadata.formsStarted, 0),
      formsCompleted: this.extractNumber(metadata.formsCompleted, 0),
      formAbandons: this.extractNumber(metadata.formAbandons, 0),
      screenWidth: this.extractNumber(metadata.screenWidth),
    });
  }

  private extractNumber(value: unknown, defaultValue: number = 0): number {
    if (value === null || value === undefined) return defaultValue;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  private extractString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  }

  private extractBoolean(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return defaultValue;
  }
}
