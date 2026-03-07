// src/shared/utils/weighted-percentile.ts

export interface WeightedValue {
  value: number;
  weight: number;
}

/**
 * Calculate weighted percentile using step-function method (non-interpolated)
 *
 * Returns the smallest value such that cumulative weight >= target weight percentage
 *
 * @param items Array of value-weight pairs
 * @param percentile Percentile to calculate (0-1)
 * @returns The percentile value or 0 if empty
 *
 * @example
 * calculateWeightedQuantileStep([
 *   { value: 10, weight: 30 },
 *   { value: 20, weight: 30 },
 *   { value: 30, weight: 40 }
 * ], 0.5)
 * // Returns 20 (first value where cumulative weight >= 50)
 */
export function calculateWeightedQuantile(
  items: WeightedValue[],
  percentile: number,
): number {
  if (items.length === 0) return 0;
  if (percentile <= 0) return Math.min(...items.map((i) => i.value));
  if (percentile >= 1) return Math.max(...items.map((i) => i.value));

  const filtered = items
    .filter((item) => item.weight > 0 && Number.isFinite(item.value))
    .sort((a, b) => a.value - b.value);

  if (filtered.length === 0) return 0;

  const totalWeight = filtered.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;

  const target = totalWeight * percentile;

  let cumulative = 0;

  for (let i = 0; i < filtered.length; i++) {
    const prevCumulative = cumulative;
    cumulative += filtered[i].weight;

    if (cumulative >= target) {
      if (i === 0) return filtered[i].value;

      const weightSpan = cumulative - prevCumulative;
      const fraction = (target - prevCumulative) / weightSpan;

      const prevValue = filtered[i - 1].value;
      const currentValue = filtered[i].value;

      return prevValue + fraction * (currentValue - prevValue);
    }
  }

  return filtered[filtered.length - 1].value;
}

export function calculateWeightedMedian(items: WeightedValue[]): number {
  return calculateWeightedQuantile(items, 0.5);
}
