# Percentile Calculation Strategy

## Overview

This document defines when to use simple vs weighted percentile calculations across the aggregation pipeline.

## The Rule

- **Simple Percentile**: Use when each value represents the same "mass"
  - Raw events (each event = one measurement)
  - Daily historical series (each day = one unit)
  - System rates (each hour = one unit)

- **Weighted Percentile**: Use when each value summarizes different sample sizes
  - Per-user/session metrics aggregated hourly (each hour has different user count)

## Metric Classification

### Per-User Metrics (Weighted)
- Scroll Depth: Different users per hour
- Visible Time: Different users per hour
- Time on Page: Different users per hour

**Method**: `calculateWeightedQuantileStep(items, percentile)`

### System Rates (Simple)
- CTR: Click-through rate at hour level
- Engagement Score: Derived from hourly rates
- Bounce Rate: Hourly metric

**Method**: `calculatePercentile(values, percentile)`

### Raw Events (Simple)
- LCP, CLS, INP, TTFB: Performance metrics
- Each measurement is equally weighted

**Method**: `calculatePercentile(values, percentile)`

### Daily Historical (Simple)
- Baseline calculations: 30-day historical
- Each day is a uniform unit

**Method**: `calculatePercentile(values, percentile)`

## Weighted Percentile Algorithm

Uses step-function method (non-interpolated):
1. Sort values by value ascending
2. Calculate cumulative weight
3. Return first value where cumulative weight >= target weight

Example:
```
Items: [(value: 10, weight: 30), (value: 20, weight: 30), (value: 30, weight: 40)]
Total weight: 100
Target (p50): 50

Result: 20 (cumulative: 30 + 30 = 60 >= 50)
```

## Implementation Notes

- No interpolation is applied to avoid false precision
- Inputs are already approximations (hourly percentiles)
- Function name clearly indicates algorithm: `calculateWeightedQuantileStep`

## Code Examples

### Correct: Per-User Metric
```typescript
// Scroll depth: weighted because sample sizes differ by hour
const scrollDepthP50 = calculateWeightedQuantileStep(
  hourlyData.map(h => ({
    value: h.scrollDepthP50,
    weight: h.scrollDepthSampleSize
  })),
  0.5
);
```

### Correct: System Rate
```typescript
// CTR: simple because we treat each hour as a unit
const ctrValues = hourlyData.map(h => h.impressions > 0 ? h.clicks / h.impressions : 0);
const ctrP50 = calculatePercentile(ctrValues, 0.5);
```

### Correct: Daily Historical
```typescript
// Baseline: simple because each day is a unit
const engagementValues = dailyMetrics.map(d => d.engagementScore);
const baseline = calculatePercentile(engagementValues, 0.5);
```