// src/modules/tracking/adapters/postgres-tracking.adapter.ts

import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { trackingEvents } from 'src/database/drizzle/schema/tracking-events.schema';
import { TrackingStorageAdapter } from './tracking-storage.adapter';
import { TrackingEvent } from '../domain/tracking-event.model';

@Injectable()
export class PostgresTrackingAdapter implements TrackingStorageAdapter {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async writeBatch(events: TrackingEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      await this.db.insert(trackingEvents).values(
        events.map((e) => ({
          projectId: e.projectId,
          visitorId: e.visitorId,
          sessionId: e.sessionId,
          type: e.type,
          componentId: e.componentId ?? null,
          elementId: e.elementId ?? null,
          path: e.path ?? null,
          metadata: e.metadata ?? null,
          occurredAt: e.occurredAt,
          receivedAt: e.receivedAt,
        }))
      );
    } catch (error) {
      console.error('[TrackingAdapter] Failed to write batch:', error);
    }
  }
}