// src/modules/funnels/funnels.module.ts

import { Module } from '@nestjs/common';
import { FunnelsService } from './services/funnels.service';
import { FunnelsRepository } from './funnels.repository';
import { FunnelsController } from './funnels.controller';
import { FunnelsPolicy } from './policies/funnels.policy';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    DrizzleModule,
    ProjectsModule,
    OrganizationsModule,
  ],

  providers: [
    FunnelsService,
    FunnelsRepository,
    FunnelsPolicy,
  ],

  controllers: [FunnelsController],

  exports: [
    FunnelsRepository,
  ],
})
export class FunnelsModule {}