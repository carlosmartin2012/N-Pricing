/**
 * Leakage Aggregator — aggregates margin leakage by any dimension
 * for KPI dashboards and drill-down analytics.
 */

import type { DealVariance, Cohort, DisciplineKpis } from '../../types/discipline';

// ---------------------------------------------------------------------------
// Aggregation by dimension
// ---------------------------------------------------------------------------

export type AggregationDimension = 'product' | 'segment' | 'tenorBucket' | 'currency' | 'entityId';

export interface DimensionAggregate {
  dimension: AggregationDimension;
  value: string;
  dealCount: number;
  inBandCount: number;
  outOfBandCount: number;
  totalLeakageEur: number;
  avgFtpVarianceBps: number;
  avgRarocVariancePp: number;
}

/**
 * Aggregates variances by a selected dimension.
 */
export function aggregateByDimension(
  variances: DealVariance[],
  dimension: AggregationDimension,
): DimensionAggregate[] {
  const groups = new Map<string, DealVariance[]>();

  for (const v of variances) {
    const key = dimensionValue(v.cohort, dimension);
    const group = groups.get(key);
    if (group) {
      group.push(v);
    } else {
      groups.set(key, [v]);
    }
  }

  const result: DimensionAggregate[] = [];

  for (const [value, group] of groups) {
    let totalLeakage = 0;
    let sumFtpVariance = 0;
    let sumRarocVariance = 0;
    let inBand = 0;
    let outOfBand = 0;

    for (const v of group) {
      totalLeakage += v.leakageEur ?? 0;
      sumFtpVariance += v.ftpVarianceBps ?? 0;
      sumRarocVariance += v.rarocVariancePp ?? 0;
      if (v.outOfBand) outOfBand++;
      else inBand++;
    }

    result.push({
      dimension,
      value,
      dealCount: group.length,
      inBandCount: inBand,
      outOfBandCount: outOfBand,
      totalLeakageEur: totalLeakage,
      avgFtpVarianceBps: group.length > 0 ? sumFtpVariance / group.length : 0,
      avgRarocVariancePp: group.length > 0 ? sumRarocVariance / group.length : 0,
    });
  }

  return result.sort((a, b) => Math.abs(b.totalLeakageEur) - Math.abs(a.totalLeakageEur));
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

/**
 * Computes the discipline KPIs from a set of variances.
 */
export function computeKpis(
  variances: DealVariance[],
  previousPeriodLeakage?: number,
): DisciplineKpis {
  const totalDeals = variances.length;
  if (totalDeals === 0) {
    return {
      totalDeals: 0,
      inBandCount: 0,
      inBandPct: 0,
      outOfBandCount: 0,
      totalLeakageEur: 0,
      leakageTrend: 0,
      avgFtpVarianceBps: 0,
      avgRarocVariancePp: 0,
    };
  }

  let inBandCount = 0;
  let totalLeakage = 0;
  let sumFtp = 0;
  let sumRaroc = 0;

  for (const v of variances) {
    if (!v.outOfBand) inBandCount++;
    totalLeakage += v.leakageEur ?? 0;
    sumFtp += v.ftpVarianceBps ?? 0;
    sumRaroc += v.rarocVariancePp ?? 0;
  }

  const outOfBandCount = totalDeals - inBandCount;
  const leakageTrend = previousPeriodLeakage && previousPeriodLeakage !== 0
    ? ((totalLeakage - previousPeriodLeakage) / Math.abs(previousPeriodLeakage)) * 100
    : 0;

  return {
    totalDeals,
    inBandCount,
    inBandPct: (inBandCount / totalDeals) * 100,
    outOfBandCount,
    totalLeakageEur: totalLeakage,
    leakageTrend,
    avgFtpVarianceBps: sumFtp / totalDeals,
    avgRarocVariancePp: sumRaroc / totalDeals,
  };
}

// ---------------------------------------------------------------------------
// Top outliers
// ---------------------------------------------------------------------------

/**
 * Returns the top N deals by absolute leakage.
 */
export function topOutliers(
  variances: DealVariance[],
  n: number = 10,
): DealVariance[] {
  return [...variances]
    .filter((v) => v.outOfBand)
    .sort((a, b) => Math.abs(b.leakageEur ?? 0) - Math.abs(a.leakageEur ?? 0))
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dimensionValue(cohort: Cohort, dim: AggregationDimension): string {
  switch (dim) {
    case 'product':
      return cohort.product;
    case 'segment':
      return cohort.segment;
    case 'tenorBucket':
      return cohort.tenorBucket;
    case 'currency':
      return cohort.currency;
    case 'entityId':
      return cohort.entityId ?? 'unknown';
  }
}
