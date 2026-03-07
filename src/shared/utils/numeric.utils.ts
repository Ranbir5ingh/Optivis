/**
 * Shared numeric utility functions
 * Ensures consistency across all calculation services
 */

/**
 * Calculate average of number array
 * @returns Average or null if empty array
 */
export function calculateAverage(values: number[]): number  {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate percentile
 * @param values Array of numbers
 * @param p Percentile (0-1)
 * @returns Percentile value or null
 */
export function calculatePercentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Safely parse numeric value from unknown type
 * @param value Unknown value (could be number, string, null)
 * @param defaultValue Value to return if parsing fails
 * @returns Parsed number or default
 */
export function parseNumeric(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Sanitize numeric value to safe bounds
 */
export function sanitizeNumeric(value: number): number {
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value));
}

/**
 * Extract numeric values from array of objects
 * @param items Array of objects
 * @param field Field name to extract
 * @returns Array of valid numbers
 */
export function extractNumericValues<T>(
  items: T[],
  field: keyof T
): number[] {
  return items
    .map((item) => {
      const val = item[field];
      return parseNumeric(val);
    })
    .filter((v) => !isNaN(v) && v !== 0);
}