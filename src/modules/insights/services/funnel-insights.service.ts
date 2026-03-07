// src/modules/insights/services/funnel-insights.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { FunnelsRepository } from 'src/modules/funnels/funnels.repository';
import { AnalyticsReadRepository } from 'src/modules/aggregation/repositories/analytics-read.repository';
import { FunnelAnalyzerService, FunnelMetricsAnalysis } from '../analyzers/funnel-analyzer.service';
import { FunnelOptimizerService, OptimizationResult } from '../analyzers/funnel-optimizer.service';
import { DomainError } from 'src/common/exceptions/domain-error';

export interface FunnelAnalysisResponse {
  funnelName: string;
  metrics: FunnelMetricsAnalysis;
  optimization?: OptimizationResult;
}

@Injectable()
export class FunnelInsightsService {
  private readonly logger = new Logger(FunnelInsightsService.name);

  constructor(
    private readonly funnelsRepo: FunnelsRepository,
    private readonly analyticsReadRepo: AnalyticsReadRepository,
    private readonly analyzerService: FunnelAnalyzerService,
    private readonly optimizerService: FunnelOptimizerService,
  ) {}

  async analyzeFunnel(
    projectId: string,
    funnelId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FunnelAnalysisResponse> {
    try {
      // ✅ Step 1: Fetch funnel definition from Funnels module
      const funnel = await this.funnelsRepo.findById(funnelId);

      if (!funnel) {
        throw new DomainError(
          'FUNNEL_NOT_FOUND',
          'Funnel definition not found',
          'not_found',
          { funnelId }
        );
      }

      if (funnel.projectId !== projectId) {
        throw new DomainError(
          'FUNNEL_NOT_IN_PROJECT',
          'Funnel does not belong to this project',
          'forbidden',
          { funnelId, projectId }
        );
      }

      // ✅ Step 2: Fetch aggregated metrics from AnalyticsQuery module
      // This reads from daily_funnel_metrics (computed by Aggregation)
      const metrics = await this.analyticsReadRepo.getDailyFunnelMetrics(
        projectId,
        startDate,
        endDate
      );

      if (metrics.length === 0) {
        this.logger.debug(
          `No funnel metrics found for ${funnelId} between ${startDate} and ${endDate}`
        );
        return {
          funnelName: funnel.name,
          metrics: {
            steps: [],
            overallConversion: 0,
            bottleneckStep: null,
            avgTimeToComplete: null,
          },
        };
      }

      // ✅ Step 3: Perform analysis using Insights services
      const analysis = this.analyzerService.analyzeFunnelMetrics(
        funnel.steps,
        metrics
      );

      // ✅ Step 4: Generate optimization suggestions
      const optimization = metrics.length > 0
        ? this.optimizerService.optimizeStepOrder(funnel.steps, metrics)
        : undefined;

      this.logger.log(
        `Analyzed funnel ${funnelId} with ${metrics.length} metric records`
      );

      return {
        funnelName: funnel.name,
        metrics: analysis,
        optimization,
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze funnel ${funnelId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }
}