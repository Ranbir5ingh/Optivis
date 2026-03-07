// src/modules/insights/jobs/cron-job-creator.job.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects } from 'src/database/drizzle/schema';
import { InsightsJobsRepository } from '../repositories/insights-jobs.repository';

import {
  toUtcDayStart,
  toUtcDayEnd,
  subtractDays,
} from 'src/shared/utils/date.utils';

@Injectable()
export class InsightsCronJobCreatorService {
  private readonly logger = new Logger(InsightsCronJobCreatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly jobsRepo: InsightsJobsRepository,
  ) {}

  @Cron('0 2 * * *', { name: 'daily-insights-job-creator', timeZone: 'UTC' })
  async createInsightJobs(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Creating daily insights jobs');

      const allProjects = await this.db.select().from(projects);

      if (allProjects.length === 0) {
        this.logger.debug('No projects for insights');
        return;
      }

      const yesterday = subtractDays(new Date(), 1);
      const dayStart = toUtcDayStart(yesterday);
      const dayEnd = toUtcDayEnd(yesterday);

      let successCount = 0;

      for (const project of allProjects) {
        try {
          const exists = await this.jobsRepo.exists(project.id, dayStart);

          if (!exists) {
            await this.jobsRepo.create({
              projectId: project.id,
              windowStart: dayStart,
              windowEnd: dayEnd,
              status: 'pending',
              maxRetries: 3,
            });
            successCount++;
          }
        } catch (error) {
          this.logger.error(
            `❌ InsightsJobCreator failed | project=${project.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(
        `✅ InsightsJobCreation | project=SYSTEM | jobs=${successCount} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to create insights jobs',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}