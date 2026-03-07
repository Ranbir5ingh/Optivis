// src/modules/insights/domain/baseline-envelope.model.ts

export interface BaselineStats {
  mean: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
  stdDev: number;
  sampleSize: number;
}

export interface BaselineEnvelope {
  type: 'historical' | 'heuristic';
  windowDays?: number;
  stats: BaselineStats;
  source: {
    projectId: string;
  };
}