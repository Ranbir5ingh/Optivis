// src/modules/funnels/services/funnel-analyzer.service.ts

import { Injectable } from '@nestjs/common';
import type { FunnelStep, FunnelMetricsRow } from 'src/database/drizzle/schema';

export interface FunnelMetricsAnalysis {
  steps: Array<{
    stepIndex: number;
    stepName: string;
    enteredCount: number;
    completedCount: number;
    dropOffRate: number;
    conversionRate: number;
    avgTimeMs: number | null;
  }>;
  overallConversion: number;
  bottleneckStep: {
    stepIndex: number;
    stepName: string;
    dropOffRate: number;
  } | null;
  avgTimeToComplete: number | null;
}

@Injectable()
export class FunnelAnalyzerService {
  analyzeFunnelMetrics(
    steps: FunnelStep[],
    metrics: FunnelMetricsRow[]
  ): FunnelMetricsAnalysis {
    const analyzedSteps = steps.map(step => {
      const stepMetrics = metrics.filter(m => m.stepIndex === step.index);
      
      const enteredCount = stepMetrics.reduce((sum, m) => sum + m.enteredCount, 0);
      const completedCount = stepMetrics.reduce((sum, m) => sum + m.completedCount, 0);
      const dropOffRate = enteredCount > 0 
        ? (enteredCount - completedCount) / enteredCount 
        : 0;
      const conversionRate = enteredCount > 0 
        ? completedCount / enteredCount 
        : 0;
      
      const validTimes = stepMetrics
        .filter(m => m.avgTimeMs !== null && m.avgTimeMs !== undefined)
        .map(m => m.avgTimeMs as number);
      const avgTimeMs = validTimes.length > 0
        ? validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length
        : null;

      return {
        stepIndex: step.index,
        stepName: step.name,
        enteredCount,
        completedCount,
        dropOffRate,
        conversionRate,
        avgTimeMs,
      };
    });

    const firstStepEntered = analyzedSteps[0]?.enteredCount || 0;
    const lastStepCompleted = analyzedSteps[analyzedSteps.length - 1]?.completedCount || 0;
    const overallConversion = firstStepEntered > 0 
      ? lastStepCompleted / firstStepEntered 
      : 0;

    const bottleneckStep = analyzedSteps.reduce((max, current) =>
      (current.dropOffRate > max.dropOffRate) ? current : max
    ) || null;

    const validTimes = analyzedSteps
      .filter(s => s.avgTimeMs !== null)
      .map(s => s.avgTimeMs as number);
    const avgTimeToComplete = validTimes.length > 0
      ? validTimes.reduce((sum, t) => sum + t, 0)
      : null;

    return {
      steps: analyzedSteps,
      overallConversion,
      bottleneckStep: bottleneckStep ? {
        stepIndex: bottleneckStep.stepIndex,
        stepName: bottleneckStep.stepName,
        dropOffRate: bottleneckStep.dropOffRate,
      } : null,
      avgTimeToComplete,
    };
  }
}