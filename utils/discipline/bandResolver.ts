/**
 * Band Resolver — finds the applicable tolerance band for a deal's cohort.
 *
 * Follows a priority-based matching strategy similar to ruleMatchingEngine:
 *   - Lower priority number wins
 *   - More specific bands (with more dimension constraints) take precedence
 *   - Only active bands within their effective date range are considered
 */

import type { ToleranceBand, Cohort, DealVariance } from '../../types/discipline';

// ---------------------------------------------------------------------------
// Band resolution
// ---------------------------------------------------------------------------

/**
 * Finds the applicable tolerance band for a given cohort.
 * Uses priority-based matching with most-specific-wins tiebreaker.
 */
export function resolveToleranceBand(
  cohort: Cohort,
  bands: ToleranceBand[],
  asOfDate?: Date,
): ToleranceBand | null {
  const refDate = asOfDate ?? new Date();
  const candidates = bands
    .filter((b) => isBandActive(b, refDate))
    .filter((b) => isBandApplicable(b, cohort))
    .sort((a, b) => {
      // Lower priority number wins
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Tiebreaker: more specific band wins (count non-null dimensions)
      return specificity(b) - specificity(a);
    });

  return candidates[0] ?? null;
}

/**
 * Checks whether a deal variance is out of band given a tolerance band.
 */
export function isOutOfBand(
  variance: Pick<DealVariance, 'ftpVarianceBps' | 'rarocVariancePp' | 'marginVarianceBps'>,
  band: ToleranceBand,
): boolean {
  const ftpOut = variance.ftpVarianceBps != null &&
    Math.abs(variance.ftpVarianceBps) > band.ftpBpsTolerance;

  const rarocOut = variance.rarocVariancePp != null &&
    Math.abs(variance.rarocVariancePp) > band.rarocPpTolerance;

  const marginOut = band.marginBpsTolerance != null &&
    variance.marginVarianceBps != null &&
    Math.abs(variance.marginVarianceBps) > band.marginBpsTolerance;

  return ftpOut || rarocOut || marginOut;
}

/**
 * Applies band resolution and out-of-band check to a variance.
 * Returns the enriched variance with band info.
 */
export function applyBandToVariance(
  variance: Omit<DealVariance, 'bandAppliedId' | 'outOfBand' | 'computedAt'>,
  bands: ToleranceBand[],
  asOfDate?: Date,
): Omit<DealVariance, 'computedAt'> {
  const band = resolveToleranceBand(variance.cohort, bands, asOfDate);

  if (!band) {
    return { ...variance, bandAppliedId: undefined, outOfBand: false };
  }

  return {
    ...variance,
    bandAppliedId: band.id,
    outOfBand: isOutOfBand(variance, band),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isBandActive(band: ToleranceBand, date: Date): boolean {
  if (!band.active) return false;

  const from = new Date(band.effectiveFrom);
  if (date < from) return false;

  if (band.effectiveTo) {
    const to = new Date(band.effectiveTo);
    if (date > to) return false;
  }

  return true;
}

function isBandApplicable(band: ToleranceBand, cohort: Cohort): boolean {
  if (band.product && band.product !== cohort.product) return false;
  if (band.segment && band.segment !== cohort.segment) return false;
  if (band.tenorBucket && band.tenorBucket !== cohort.tenorBucket) return false;
  if (band.currency && band.currency !== cohort.currency) return false;
  if (band.entityId && band.entityId !== cohort.entityId) return false;
  return true;
}

/**
 * Counts the number of specific (non-null) dimension constraints in a band.
 * Higher specificity means the band is more targeted.
 */
function specificity(band: ToleranceBand): number {
  let score = 0;
  if (band.product) score++;
  if (band.segment) score++;
  if (band.tenorBucket) score++;
  if (band.currency) score++;
  if (band.entityId) score++;
  return score;
}
