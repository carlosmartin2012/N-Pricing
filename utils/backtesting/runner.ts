/**
 * Backtesting Runner — applies a target grid (or sandbox methodology)
 * to historical deals and compares simulated vs. actual P&L.
 */

import type { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import type {
  BacktestResult,
  BacktestPeriod,
  BacktestCohort,
} from '../../types/whatIf';
import type { TargetGridCell } from '../../types/targetGrid';
import type { PricingContext, PricingShocks } from '../pricingEngine';
import { calculatePricing } from '../pricingEngine';
import { resolveCohort, findMatchingCell } from '../discipline/cohortMatcher';
import { createLogger } from '../logger';

const log = createLogger('backtesting/runner');

// ---------------------------------------------------------------------------
// Backtest runner
// ---------------------------------------------------------------------------

export interface BacktestInput {
  runId: string;
  deals: (Transaction & { actualResult?: FTPResult })[];
  gridCells: TargetGridCell[];
  pricingContext: PricingContext;
  approvalMatrix: ApprovalMatrixConfig;
  shocks?: PricingShocks;
  dateFrom: string;
  dateTo: string;
}

/**
 * Runs a backtest by re-pricing historical deals with the given methodology
 * and comparing simulated outcomes against actual results.
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const start = Date.now();
  const { runId, deals, gridCells, pricingContext, approvalMatrix, shocks, dateFrom, dateTo } = input;

  // Filter deals to date range
  const filteredDeals = deals.filter((d) => {
    if (!d.startDate) return false;
    return d.startDate >= dateFrom && d.startDate <= dateTo;
  });

  let simulatedPnl = 0;
  let actualPnl = 0;
  let simulatedRarocSum = 0;
  let actualRarocSum = 0;

  // Group by period (month) and cohort for breakdown
  const periodMap = new Map<string, { simulated: number; actual: number; count: number }>();
  const cohortMap = new Map<string, {
    simRateSum: number; actRateSum: number; count: number;
    product: string; segment: string; volume: number;
  }>();

  for (const deal of filteredDeals) {
    // Simulate: reprice with provided context
    const simResult = calculatePricing(deal, approvalMatrix, pricingContext, shocks);
    const simMargin = simResult.finalClientRate - simResult.totalFTP;
    const tenorYears = deal.durationMonths / 12;
    const simPnlDeal = simMargin * deal.amount * tenorYears;

    simulatedPnl += simPnlDeal;
    simulatedRarocSum += simResult.raroc;

    // Actual: use stored result or fallback to target grid
    let actualResult = deal.actualResult;
    if (!actualResult) {
      const cohort = resolveCohort(deal);
      const cell = findMatchingCell(cohort, gridCells);
      if (cell) {
        actualResult = cell.components;
      }
    }

    if (actualResult) {
      const actMargin = actualResult.finalClientRate - actualResult.totalFTP;
      const actPnlDeal = actMargin * deal.amount * tenorYears;
      actualPnl += actPnlDeal;
      actualRarocSum += actualResult.raroc;
    }

    // Period breakdown
    const period = (deal.startDate ?? '').slice(0, 7); // YYYY-MM
    const periodEntry = periodMap.get(period) ?? { simulated: 0, actual: 0, count: 0 };
    periodEntry.simulated += simPnlDeal;
    periodEntry.actual += (actualResult ? (actualResult.finalClientRate - actualResult.totalFTP) * deal.amount * tenorYears : 0);
    periodEntry.count++;
    periodMap.set(period, periodEntry);

    // Cohort breakdown
    const cohortKey = `${deal.productType}|${deal.clientType}`;
    const cohortEntry = cohortMap.get(cohortKey) ?? {
      simRateSum: 0, actRateSum: 0, count: 0,
      product: deal.productType, segment: deal.clientType, volume: 0,
    };
    cohortEntry.simRateSum += simResult.finalClientRate;
    cohortEntry.actRateSum += (actualResult?.finalClientRate ?? 0);
    cohortEntry.count++;
    cohortEntry.volume += deal.amount;
    cohortMap.set(cohortKey, cohortEntry);
  }

  const dealCount = filteredDeals.length;
  const durationMs = Date.now() - start;

  log.info('Backtest complete', { runId, dealCount, durationMs });

  // Build period breakdown
  const periodBreakdown: BacktestPeriod[] = [...periodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({
      period,
      simulatedPnl: data.simulated,
      actualPnl: data.actual,
      delta: data.simulated - data.actual,
      dealCount: data.count,
    }));

  // Build cohort breakdown
  const cohortBreakdown: BacktestCohort[] = [...cohortMap.values()].map((data) => ({
    product: data.product,
    segment: data.segment,
    simulatedAvgRate: data.count > 0 ? data.simRateSum / data.count : 0,
    actualAvgRate: data.count > 0 ? data.actRateSum / data.count : 0,
    rateDeltaBps: data.count > 0
      ? ((data.simRateSum - data.actRateSum) / data.count) * 10_000
      : 0,
    dealCount: data.count,
    volumeEur: data.volume,
  }));

  return {
    runId,
    simulatedPnl,
    actualPnl,
    pnlDelta: simulatedPnl - actualPnl,
    pnlDeltaPct: actualPnl !== 0 ? ((simulatedPnl - actualPnl) / Math.abs(actualPnl)) * 100 : 0,
    simulatedAvgRaroc: dealCount > 0 ? simulatedRarocSum / dealCount : 0,
    actualAvgRaroc: dealCount > 0 ? actualRarocSum / dealCount : 0,
    rarocDeltaPp: dealCount > 0 ? ((simulatedRarocSum - actualRarocSum) / dealCount) * 100 : 0,
    periodBreakdown,
    cohortBreakdown,
  };
}
