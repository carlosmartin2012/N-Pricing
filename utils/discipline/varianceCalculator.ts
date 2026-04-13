/**
 * Variance Calculator — computes the deviation between a realized deal
 * and its target grid benchmark.
 *
 * Calculates:
 *   - FTP variance (bps)
 *   - RAROC variance (pp)
 *   - Margin variance (bps)
 *   - Leakage in EUR
 */

import type { Transaction, FTPResult } from '../../types';
import type { DealVariance, Cohort } from '../../types/discipline';
import type { TargetGridCell } from '../../types/targetGrid';

// ---------------------------------------------------------------------------
// Variance computation
// ---------------------------------------------------------------------------

/**
 * Computes the variance between a realized deal result and the target cell.
 */
export function computeVariance(
  deal: Transaction,
  result: FTPResult,
  targetCell: TargetGridCell,
  cohort: Cohort,
  snapshotId: string,
): Omit<DealVariance, 'bandAppliedId' | 'outOfBand' | 'computedAt'> {
  const realizedFtp = result.totalFTP;
  const realizedRaroc = result.raroc;
  const realizedMargin = result.finalClientRate - result.totalFTP;

  const ftpVarianceBps = rateToBps(realizedFtp - targetCell.ftp);
  const rarocVariancePp = rateToPercentagePoints(realizedRaroc - targetCell.targetRaroc);
  const marginVarianceBps = rateToBps(realizedMargin - targetCell.targetMargin);

  const leakageEur = computeLeakage(
    realizedMargin,
    targetCell.targetMargin,
    deal.amount,
    deal.durationMonths,
  );

  return {
    dealId: deal.id ?? '',
    snapshotId,
    cohort,
    targetFtp: targetCell.ftp,
    realizedFtp,
    ftpVarianceBps,
    targetRaroc: targetCell.targetRaroc,
    realizedRaroc,
    rarocVariancePp,
    targetMargin: targetCell.targetMargin,
    realizedMargin,
    marginVarianceBps,
    leakageEur,
  };
}

/**
 * Computes margin leakage in EUR.
 * Leakage = (realized_margin - target_margin) × EAD × tenor_factor
 * Negative leakage means the deal was priced below target.
 */
export function computeLeakage(
  realizedMargin: number,
  targetMargin: number,
  amount: number,
  tenorMonths: number,
): number {
  const marginDiff = realizedMargin - targetMargin;
  const tenorYears = tenorMonths / 12;
  return marginDiff * amount * tenorYears;
}

// ---------------------------------------------------------------------------
// Batch variance computation
// ---------------------------------------------------------------------------

export interface VarianceInput {
  deal: Transaction;
  result: FTPResult;
  cohort: Cohort;
}

/**
 * Computes variances for a batch of deals against a target grid.
 */
export function computeBatchVariances(
  inputs: VarianceInput[],
  cells: TargetGridCell[],
  snapshotId: string,
): Omit<DealVariance, 'bandAppliedId' | 'outOfBand' | 'computedAt'>[] {
  // Index cells for fast lookup
  const cellIndex = new Map<string, TargetGridCell>();
  for (const cell of cells) {
    cellIndex.set(cohortKey(cell), cell);
  }

  const results: Omit<DealVariance, 'bandAppliedId' | 'outOfBand' | 'computedAt'>[] = [];

  for (const input of inputs) {
    const key = cohortKey(input.cohort);
    const targetCell = cellIndex.get(key);

    if (!targetCell) continue; // Skip deals without matching target cell

    results.push(computeVariance(
      input.deal,
      input.result,
      targetCell,
      input.cohort,
      snapshotId,
    ));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/**
 * Aggregates total leakage across multiple variances.
 */
export function aggregateLeakage(
  variances: Pick<DealVariance, 'leakageEur'>[],
): number {
  let total = 0;
  for (const v of variances) {
    total += v.leakageEur ?? 0;
  }
  return total;
}

/**
 * Computes average variance metrics across a set of deal variances.
 */
export function averageVarianceMetrics(
  variances: Pick<DealVariance, 'ftpVarianceBps' | 'rarocVariancePp' | 'marginVarianceBps'>[],
): { avgFtpBps: number; avgRarocPp: number; avgMarginBps: number } {
  if (variances.length === 0) return { avgFtpBps: 0, avgRarocPp: 0, avgMarginBps: 0 };

  let sumFtp = 0;
  let sumRaroc = 0;
  let sumMargin = 0;

  for (const v of variances) {
    sumFtp += v.ftpVarianceBps ?? 0;
    sumRaroc += v.rarocVariancePp ?? 0;
    sumMargin += v.marginVarianceBps ?? 0;
  }

  return {
    avgFtpBps: sumFtp / variances.length,
    avgRarocPp: sumRaroc / variances.length,
    avgMarginBps: sumMargin / variances.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cohortKey(c: { product: string; segment: string; tenorBucket: string; currency: string; entityId?: string }): string {
  return `${c.product}|${c.segment}|${c.tenorBucket}|${c.currency}|${c.entityId ?? ''}`;
}

function rateToBps(rate: number): number {
  return rate * 10_000;
}

function rateToPercentagePoints(rate: number): number {
  return rate * 100;
}
