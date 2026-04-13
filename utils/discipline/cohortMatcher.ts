/**
 * Cohort Matcher — resolves a deal's cohort (dimension combination)
 * and finds the applicable target grid cell.
 *
 * Given a deal, determines its product × segment × tenor_bucket × currency
 * and looks up the matching cell in the active target grid snapshot.
 */

import type { Transaction } from '../../types';
import type { Cohort } from '../../types/discipline';
import type { TargetGridCell, TenorBucket } from '../../types/targetGrid';
import { TENOR_BUCKETS } from '../../types/targetGrid';

// ---------------------------------------------------------------------------
// Resolve cohort from deal
// ---------------------------------------------------------------------------

/**
 * Maps a deal to its cohort dimensions.
 */
export function resolveCohort(deal: Transaction): Cohort {
  return {
    product: deal.productType,
    segment: resolveSegment(deal),
    tenorBucket: resolveTenorBucket(deal.durationMonths),
    currency: deal.currency,
    entityId: deal.entityId,
  };
}

/**
 * Resolves the segment dimension from deal data.
 * Falls back to clientType if no explicit segment.
 */
function resolveSegment(deal: Transaction): string {
  return deal.clientType || 'Corporate';
}

/**
 * Maps a deal's tenor (months) to a bucket.
 */
export function resolveTenorBucket(months: number): TenorBucket {
  if (months <= 12) return '0-1Y';
  if (months <= 36) return '1-3Y';
  if (months <= 60) return '3-5Y';
  if (months <= 120) return '5-10Y';
  return '10Y+';
}

// ---------------------------------------------------------------------------
// Find matching cell in grid
// ---------------------------------------------------------------------------

/**
 * Finds the target grid cell that matches a deal's cohort.
 * Returns null if no matching cell exists.
 */
export function findMatchingCell(
  cohort: Cohort,
  cells: TargetGridCell[],
): TargetGridCell | null {
  return cells.find(
    (c) =>
      c.product === cohort.product &&
      c.segment === cohort.segment &&
      c.tenorBucket === cohort.tenorBucket &&
      c.currency === cohort.currency &&
      (cohort.entityId == null || c.entityId === cohort.entityId),
  ) ?? null;
}

/**
 * Finds the closest matching cell when an exact match doesn't exist.
 * Uses a scoring system to find the best approximate match.
 */
export function findClosestCell(
  cohort: Cohort,
  cells: TargetGridCell[],
): TargetGridCell | null {
  if (cells.length === 0) return null;

  let bestCell: TargetGridCell | null = null;
  let bestScore = -1;

  for (const cell of cells) {
    let score = 0;
    if (cell.product === cohort.product) score += 4;
    if (cell.segment === cohort.segment) score += 2;
    if (cell.currency === cohort.currency) score += 2;
    if (cell.tenorBucket === cohort.tenorBucket) score += 1;
    if (cohort.entityId && cell.entityId === cohort.entityId) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  return bestCell;
}

/**
 * Validates that a cohort has all required dimensions.
 */
export function isValidCohort(cohort: Cohort): boolean {
  return (
    cohort.product.length > 0 &&
    cohort.segment.length > 0 &&
    TENOR_BUCKETS.includes(cohort.tenorBucket) &&
    cohort.currency.length > 0
  );
}
