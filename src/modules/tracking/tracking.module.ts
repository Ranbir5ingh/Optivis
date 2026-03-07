// src/modules/tracking/tracking.module.ts

import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './services/tracking.service';
import { SessionWriteService } from './services/session-write.service';
import { PostgresTrackingAdapter } from './adapters/postgres-tracking.adapter';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { ProjectKeysModule } from '../project-keys/project-keys.module';
import { TrackingRepository } from './repositories/tracking.repository';
 

@Module({
  imports: [DrizzleModule, ProjectKeysModule],
  controllers: [TrackingController],
  providers: [
    TrackingService,
    SessionWriteService,
    TrackingRepository,
    {
      provide: 'TrackingStorageAdapter',
      useClass: PostgresTrackingAdapter,
    },
  ],
  exports: [TrackingRepository],
})
export class TrackingModule {}