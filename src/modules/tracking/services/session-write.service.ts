// src/modules/tracking/services/session-write.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import {
  sessionMetrics,
  NewSessionMetricsRow,
  sessionPageSequence,
  trackingEvents,
  type PageVisit,
} from 'src/database/drizzle/schema';
import { and, eq, lt, asc } from 'drizzle-orm';

interface SessionEndPayload {
  projectId: string;
  visitorId: string;
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  pageCount: number;
  entryPath?: string;
  exitPath?: string;
  totalClicks: number;
  maxScrollDepth: number;
  hasScrolled: boolean;
  bounced: boolean;
  deviceType?: string;
  formsStarted?: number;
  formsCompleted?: number;
  formAbandons?: number;
  screenWidth?: number;
}

@Injectable()
export class SessionWriteService {
  private readonly logger = new Logger(SessionWriteService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async writeSession(payload: SessionEndPayload): Promise<void> {
    try {
      const userCohort = await this.determineUserCohort(
        payload.projectId,
        payload.visitorId,
        new Date(payload.startedAt),
      );
      const deviceType = this.detectDeviceType(payload.screenWidth);

      const row: NewSessionMetricsRow = {
        projectId: payload.projectId,
        visitorId: payload.visitorId,
        sessionId: payload.sessionId,
        startedAt: new Date(payload.startedAt),
        endedAt: new Date(payload.endedAt),
        durationMs: payload.durationMs,
        pageCount: payload.pageCount,
        entryPath: payload.entryPath || null,
        exitPath: payload.exitPath || null,
        totalClicks: payload.totalClicks,
        maxScrollDepth: payload.maxScrollDepth,
        hasScrolled: payload.hasScrolled,
        bounced: payload.bounced,
        deviceType: payload.deviceType || deviceType,
        userCohort,
        formsStarted: payload.formsStarted || 0,
        formsCompleted: payload.formsCompleted || 0,
        formAbandons: payload.formAbandons || 0,
      };

      await this.db.insert(sessionMetrics).values(row).onConflictDoNothing();

      await this.writeSessionPageSequence(payload);
    } catch (error) {
      this.logger.error(
        `Failed to write session ${payload.sessionId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async writeSessionPageSequence(
    payload: SessionEndPayload,
  ): Promise<void> {
    try {
      const pageViewEvents = await this.db
        .select()
        .from(trackingEvents)
        .where(
          and(
            eq(trackingEvents.projectId, payload.projectId),
            eq(trackingEvents.sessionId, payload.sessionId),
            eq(trackingEvents.type, 'page_view'),
          ),
        )
        .orderBy(asc(trackingEvents.occurredAt));

      const pageVisits: PageVisit[] = pageViewEvents
        .filter((e) => e.path !== null && e.path !== undefined)
        .map((e) => ({
          path: e.path as string,
          occurredAt: e.occurredAt.toISOString(),
        }));

      if (pageVisits.length > 0) {
        await this.db
          .insert(sessionPageSequence)
          .values({
            projectId: payload.projectId,
            sessionId: payload.sessionId,
            visitorId: payload.visitorId,
            pageVisits,
            startedAt: new Date(payload.startedAt),
            endedAt: new Date(payload.endedAt),
          })
          .onConflictDoNothing();
      }
    } catch (error) {
      this.logger.error(
        `Failed to write session page sequence for ${payload.sessionId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async determineUserCohort(
    projectId: string,
    visitorId: string,
    currentSessionStart: Date,
  ): Promise<string> {
    const previousSessions = await this.db
      .select({
        count: sessionMetrics.sessionId,
      })
      .from(sessionMetrics)
      .where(
        and(
          eq(sessionMetrics.projectId, projectId),
          eq(sessionMetrics.visitorId, visitorId),
          lt(sessionMetrics.startedAt, currentSessionStart),
        ),
      );

    const sessionCount = previousSessions.length;

    if (sessionCount === 0) {
      return 'new_users';
    }

    if (sessionCount >= 1 && sessionCount <= 4) {
      return 'returning_users';
    }

    return 'power_users';
  }

  private detectDeviceType(screenWidth?: number): string | null {
    if (!screenWidth) return null;
    if (screenWidth < 768) return 'mobile';
    if (screenWidth < 1024) return 'tablet';
    return 'desktop';
  }
}
