import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { trackingEvents, sessionMetrics } from 'src/database/drizzle/schema';
import { lte, sql } from 'drizzle-orm';

import { subtractDays } from 'src/shared/utils/date.utils';

/**
 * Retention cleanup job
 * - Delete raw tracking events older than 30 days
 * - Delete session metrics older than 7 days
 * Runs daily at 2 AM UTC
 */
@Injectable()
export class RetentionCleanupJob {
  private readonly logger = new Logger(RetentionCleanupJob.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'retention-cleanup', timeZone: 'UTC' })
  async execute(): Promise<void> {
    const startTime = Date.now();
    try {
      this.logger.log('🧹 Starting retention cleanup job...');

      const [eventsDeleted, sessionsDeleted] = await Promise.all([
        this.cleanupTrackingEvents(),
        this.cleanupSessionMetrics(),
      ]);
      const totalDeleted = eventsDeleted + sessionsDeleted;
      this.logger.log(
        `🧹 RetentionCleanup | project=SYSTEM | deleted=${totalDeleted} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        `❌ RetentionCleanup failed | project=SYSTEM`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async cleanupTrackingEvents(): Promise<number> {
    const thirtyDaysAgo = subtractDays(new Date(), 30);

    let totalDeleted = 0;
    const BATCH_SIZE = 10000;

    // Delete in batches
    while (true) {
      const deleted = await this.db.execute(sql`
      DELETE FROM ${trackingEvents}
      WHERE ${trackingEvents.receivedAt} <= ${thirtyDaysAgo}
      AND id IN (
        SELECT id FROM ${trackingEvents}
        WHERE ${trackingEvents.receivedAt} <= ${thirtyDaysAgo}
        LIMIT ${BATCH_SIZE}
      )
    `);

      const rowCount = (deleted as any).rowCount || 0;
      totalDeleted += rowCount;

      if (rowCount < BATCH_SIZE) {
        break; // No more rows to delete
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.debug(`Purged ${totalDeleted} stale tracking events`);
    return totalDeleted;
  }

  /**
   * Delete session metrics older than 7 days
   * ✅ FIXED: Batch deletes to avoid table locks
   */
  private async cleanupSessionMetrics(): Promise<number> {
    const sevenDaysAgo = subtractDays(new Date(), 7);

    let totalDeleted = 0;
    const BATCH_SIZE = 10000;

    while (true) {
      const deleted = await this.db.execute(sql`
      DELETE FROM ${sessionMetrics}
      WHERE ${sessionMetrics.endedAt} <= ${sevenDaysAgo}
      AND id IN (
        SELECT id FROM ${sessionMetrics}
        WHERE ${sessionMetrics.endedAt} <= ${sevenDaysAgo}
        LIMIT ${BATCH_SIZE}
      )
    `);

      const rowCount = (deleted as any).rowCount || 0;
      totalDeleted += rowCount;

      if (rowCount < BATCH_SIZE) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.debug(`Purged ${totalDeleted} stale session metrics`);
    return totalDeleted;
  }
}
