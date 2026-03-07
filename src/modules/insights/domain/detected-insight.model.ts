// src/modules/insights/domain/detected-insight.model.ts

import { InsightFlag, InsightSeverity } from './insight-flag.enum';
import { InsightStatus } from './insight-status.enum';

export type BaselineType = 'historical' | 'heuristic';

export interface ConfidenceMetadata {
  model: 'statistical' | 'heuristic';
  pValue?: number;
  zScore?: number;
  effectSize?: number;
  sampleSizeWeight?: number;
}

export interface ComparisonMetadata {
  mode: 'historical' | 'heuristic' | 'cohort';
  lens: 'distribution' | 'trend' | 'statistical' | 'threshold';
  direction: 'increase' | 'decrease';
  baselinePercentile?: number;
  baselineFallbackReason?: string;
}

export interface InsightContext {
  type: 'component' | 'element' | 'page' | 'funnel';
  path?: string;
  funnelId?: string;
  funnelStep?: number;
}

export interface DetectedInsight {
  flag: InsightFlag;
  severity: InsightSeverity;
  status?: InsightStatus;
  projectId: string;
  componentId?: string;
  elementId?: string;
  reason: string;
  value?: number;
  baseline?: number;
  percentageChange?: number;
  detectedAt: Date;
  confidence?: number;
  confidenceMetadata?: ConfidenceMetadata;
  zScore?: number;
  pValue?: number;
  baselineType?: BaselineType;
  baselineWindowDays?: number;
  context?: InsightContext;
  comparison?: ComparisonMetadata;
}

export function isStatisticalInsight(
  insight: DetectedInsight,
): insight is DetectedInsight & {
  confidence: number;
  confidenceMetadata: ConfidenceMetadata & { model: 'statistical' };
} {
  return (
    typeof insight.confidence === 'number' &&
    insight.confidenceMetadata?.model === 'statistical'
  );
}
