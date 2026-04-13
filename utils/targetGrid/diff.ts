/**
 * Diff — computes cell-by-cell differences between two target grid snapshots.
 *
 * Used for:
 *   - Governance: preview impact of methodology change before approval
 *   - History: compare any two snapshots
 *   - Audit: document what changed and by how much
 */

import type { TargetGridCell, GridDiff, DiffThresholds } from '../../types/targetGrid';
import { DEFAULT_DIFF_THRESHOLDS } from '../../types/targetGrid';

// ---------------------------------------------------------------------------
// Core diff logic
// ---------------------------------------------------------------------------

/**
 * Computes a cell-by-cell diff between two sets of grid cells.
 *
 * @param fromCells - cells from the "before" snapshot
 * @param toCells   - cells from the "after" snapshot
 * @param thresholds - significance thresholds (default: 5bp FTP, 0.5pp RAROC)
 */
export function diffGridCells(
  fromCells: TargetGridCell[],
  toCells: TargetGridCell[],
  thresholds: DiffThresholds = DEFAULT_DIFF_THRESHOLDS,
): GridDiff[] {
  const fromIndex = indexCells(fromCells);
  const toIndex = indexCells(toCells);
  const allKeys = new Set([...fromIndex.keys(), ...toIndex.keys()]);
  const diffs: GridDiff[] = [];

  for (const key of allKeys) {
    const fromCell = fromIndex.get(key) ?? null;
    const toCell = toIndex.get(key) ?? null;

    const diff = computeCellDiff(fromCell, toCell, thresholds);
    diffs.push(diff);
  }

  return diffs;
}

/**
 * Filters diffs to only significant changes (those exceeding thresholds).
 */
export function filterSignificantDiffs(diffs: GridDiff[]): GridDiff[] {
  return diffs.filter((d) => d.isSignificant || d.isNew || d.isRemoved);
}

/**
 * Summarizes diff statistics across all cells.
 */
export function summarizeDiff(diffs: GridDiff[]): DiffSummary {
  let newCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let totalFtpChangeBps = 0;
  let totalRarocChangePp = 0;

  for (const d of diffs) {
    if (d.isNew) newCount++;
    else if (d.isRemoved) removedCount++;
    else if (d.isSignificant) changedCount++;
    else unchangedCount++;

    totalFtpChangeBps += Math.abs(d.ftpDiffBps);
    totalRarocChangePp += Math.abs(d.rarocDiffPp);
  }

  return {
    totalCells: diffs.length,
    newCount,
    removedCount,
    changedCount,
    unchangedCount,
    avgFtpChangeBps: diffs.length > 0 ? totalFtpChangeBps / diffs.length : 0,
    avgRarocChangePp: diffs.length > 0 ? totalRarocChangePp / diffs.length : 0,
  };
}

export interface DiffSummary {
  totalCells: number;
  newCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  avgFtpChangeBps: number;
  avgRarocChangePp: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cellKey(cell: Pick<TargetGridCell, 'product' | 'segment' | 'tenorBucket' | 'currency' | 'entityId'>): string {
  return `${cell.product}|${cell.segment}|${cell.tenorBucket}|${cell.currency}|${cell.entityId ?? ''}`;
}

function indexCells(cells: TargetGridCell[]): Map<string, TargetGridCell> {
  const map = new Map<string, TargetGridCell>();
  for (const cell of cells) {
    map.set(cellKey(cell), cell);
  }
  return map;
}

function computeCellDiff(
  fromCell: TargetGridCell | null,
  toCell: TargetGridCell | null,
  thresholds: DiffThresholds,
): GridDiff {
  const ref = toCell ?? fromCell!;

  const ftpDiffBps = toBps(toCell?.ftp, fromCell?.ftp);
  const marginDiffBps = toBps(toCell?.targetMargin, fromCell?.targetMargin);
  const clientRateDiffBps = toBps(toCell?.targetClientRate, fromCell?.targetClientRate);
  const rarocDiffPp = toPp(toCell?.targetRaroc, fromCell?.targetRaroc);

  const isNew = fromCell === null && toCell !== null;
  const isRemoved = fromCell !== null && toCell === null;
  const isSignificant = !isNew && !isRemoved && (
    Math.abs(ftpDiffBps) > thresholds.ftpBps ||
    Math.abs(marginDiffBps) > thresholds.marginBps ||
    Math.abs(clientRateDiffBps) > thresholds.clientRateBps ||
    Math.abs(rarocDiffPp) > thresholds.rarocPp
  );

  return {
    product: ref.product,
    segment: ref.segment,
    tenorBucket: ref.tenorBucket,
    currency: ref.currency,
    entityId: ref.entityId,
    fromCell,
    toCell,
    ftpDiffBps,
    marginDiffBps,
    clientRateDiffBps,
    rarocDiffPp,
    isNew,
    isRemoved,
    isSignificant,
  };
}

/** Convert two rate values to basis points difference */
function toBps(toVal: number | undefined | null, fromVal: number | undefined | null): number {
  const to = toVal ?? 0;
  const from = fromVal ?? 0;
  return (to - from) * 10_000;
}

/** Convert two RAROC values to percentage points difference */
function toPp(toVal: number | undefined | null, fromVal: number | undefined | null): number {
  const to = toVal ?? 0;
  const from = fromVal ?? 0;
  return (to - from) * 100;
}
