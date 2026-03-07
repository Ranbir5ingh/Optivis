// src/modules/funnels/services/funnel-optimizer.service.ts

import { Injectable } from '@nestjs/common';
import type { FunnelStep } from 'src/database/drizzle/schema';
import type { FunnelMetricsRow } from 'src/database/drizzle/schema';

export interface OptimizationResult {
  optimalSteps: FunnelStep[];
  currentConversion: number;
  optimizedConversion: number;
  improvement: number;
  reasoning: string;
}

export interface CrossFunnelPattern {
  pattern: string;
  confidence: number;
  evidence: string;
}

export interface CrossFunnelAnalysis {
  userJourneyPatterns: CrossFunnelPattern[];
  bottlenecks: Array<{
    stepName: string;
    affectedFunnels: string[];
    averageDropOff: number;
  }>;
  opportunities: CrossFunnelPattern[];
}

@Injectable()
export class FunnelOptimizerService {
  optimizeStepOrder(
    steps: FunnelStep[],
    metrics: FunnelMetricsRow[]
  ): OptimizationResult {
    const currentConversion = this.calculateConversionRate(steps, metrics);
    
    const conversionByStep = new Map<number, number>();
    for (const metric of metrics) {
      if (!conversionByStep.has(metric.stepIndex)) {
        conversionByStep.set(metric.stepIndex, 0);
      }
      const rate = metric.enteredCount > 0 
        ? metric.completedCount / metric.enteredCount 
        : 0;
      conversionByStep.set(metric.stepIndex, rate);
    }

    const sortedSteps = [...steps].sort((a, b) => {
      const rateA = conversionByStep.get(a.index) || 0;
      const rateB = conversionByStep.get(b.index) || 0;
      return rateB - rateA;
    });

    const optimizedConversion = this.calculateConversionRate(sortedSteps, metrics);
    const improvement = currentConversion > 0 
      ? (optimizedConversion - currentConversion) / currentConversion 
      : 0;

    const reasoning = this.generateOptimizationReasoning(
      sortedSteps,
      steps,
      improvement
    );

    return {
      optimalSteps: sortedSteps,
      currentConversion,
      optimizedConversion,
      improvement,
      reasoning,
    };
  }

  analyzeCrossFunnelPatterns(
    funnelNames: string[],
    allMetrics: Map<string, FunnelMetricsRow[]>
  ): CrossFunnelAnalysis {
    const userJourneyPatterns: CrossFunnelPattern[] = [];
    const bottlenecks: Array<{
      stepName: string;
      affectedFunnels: string[];
      averageDropOff: number;
    }> = [];
    const opportunities: CrossFunnelPattern[] = [];

    const dropOffByStep = new Map<string, { funnels: string[]; totalDropOff: number; count: number }>();

    for (const funnelName of funnelNames) {
      const metrics = allMetrics.get(funnelName) || [];
      
      for (const metric of metrics) {
        const dropOffRate = metric.enteredCount > 0 
          ? metric.dropOffRate 
          : 0;

        if (dropOffRate > 0.3) {
          const key = metric.stepName;
          if (!dropOffByStep.has(key)) {
            dropOffByStep.set(key, { funnels: [], totalDropOff: 0, count: 0 });
          }
          
          const entry = dropOffByStep.get(key)!;
          entry.funnels.push(funnelName);
          entry.totalDropOff += dropOffRate;
          entry.count += 1;
        }
      }
    }

    for (const [stepName, data] of dropOffByStep.entries()) {
      const averageDropOff = data.count > 0 ? data.totalDropOff / data.count : 0;
      const affectedPercentage = (data.funnels.length / funnelNames.length) * 100;
      
      if (affectedPercentage >= 50) {
        bottlenecks.push({
          stepName,
          affectedFunnels: [...new Set(data.funnels)],
          averageDropOff,
        });

        opportunities.push({
          pattern: `Step "${stepName}" is a bottleneck in ${affectedPercentage.toFixed(0)}% of funnels with average drop-off of ${(averageDropOff * 100).toFixed(1)}%`,
          confidence: Math.min(1, affectedPercentage / 100),
          evidence: `Detected in ${data.funnels.length} distinct funnels: ${[...new Set(data.funnels)].join(', ')}`,
        });
      }
    }

    return {
      userJourneyPatterns,
      bottlenecks,
      opportunities,
    };
  }

  private calculateConversionRate(
    steps: FunnelStep[],
    metrics: FunnelMetricsRow[]
  ): number {
    if (steps.length === 0 || metrics.length === 0) {
      return 0;
    }

    const firstStepMetrics = metrics.filter(m => m.stepIndex === steps[0].index);
    const lastStepMetrics = metrics.filter(m => m.stepIndex === steps[steps.length - 1].index);

    if (firstStepMetrics.length === 0 || lastStepMetrics.length === 0) {
      return 0;
    }

    const totalEntered = firstStepMetrics.reduce((sum, m) => sum + m.enteredCount, 0);
    const totalCompleted = lastStepMetrics.reduce((sum, m) => sum + m.completedCount, 0);

    return totalEntered > 0 ? totalCompleted / totalEntered : 0;
  }

  private generateOptimizationReasoning(
    optimized: FunnelStep[],
    original: FunnelStep[],
    improvement: number
  ): string {
    if (improvement <= 0) {
      return 'Current step order is already optimal.';
    }

    const changedSteps = optimized
      .filter((step, idx) => step.index !== original[idx]?.index)
      .map(step => step.name)
      .join(', ');

    return `Reordering steps [${changedSteps}] could improve conversion by ${(improvement * 100).toFixed(1)}%.`;
  }
}