/**
 * Generic linear interpolation on a sorted array of {x, y} points.
 * Returns the interpolated y value for the given target x.
 * Clamps to boundary values if target is outside the range.
 */
export function linearInterpolate(
  points: { x: number; y: number }[],
  targetX: number,
): number {
  if (!points || points.length === 0) return 0;
  if (targetX <= points[0].x) return points[0].y;
  if (targetX >= points[points.length - 1].x) return points[points.length - 1].y;

  const upperIdx = points.findIndex(p => p.x >= targetX);
  if (upperIdx <= 0) return points[0].y;

  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const denom = upper.x - lower.x;
  if (denom === 0) return upper.y;
  const ratio = (targetX - lower.x) / denom;
  return lower.y + ratio * (upper.y - lower.y);
}

/**
 * Pre-sorts and maps curve points for interpolation.
 * Call this ONCE before a batch loop, then use linearInterpolate on the result.
 *
 * Points whose tenor is not present in `tenorMonths` are dropped rather than
 * coerced to month 0 — silently mapping unknown tenors onto the ON bucket
 * corrupts interpolation on every curve that passes through.
 */
export function prepareYieldCurvePoints(
  curve: { tenor: string; rate: number }[],
  tenorMonths: Record<string, number>,
): { x: number; y: number }[] {
  return curve
    .filter(p => p.tenor in tenorMonths)
    .map(p => ({ x: tenorMonths[p.tenor], y: p.rate }))
    .sort((a, b) => a.x - b.x);
}

export function prepareLiquidityCurvePoints(
  points: { tenor: string; termLP: number }[],
  tenorMonths: Record<string, number>,
): { x: number; y: number }[] {
  return points
    .filter(p => p.tenor in tenorMonths)
    .map(p => ({ x: tenorMonths[p.tenor], y: p.termLP }))
    .sort((a, b) => a.x - b.x);
}
