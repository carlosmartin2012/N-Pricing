import type { Transaction } from '../types';

export interface BacktestResult {
  dealId: string;
  clientId: string;
  productType: string;
  pricedFTP: number;
  realizedRate: number;
  deviation: number;
  deviationBps: number;
  isWithinTolerance: boolean;
}

export interface BacktestSummary {
  totalDeals: number;
  meanDeviation: number;
  meanAbsDeviation: number;
  rmse: number;
  withinToleranceCount: number;
  withinTolerancePct: number;
  bySegment: BacktestSegment[];
}

export interface BacktestSegment {
  segment: string;
  count: number;
  meanDeviation: number;
  accuracyPct: number;
}

const TOLERANCE_BPS = 25;

/**
 * Run backtesting on booked deals: compare the FTP rate at booking
 * against a simulated "realized" rate (for demo, derived from the deal's
 * actual margin and market movements).
 *
 * In production, this would compare against actual P&L / realized funding costs.
 */
export function runBacktest(
  deals: Transaction[],
  toleranceBps: number = TOLERANCE_BPS,
): { results: BacktestResult[]; summary: BacktestSummary } {
  const booked = deals.filter((d) => d.status === 'Booked' && d.id);

  const results: BacktestResult[] = booked.map((deal) => {
    const pricedFTP = deal.marginTarget || 0;
    // Simulated realized rate: FTP + random noise ±30bps
    // In production: replace with actual realized funding cost
    const seed = hashCode(deal.id || '');
    const noise = ((seed % 61) - 30) / 100; // -0.30% to +0.30%
    const realizedRate = pricedFTP + noise;
    const deviation = realizedRate - pricedFTP;
    const deviationBps = deviation * 100;

    return {
      dealId: deal.id!,
      clientId: deal.clientId,
      productType: deal.productType,
      pricedFTP,
      realizedRate,
      deviation,
      deviationBps,
      isWithinTolerance: Math.abs(deviationBps) <= toleranceBps,
    };
  });

  const n = results.length || 1;
  const meanDev = results.reduce((s, r) => s + r.deviation, 0) / n;
  const meanAbsDev = results.reduce((s, r) => s + Math.abs(r.deviation), 0) / n;
  const rmse = Math.sqrt(results.reduce((s, r) => s + r.deviation ** 2, 0) / n);
  const withinCount = results.filter((r) => r.isWithinTolerance).length;

  // Group by client type / product for segment analysis
  const segmentMap = new Map<string, BacktestResult[]>();
  for (const r of results) {
    const seg = r.productType;
    const arr = segmentMap.get(seg) || [];
    arr.push(r);
    segmentMap.set(seg, arr);
  }

  const bySegment: BacktestSegment[] = Array.from(segmentMap.entries()).map(([segment, items]) => ({
    segment,
    count: items.length,
    meanDeviation: items.reduce((s, r) => s + r.deviation, 0) / items.length,
    accuracyPct: (items.filter((r) => r.isWithinTolerance).length / items.length) * 100,
  }));

  return {
    results,
    summary: {
      totalDeals: results.length,
      meanDeviation: meanDev,
      meanAbsDeviation: meanAbsDev,
      rmse,
      withinToleranceCount: withinCount,
      withinTolerancePct: results.length > 0 ? (withinCount / results.length) * 100 : 0,
      bySegment,
    },
  };
}

/** Simple deterministic hash for consistent simulated noise */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
