import type { Transaction } from '../types';

export interface ConcentrationMetrics {
  dimension: string;
  segments: ConcentrationSegment[];
  hhi: number;
  topN: ConcentrationSegment[];
}

export interface ConcentrationSegment {
  name: string;
  exposure: number;
  share: number;
  dealCount: number;
}

/**
 * Calculate Herfindahl-Hirschman Index (HHI) for a set of exposures.
 * HHI = sum of squared market shares. Range: 0 (perfectly diversified) to 10000 (single name).
 * <1500 = low concentration, 1500-2500 = moderate, >2500 = high.
 */
export function calculateHHI(shares: number[]): number {
  return shares.reduce((sum, s) => sum + (s * 100) ** 2, 0);
}

/**
 * Analyze concentration across a dimension (field extractor).
 */
function analyzeConcentration(
  deals: Transaction[],
  dimension: string,
  extractor: (deal: Transaction) => string,
  topNCount = 5,
): ConcentrationMetrics {
  const booked = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
  const totalExposure = booked.reduce((s, d) => s + (d.amount || 0), 0) || 1;

  const buckets = new Map<string, { exposure: number; count: number }>();
  for (const d of booked) {
    const key = extractor(d) || 'Unknown';
    const prev = buckets.get(key) || { exposure: 0, count: 0 };
    prev.exposure += d.amount || 0;
    prev.count++;
    buckets.set(key, prev);
  }

  const segments: ConcentrationSegment[] = Array.from(buckets.entries())
    .map(([name, v]) => ({
      name,
      exposure: v.exposure,
      share: v.exposure / totalExposure,
      dealCount: v.count,
    }))
    .sort((a, b) => b.exposure - a.exposure);

  const shares = segments.map((s) => s.share);
  const hhi = calculateHHI(shares);
  const topN = segments.slice(0, topNCount);

  return { dimension, segments, hhi, topN };
}

/**
 * Run concentration analysis across all standard dimensions.
 */
export function analyzePortfolioConcentration(deals: Transaction[]): ConcentrationMetrics[] {
  return [
    analyzeConcentration(deals, 'Client', (d) => d.clientId),
    analyzeConcentration(deals, 'Product', (d) => d.productType),
    analyzeConcentration(deals, 'Currency', (d) => d.currency),
    analyzeConcentration(deals, 'Business Unit', (d) => d.businessUnit),
    analyzeConcentration(deals, 'Client Type', (d) => d.clientType),
    analyzeConcentration(deals, 'Category', (d) => d.category),
  ];
}

/** Classify HHI level */
export function classifyHHI(hhi: number): { level: 'low' | 'moderate' | 'high'; color: string } {
  if (hhi < 1500) return { level: 'low', color: 'text-emerald-400' };
  if (hhi < 2500) return { level: 'moderate', color: 'text-amber-400' };
  return { level: 'high', color: 'text-rose-400' };
}
