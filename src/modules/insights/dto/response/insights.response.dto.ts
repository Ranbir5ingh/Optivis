// src/modules/insights/dto/response/insights.response.dto.ts

import { BaselineType, InsightContext, ComparisonMetadata, ConfidenceMetadata } from "../../domain/detected-insight.model";
import { InsightStatus } from "../../domain/insight-status.enum";

export class ComparisonMetadataDto {
  mode: 'historical' | 'heuristic' | 'cohort';
  lens: 'distribution' | 'trend' | 'statistical'| 'threshold';
  direction: 'increase' | 'decrease';
  baselinePercentile?: number;
  baselineFallbackReason?: string;
}

export class ConfidenceMetadataDto {
  model: 'statistical' | 'heuristic';
  pValue?: number;
  zScore?: number;
  effectSize?: number;
  sampleSizeWeight?: number;
}

export class InsightItemDto {
  id: string;
  flag: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  status: InsightStatus;

  title: string;
  description: string;
  recommendation?: string;

  componentId?: string;
  elementId?: string;
  context?: InsightContext;

  value?: number;
  baseline?: number;
  percentageChange?: number;

  baselineType?: BaselineType;
  baselineWindowDays?: number;

  confidence?: number;
  confidenceMetadata?: ConfidenceMetadataDto;
  zScore?: number;
  pValue?: number;

  comparison?: ComparisonMetadataDto;

  detectedAt: string;
  firstDetectedAt: string;
  lastSeenAt: string;
}

export class InsightsSummaryDto {
  total: number;
  critical: number;
  warnings: number;
}

export class InsightsResponseDto {
  insights: InsightItemDto[];
  summary: InsightsSummaryDto;
}