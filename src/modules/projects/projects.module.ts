// src/modules/projects/projects.module.ts

import { Module } from '@nestjs/common';
import { ProjectsService } from './services/projects.service';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsRepository } from './projects.repository';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsPolicy } from './policies/project.policy';
import { ProjectKeysModule } from '../project-keys/project-keys.module';
import { CodeIntelligenceModule } from '../code-intelligence/code-intelligence.module';
import { GithubInstallController } from './controllers/github-install.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { ProjectSettingsService } from './services/project-settings.service';

@Module({
  imports: [
    DrizzleModule,
    OrganizationsModule,
    ProjectKeysModule,
    CodeIntelligenceModule,
    TrackingModule,
    CodeIntelligenceModule,
  ],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ProjectsPolicy,
    ProjectSettingsService,
  ],
  controllers: [ProjectsController, GithubInstallController],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
