// src/modules/aggregation/jobs/cron-job-creator.job.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects } from 'src/database/drizzle/schema';
import { AggregationJobsRepository } from '../repositories/aggregation-jobs.repository';

import {
  toUtcHourStart,
  toUtcHourEnd,
  toUtcDayStart,
  toUtcDayEnd,
  subtractDays,
} from 'src/shared/utils/date.utils';

@Injectable()
export class CronJobCreatorService {
  private readonly logger = new Logger(CronJobCreatorService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly jobsRepo: AggregationJobsRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'hourly-job-creator',
    timeZone: 'UTC',
  })
  async createHourlyJobs(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Creating hourly aggregation jobs');

      const allProjects = await this.db.select().from(projects);

      if (allProjects.length === 0) {
        this.logger.debug('No projects to aggregate');
        return;
      }

      const now = new Date();
      const previousHourStart = toUtcHourStart(
        new Date(now.getTime() - 60 * 60 * 1000),
      );
      const previousHourEnd = toUtcHourEnd(previousHourStart);

      const hourlyPipelines = [
        'hourly_page_metrics',
        'hourly_component_metrics',
        'hourly_element_metrics',
        'hourly_session_metrics',
      ];

      let successCount = 0;

      for (const project of allProjects) {
        for (const pipeline of hourlyPipelines) {
          try {
            const exists = await this.jobsRepo.exists(
              project.id,
              pipeline,
              previousHourStart,
            );

            if (!exists) {
              await this.jobsRepo.create({
                projectId: project.id,
                pipeline,
                windowStart: previousHourStart,
                windowEnd: previousHourEnd,
                status: 'pending',
                maxRetries: 3,
              });
              successCount++;
            }
          } catch (error) {
            this.logger.error(
              `❌ HourlyJobCreator failed | project=${project.id} | pipeline=${pipeline}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      }

      this.logger.log(
        `✅ HourlyJobCreation | system | jobs=${successCount} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to create hourly jobs',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron('0 1 * * *', { name: 'daily-job-creator', timeZone: 'UTC' })
  async createDailyJobs(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Creating daily aggregation jobs');

      const allProjects = await this.db.select().from(projects);

      if (allProjects.length === 0) {
        this.logger.debug('No projects to aggregate');
        return;
      }

      const yesterday = subtractDays(new Date(), 1);
      const dayStart = toUtcDayStart(yesterday);
      const dayEnd = toUtcDayEnd(yesterday);

      const pipelines = [
        'daily_page_metrics',
        'daily_session_metrics',
        'daily_component_metrics',
        'daily_element_metrics',
        'daily_performance_metrics',
        'daily_form_metrics',
        'daily_behavioral_metrics',
        'daily_funnel_metrics',
      ];

      let successCount = 0;

      for (const project of allProjects) {
        for (const pipeline of pipelines) {
          try {
            const exists = await this.jobsRepo.exists(
              project.id,
              pipeline,
              dayStart,
            );

            if (!exists) {
              await this.jobsRepo.create({
                projectId: project.id,
                pipeline,
                windowStart: dayStart,
                windowEnd: dayEnd,
                status: 'pending',
                maxRetries: 3,
              });
              successCount++;
            }
          } catch (error) {
            this.logger.error(
              `❌ DailyJobCreator failed | project=${project.id} | pipeline=${pipeline}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      }

      this.logger.log(
        `✅ DailyJobCreation | system | jobs=${successCount} | duration=${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to create daily jobs',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
