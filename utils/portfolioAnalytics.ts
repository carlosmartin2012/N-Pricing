/**
 * Portfolio Analytics (Gap 13)
 * LP summary by BU: net LP (assets - liabilities), weighted average maturity,
 * deposit stability breakdown, and LR allocation.
 */

import { Transaction, FTPResult } from '../types';

export interface BUPortfolioSummary {
  buId: string;
  buName: string;
  totalAssets: number;
  totalLiabilities: number;
  netLP: number;           // weighted avg LP (assets) - weighted avg LP (liabilities) in bps
  avgMaturityMonths: number;
  dealCount: number;
  stableDepositPct: number;
  lrAllocation: number;    // bps allocated via LR config
}

/**
 * Calculate portfolio LP summary grouped by Business Unit.
 */
export function calculatePortfolioSummary(
  deals: Transaction[],
  results: Map<string, FTPResult>,
  buAllocations: Record<string, number>,
  totalLRCostBps: number,
): BUPortfolioSummary[] {
  const buMap = new Map<string, {
    assets: { amount: number; lp: number; months: number }[];
    liabilities: { amount: number; lp: number; months: number; stability?: string }[];
  }>();

  for (const deal of deals) {
    const buId = deal.businessUnit;
    if (!buMap.has(buId)) {
      buMap.set(buId, { assets: [], liabilities: [] });
    }
    const bucket = buMap.get(buId)!;
    const result = results.get(deal.id || '');
    const lp = result ? result._liquidityPremiumDetails * 100 : 0; // % → bps

    if (deal.category === 'Asset') {
      bucket.assets.push({ amount: deal.amount, lp, months: deal.durationMonths });
    } else if (deal.category === 'Liability') {
      bucket.liabilities.push({
        amount: deal.amount,
        lp: Math.abs(lp),
        months: deal.durationMonths,
        stability: deal.depositStability,
      });
    }
  }

  const summaries: BUPortfolioSummary[] = [];

  for (const [buId, bucket] of buMap) {
    const totalAssetAmt = bucket.assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabAmt = bucket.liabilities.reduce((s, l) => s + l.amount, 0);

    const weightedAssetLP = totalAssetAmt > 0
      ? bucket.assets.reduce((s, a) => s + a.lp * a.amount, 0) / totalAssetAmt
      : 0;
    const weightedLiabLP = totalLiabAmt > 0
      ? bucket.liabilities.reduce((s, l) => s + l.lp * l.amount, 0) / totalLiabAmt
      : 0;

    const allDeals = [...bucket.assets, ...bucket.liabilities];
    const totalAmt = totalAssetAmt + totalLiabAmt;
    const avgMaturity = totalAmt > 0
      ? allDeals.reduce((s, d) => s + d.months * d.amount, 0) / totalAmt
      : 0;

    const stableCount = bucket.liabilities.filter(
      l => l.stability === 'Stable' || l.stability === 'Semi_Stable',
    ).length;
    const stablePct = bucket.liabilities.length > 0
      ? (stableCount / bucket.liabilities.length) * 100
      : 0;

    const allocation = buAllocations[buId] || 0;
    const lrAllocation = totalLRCostBps * allocation;

    summaries.push({
      buId,
      buName: buId, // caller can resolve name
      totalAssets: totalAssetAmt,
      totalLiabilities: totalLiabAmt,
      netLP: weightedAssetLP - weightedLiabLP,
      avgMaturityMonths: avgMaturity,
      dealCount: allDeals.length,
      stableDepositPct: stablePct,
      lrAllocation,
    });
  }

  return summaries;
}
