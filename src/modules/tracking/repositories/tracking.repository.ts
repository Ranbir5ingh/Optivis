// src/modules/tracking/repositories/tracking.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { trackingEvents } from 'src/database/drizzle/schema';

@Injectable()
export class TrackingRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async hasAnyEvent(projectId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: trackingEvents.id })
      .from(trackingEvents)
      .where(eq(trackingEvents.projectId, projectId))
      .limit(1);

    return !!row;
  }
}