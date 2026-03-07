import { Module } from '@nestjs/common';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';
import { ConfigModule } from '@nestjs/config';

import { CodeMetadataService } from './services/code-metadata.service';
import { CodeMetadataRepository } from './repositories/code-metadata.repository';
import { CodeMetadataController } from './controllers/code-metadata.controller';

import { GithubAuthService } from './services/github-auth.service';
import { GithubRepoService } from './services/github-repo.service';
import { GithubWebhookController } from './controllers/github-webhook.controller';

import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectKeysModule } from '../project-keys/project-keys.module';
import { CodeFetchService } from './services/code-fetch.service';
import { ProjectGithubConnectionService } from './services/project-github-connection.service';
import { ProjectGithubConnectionRepository } from './repositories/project-github-connections.repository';
import { OrgGithubInstallationsService } from './services/org-github-installations.service';
import { OrgGithubInstallationsRepository } from './repositories/org-github-installations.repository';

/**
 * Code Intelligence Module
 *
 * Responsibilities:
 * 1. Code Metadata: Store and resolve component/element IDs to source code
 * 2. GitHub Integration: OAuth-like app installation for repo access
 * 3. GitHub Auth: Generate app JWTs and exchange for installation tokens
 * 4. Webhooks: Listen for installation changes and repo modifications
 */
@Module({
  imports: [
    DrizzleModule,
    ConfigModule,
    OrganizationsModule,
    ProjectKeysModule,
  ],

  providers: [
    CodeMetadataService,
    CodeMetadataRepository,
    GithubAuthService,
    GithubRepoService,
    OrgGithubInstallationsService,
    ProjectGithubConnectionService,
    OrgGithubInstallationsRepository,
    ProjectGithubConnectionRepository,
    CodeFetchService,
  ],

  controllers: [CodeMetadataController, GithubWebhookController],

  exports: [
    CodeMetadataService,
    CodeMetadataRepository,
    GithubAuthService,
    GithubRepoService,
    OrgGithubInstallationsService,
    ProjectGithubConnectionService,
    OrgGithubInstallationsRepository,
    ProjectGithubConnectionRepository,
    CodeFetchService,
  ],
})
export class CodeIntelligenceModule {}
