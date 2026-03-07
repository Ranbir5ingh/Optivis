// src/modules/insights/config/heuristic-baseline-rules.config.ts

export const HEURISTIC_BASELINE_RULES = {
  USE_WHEN: {
    SAMPLE_TOO_SMALL: 'sampleSize < MIN_SAMPLE_SIZE[metric]',
    PROJECT_TOO_NEW: 'projectAge < baselineWindow',
    COMPONENT_NEW: 'component has no historical data',
  },

  DEFAULT_HEURISTIC_VALUES: {
    ctr: 0.05,
    engagement: 50,
    form_abandonment: 0.3,
    form_abandon_rate: 0.3,
    form_completion_rate: 0.7,
    form_error_rate: 0.05,
    lcp: 2500,
    inp: 100,
    cls: 0.1,
    ttfb: 800,
    time_visible: 3000,
    drop_off_rate: 0.4,
  },

  HEURISTIC_PERCENTILES: {
    p25: (value: number) => value * 0.8,
    p50: (value: number) => value,
    p75: (value: number) => value * 1.2,
    p90: (value: number) => value * 1.5,
    p99: (value: number) => value * 2.0,
  },
} as const;