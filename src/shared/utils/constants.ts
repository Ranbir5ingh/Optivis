/**
 * Application-wide constants
 * Centralized for consistency and documentation
 */

/**
 * Core Web Vitals Thresholds (Google standards)
 */
export const CORE_WEB_VITALS = {
  LCP: {
    GOOD: 2500, // milliseconds
    NEEDS_IMPROVEMENT: 4000,
  },
  CLS: {
    GOOD: 0.1, // score
    NEEDS_IMPROVEMENT: 0.25,
  },
  INP: {
    GOOD: 200, // milliseconds
    NEEDS_IMPROVEMENT: 500,
  },
  TTFB: {
    GOOD: 800, // milliseconds
    NEEDS_IMPROVEMENT: 1800,
  },
} as const;

/**
 * Engagement Score Calculation Weights
 * Formula: CTR * 0.4 + Time * 0.35 + Scroll * 0.25
 * 
 * Rationale:
 * - CTR (40%): Direct interaction signal
 * - Time (35%): Attention/interest indicator
 * - Scroll (25%): Content consumption
 */
export const ENGAGEMENT_WEIGHTS = {
  CTR: 0.4,
  TIME: 0.35,
  SCROLL: 0.25,
} as const;

/**
 * Engagement normalization targets
 */
export const ENGAGEMENT_TARGETS = {
  PERFECT_CTR: 0.1, // 10% click rate
  PERFECT_TIME_MS: 5000, // 5 seconds
  PERFECT_SCROLL_DEPTH: 50, // 50% scroll
} as const;

/**
 * Insight Detection Thresholds
 */
export const INSIGHT_THRESHOLDS = {
  CTR_DROP: {
    WARNING: 0.4, // 40% drop
    CRITICAL: 0.6, // 60% drop
  },
  ENGAGEMENT_DROP: {
    WARNING: 0.25, // 25% drop
    CRITICAL: 0.5, // 50% drop
  },
  BOUNCE_RATE: {
    WARNING: 0.5, // 50%
    CRITICAL: 0.7, // 70%
  },
  PERFORMANCE_REGRESSION: {
    WARNING: 0.2, // 20% slower
    CRITICAL: 0.5, // 50% slower
  },
} as const;

/**
 * Data Retention Policies
 */
export const RETENTION = {
  RAW_EVENTS_DAYS: 30,
  SESSION_METRICS_DAYS: 7,
  HOURLY_SUMMARIES_DAYS: 90,
  DAILY_SUMMARIES_DAYS: 365,
} as const;

/**
 * Aggregation Configuration
 */
export const AGGREGATION = {
  HOURLY_BATCH_SIZE: 50,
  HOURLY_FLUSH_INTERVAL_MS: 15000,
  SESSION_SAMPLE_RATE: 0.1, // 10% (default, should be per-project)
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: [1000, 2000, 4000],
} as const;

/**
 * Tracking Configuration
 */
export const TRACKING = {
  MAX_EVENTS_PER_BATCH: 100,
  EVENT_DEDUPLICATION_WINDOW_MS: 2000,
  PROJECT_KEY_LENGTH_BYTES: 32, // 256 bits
  RATE_LIMIT_PER_MINUTE: 1000,
} as const;