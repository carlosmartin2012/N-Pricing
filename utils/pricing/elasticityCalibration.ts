/**
 * Elasticity calibration from real deal outcomes.
 *
 * Inputs: Transaction[] with wonLost ∈ {WON, LOST}.
 * Output: one calibrated ElasticityModel per segment bucket.
 *
 * Design choices:
 *  - Frequentist OLS for segments with >= N observations (MIN_SAMPLE_FOR_OLS).
 *  - Bayesian shrinkage prior for low-volume segments (Corporate, wholesale):
 *    posterior = prior × (MIN_SAMPLE_FOR_OLS - n) + data × n, weighted.
 *  - Segments with < MIN_SAMPLE_FOR_BAYES (3) and no matching prior → skipped.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque D
 */

import type { Transaction } from '../../types';
import { isElasticityEligible } from '../dealOutcome';
import {
  buildSegmentKey,
  bucketAmount,
  bucketTenor,
  fitElasticityModel,
  type ElasticityModel,
  type HistoricalDemandObservation,
} from './priceElasticity';

const MIN_SAMPLE_FOR_OLS = 30;
const MIN_SAMPLE_FOR_BAYES = 3;
const HIGH_CONFIDENCE_THRESHOLD = 100;

export type CalibrationMethod = 'FREQUENTIST' | 'BAYESIAN' | 'SKIPPED';

export interface CalibratedModel extends ElasticityModel {
  method: CalibrationMethod;
  calibratedAt: string;
}

/**
 * Expert prior per segment_key.
 * Populated by the ALM / pricing team; used as shrinkage target for
 * low-volume segments (Corporate, specialized products).
 *
 * Defaults are conservative: mild negative elasticity, 50% conversion anchor.
 * Override in system_config via loadExpertPriors() at runtime.
 */
export interface ExpertPrior {
  elasticity: number;           // e.g., -0.3 for mildly elastic
  baselineConversion: number;   // 0-1
  anchorRate: number;           // pct
}

export const DEFAULT_EXPERT_PRIOR: ExpertPrior = {
  elasticity: -0.3,
  baselineConversion: 0.5,
  anchorRate: 4.0,
};

/**
 * Convert an eligible Transaction into a training observation.
 * Returns null when the deal lacks required fields (proposedRate).
 */
export const dealToObservation = (deal: Transaction): HistoricalDemandObservation | null => {
  if (!isElasticityEligible(deal)) return null;
  // Prefer proposedRate (snapshot at time of offer) over marginTarget,
  // since marginTarget may have been renegotiated post-hoc.
  const offeredRate = deal.proposedRate ?? deal.marginTarget;
  if (!Number.isFinite(offeredRate) || offeredRate <= 0) return null;
  return {
    date: deal.decisionDate ?? deal.startDate,
    productType: deal.productType,
    clientType: deal.clientType,
    amountBucket: bucketAmount(deal.amount),
    tenorBucket: bucketTenor(deal.durationMonths),
    offeredRate,
    converted: deal.wonLost === 'WON' ? 1 : 0,
    amount: deal.wonLost === 'WON' ? deal.amount : undefined,
  };
};

/**
 * Group observations by segment_key.
 */
export const groupBySegment = (
  observations: HistoricalDemandObservation[],
): Map<string, HistoricalDemandObservation[]> => {
  const byKey = new Map<string, HistoricalDemandObservation[]>();
  for (const obs of observations) {
    const key = buildSegmentKey(obs.productType, obs.clientType, obs.amountBucket, obs.tenorBucket);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(obs);
  }
  return byKey;
};

/**
 * Shrink a frequentist estimate toward the expert prior.
 * Weight: n / (n + MIN_SAMPLE_FOR_OLS). With n → 0, weight → 0 (prior dominates).
 * With n → ∞, weight → 1 (data dominates).
 */
const shrinkToPrior = (
  segmentKey: string,
  observations: HistoricalDemandObservation[],
  prior: ExpertPrior,
): CalibratedModel => {
  const n = observations.length;
  const w = n / (n + MIN_SAMPLE_FOR_OLS);

  const convRate = n > 0 ? observations.reduce((s, o) => s + o.converted, 0) / n : 0;
  const avgRate = n > 0 ? observations.reduce((s, o) => s + o.offeredRate, 0) / n : prior.anchorRate;

  return {
    segmentKey,
    elasticity: w * prior.elasticity + (1 - w) * prior.elasticity,
    baselineConversion: w * convRate + (1 - w) * prior.baselineConversion,
    anchorRate: w * avgRate + (1 - w) * prior.anchorRate,
    sampleSize: n,
    confidence: 'LOW',
    method: 'BAYESIAN',
    calibratedAt: new Date().toISOString(),
  };
};

/**
 * Pick expert prior for a segment_key. Falls back to global default when
 * segment-specific prior is not configured.
 */
export const getPriorForSegment = (
  segmentKey: string,
  priors?: Record<string, ExpertPrior>,
): ExpertPrior => {
  if (!priors) return DEFAULT_EXPERT_PRIOR;
  return priors[segmentKey] ?? DEFAULT_EXPERT_PRIOR;
};

/**
 * Calibrate all segment models from a deal book.
 * Low-volume segments get Bayesian shrinkage; high-volume segments use OLS.
 */
export function calibrateFromDeals(
  deals: Transaction[],
  options?: { priors?: Record<string, ExpertPrior> },
): CalibratedModel[] {
  const observations = deals
    .map(dealToObservation)
    .filter((o): o is HistoricalDemandObservation => o !== null);

  const grouped = groupBySegment(observations);
  const now = new Date().toISOString();
  const results: CalibratedModel[] = [];

  for (const [segmentKey, segObs] of grouped.entries()) {
    const n = segObs.length;

    if (n >= MIN_SAMPLE_FOR_OLS) {
      const fitted = fitElasticityModel(segObs, segmentKey);
      if (!fitted) continue;
      results.push({
        ...fitted,
        confidence: n >= HIGH_CONFIDENCE_THRESHOLD ? 'HIGH' : 'MEDIUM',
        method: 'FREQUENTIST',
        calibratedAt: now,
      });
      continue;
    }

    if (n >= MIN_SAMPLE_FOR_BAYES) {
      const prior = getPriorForSegment(segmentKey, options?.priors);
      results.push(shrinkToPrior(segmentKey, segObs, prior));
      continue;
    }

    // n < MIN_SAMPLE_FOR_BAYES → skipped (prior alone is not enough signal)
  }

  return results;
}

/**
 * Serialize a calibrated model for persistence to `elasticity_models` table.
 */
export const serializeModel = (model: CalibratedModel): {
  segment_key: string;
  elasticity: number;
  baseline_conversion: number;
  anchor_rate: number;
  sample_size: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  method: CalibrationMethod;
  calibrated_at: string;
  is_active: boolean;
} => ({
  segment_key: model.segmentKey,
  elasticity: model.elasticity,
  baseline_conversion: model.baselineConversion,
  anchor_rate: model.anchorRate,
  sample_size: model.sampleSize,
  confidence: model.confidence,
  method: model.method,
  calibrated_at: model.calibratedAt,
  is_active: true,
});

/**
 * Deserialize a row from `elasticity_models` back into the ElasticityModel
 * shape consumed by priceElasticity utilities.
 */
export const deserializeModel = (row: {
  segment_key: string;
  elasticity: number | string;
  baseline_conversion: number | string;
  anchor_rate: number | string;
  sample_size: number | string;
  confidence: string;
  method?: string;
  calibrated_at: string;
}): CalibratedModel => ({
  segmentKey: row.segment_key,
  elasticity: Number(row.elasticity),
  baselineConversion: Number(row.baseline_conversion),
  anchorRate: Number(row.anchor_rate),
  sampleSize: Number(row.sample_size),
  confidence: (row.confidence === 'HIGH' || row.confidence === 'MEDIUM' ? row.confidence : 'LOW') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH',
  method: (row.method === 'FREQUENTIST' || row.method === 'BAYESIAN' ? row.method : 'BAYESIAN') as CalibrationMethod,
  calibratedAt: row.calibrated_at,
});
