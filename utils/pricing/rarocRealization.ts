/**
 * Ex-post RAROC realization — recomputes RAROC for a booked deal using
 * current curves and realized ECL when available.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque F
 *      supabase/migrations/20260501000001_deal_realizations.sql
 *
 * This is the utility that the Edge Function (realize-raroc) would call
 * per deal per month. In the dashboard layer, absent persisted
 * realizations, we fall back to recomputing in-memory with this function.
 */

export type RecomputeMethod = 'SPOT_CURVE' | 'CORE_FEED';

export interface DealRealization {
  dealId: string;
  snapshotDate: string;             // ISO date YYYY-MM-DD
  realizedFtpRate: number;
  realizedMargin: number;
  realizedEcl: number;
  realizedRaroc: number;
  recomputeMethod: RecomputeMethod;
}

export interface RarocEstimates {
  expectedRaroc: number;
  realizedRaroc: number;
  delta: number;                    // pct points
  deltaBp: number;                  // basis points
}

/**
 * Compute MAPE (Mean Absolute Percentage Error) between ex-ante and
 * ex-post RAROC across a population of realizations.
 * Used as KPI in Backtesting dashboard.
 */
export const computeMapeRaroc = (
  pairs: Array<{ expected: number; realized: number }>,
): number => {
  const valid = pairs.filter((p) => Number.isFinite(p.expected) && Number.isFinite(p.realized) && p.expected !== 0);
  if (valid.length === 0) return NaN;
  const sumAbsPctErr = valid.reduce((sum, p) => sum + Math.abs((p.realized - p.expected) / p.expected), 0);
  return (sumAbsPctErr / valid.length) * 100;
};

/**
 * Build a RarocEstimates comparison from expected + realized values.
 */
export const buildEstimates = (expected: number, realized: number): RarocEstimates => {
  const delta = realized - expected;
  return {
    expectedRaroc: expected,
    realizedRaroc: realized,
    delta,
    deltaBp: Math.round(delta * 100),
  };
};

/**
 * Deserialize a row from deal_realizations for dashboard consumption.
 */
export const deserializeRealization = (row: {
  deal_id: string;
  snapshot_date: string;
  realized_ftp_rate?: number | string | null;
  realized_margin?: number | string | null;
  realized_ecl?: number | string | null;
  realized_raroc?: number | string | null;
  recompute_method: string;
}): DealRealization => ({
  dealId: row.deal_id,
  snapshotDate: row.snapshot_date,
  realizedFtpRate: Number(row.realized_ftp_rate ?? 0),
  realizedMargin: Number(row.realized_margin ?? 0),
  realizedEcl: Number(row.realized_ecl ?? 0),
  realizedRaroc: Number(row.realized_raroc ?? 0),
  recomputeMethod: row.recompute_method === 'CORE_FEED' ? 'CORE_FEED' : 'SPOT_CURVE',
});
