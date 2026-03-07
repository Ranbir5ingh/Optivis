// src/modules/insights/config/insight-thresholds.config.ts

export const INSIGHT_THRESHOLDS = {
  LOW_CTR: {
    medium: { percentChange: 0.4, zScore: -2.0 },
    high: { percentChange: 0.6, zScore: -2.8 },
  },
  ENGAGEMENT_DROP: {
    medium: { percentChange: 0.25 },
    high: { percentChange: 0.5 },
  },
  HIGH_FORM_ABANDON: {
    medium: 0.5,
    high: 0.7,
  },
  LOW_FORM_COMPLETION: {
    medium: 0.3,
    high: 0.2,
  },
  HIGH_FORM_ERRORS: {
    medium: 0.3,
    high: 0.5,
  },
  HIGH_BOUNCE_RATE: {
    medium: 0.5,
    high: 0.7,
  },
} as const;

export type ThresholdLevel = 'medium' | 'high';
