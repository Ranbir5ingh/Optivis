import { Module } from '@nestjs/common';
import { ProjectKeysRepository } from './project-keys.repository';
import { ProjectKeysService } from './project-keys.service';
import { ProjectKeyGuard } from './guards/project-key.guard';
import { DrizzleModule } from 'src/database/drizzle/drizzle.module';

/**
 * Project Keys Module
 * 
 * SHARED MODULE: Used by multiple modules for project authentication
 * 
 * Provides:
 * - ProjectKeysService: Key management
 * - ProjectKeyGuard: Request validation
 * - ProjectId decorator: Extract projectId
 * 
 * Used by:
 * - TrackingModule (event ingestion)
 * - CodeIntelligenceModule (manifest upload)
 * - AnalyticsModule (data queries)
 * - ProjectsModule (key CRUD)
 */
@Module({
  imports: [DrizzleModule],
  providers: [ProjectKeysRepository, ProjectKeysService, ProjectKeyGuard],
  exports: [ProjectKeysService, ProjectKeyGuard], // ✅ Export guard too
})
export class ProjectKeysModule {}