import { DomainError } from 'src/common/exceptions/domain-error';

export function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p < 0 || p > 1) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  
  return Math.sqrt(variance);
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function calculateCumulativeDistribution(zScore: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
  const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return zScore > 0 ? 1 - prob : prob;
}

export function detectAnomalies(values: number[], threshold: number): { anomalies: number[], zScores: number[] } {
  if (values.length === 0) {
    return { anomalies: [], zScores: [] };
  }
  
  const mean = calculateMean(values);
  const stdDev = calculateStandardDeviation(values);
  
  const zScores = values.map(v => calculateZScore(v, mean, stdDev));
  const anomalies = values.filter((_, i) => Math.abs(zScores[i]) > threshold);
  
  return { anomalies, zScores };
}

export function findChangePoints(timeSeries: number[]): number[] {
  if (timeSeries.length < 3) return [];
  
  const changePoints: number[] = [];
  const windowSize = Math.max(3, Math.floor(timeSeries.length / 10));
  
  for (let i = windowSize; i < timeSeries.length - windowSize; i++) {
    const before = timeSeries.slice(Math.max(0, i - windowSize), i);
    const after = timeSeries.slice(i, Math.min(timeSeries.length, i + windowSize));
    
    const meanBefore = calculateMean(before);
    const meanAfter = calculateMean(after);
    const stdBefore = calculateStandardDeviation(before);
    const stdAfter = calculateStandardDeviation(after);
    
    const pooledStd = Math.sqrt((stdBefore * stdBefore + stdAfter * stdAfter) / 2);
    
    if (pooledStd === 0) continue;
    
    const zScore = Math.abs(meanAfter - meanBefore) / pooledStd;
    
    if (zScore > 2) {
      changePoints.push(i);
    }
  }
  
  return changePoints;
}