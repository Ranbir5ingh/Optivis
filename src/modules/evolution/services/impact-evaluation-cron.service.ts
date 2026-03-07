// src/modules/evolution/services/impact-evaluation-cron.service.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DRIZZLE_DB } from 'src/database/drizzle/drizzle.tokens';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects } from 'src/database/drizzle/schema';
import { EvolutionJobsRepository } from '../repositories/evolution-jobs.repository';
import { RecommendationInstancesRepository } from '../repositories/recommendation-instances.repository';
import { EvolutionCursorRepository } from '../repositories/evolution-cursor.repository';

@Injectable()
export class ImpactEvaluationCronService {
  private readonly logger = new Logger(ImpactEvaluationCronService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
    private readonly jobsRepo: EvolutionJobsRepository,
    private readonly instancesRepo: RecommendationInstancesRepository,
    private readonly cursorRepo: EvolutionCursorRepository,
  ) {}

  @Cron('0 */6 * * *', { name: 'evaluate-impact', timeZone: 'UTC' })
  async evaluateImpact(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting impact evaluation jobs');

      const allProjects = await this.db.select().from(projects);

      if (allProjects.length === 0) {
        this.logger.debug('No projects to evaluate');
        return;
      }

      let successCount = 0;

      for (const project of allProjects) {
        try {
          const readyInstances =
            await this.instancesRepo.getReadyForEvaluation(project.id);

          for (const instance of readyInstances) {
            await this.jobsRepo.create({
              projectId: project.id,
              instanceId: instance.id,
              jobType: 'evaluate_impact',
              status: 'pending',
              maxRetries: 3,
            });
            successCount++;
          }

          await this.cursorRepo.setCursor(
            project.id,
            'evaluate_impact',
            new Date(),
          );
        } catch (error) {
          this.logger.error(
            `❌ Impact evaluation failed | project=${project.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(
        `✅ ImpactEvaluationCron | system | jobs=${successCount} | duration=${
          Date.now() - startTime
        }ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to create impact evaluation jobs',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron('0 2 * * *', { name: 'expire-recommendations', timeZone: 'UTC' })
  async expireOldRecommendations(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Expiring old recommendations');

      const allProjects = await this.db.select().from(projects);

      let expiredCount = 0;

      for (const project of allProjects) {
        try {
          const expiredInstances =
            await this.instancesRepo.getExpired(project.id);

          for (const instance of expiredInstances) {
            await this.instancesRepo.updateStatus(instance.id, 'expired', {
              expiredAt: new Date(),
            });
            expiredCount++;
          }
        } catch (error) {
          this.logger.error(
            `❌ Expiration failed | project=${project.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(
        `✅ ExpireRecommendationsCron | system | expired=${expiredCount} | duration=${
          Date.now() - startTime
        }ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to expire recommendations',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}