/**
 * Elasticity Model — calibrates and predicts price-volume relationships.
 *
 * Supports three sources:
 *   - empirical: calibrated from historical deal win/loss data
 *   - expert: manually set by the methodologist
 *   - hybrid: empirical baseline with expert override
 */

import type {
  ElasticityModel,
  ElasticityPrediction,
  ElasticitySource,
} from '../../types/whatIf';
import type { Transaction } from '../../types';
import { createLogger } from '../logger';

const log = createLogger('elasticity/model');

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

/**
 * Predicts volume impact from a price change given an elasticity model.
 *
 * @param model - calibrated elasticity model
 * @param priceDeltaBps - change in client rate (basis points)
 * @returns predicted volume change (%) with optional confidence interval
 */
export function predictVolumeImpact(
  model: ElasticityModel,
  priceDeltaBps: number,
): ElasticityPrediction {
  const volumeDeltaPct = model.slope * priceDeltaBps + model.intercept;

  // Simple confidence interval based on R-squared (if available)
  const confidence = model.rSquared != null && model.rSquared > 0
    ? {
        low: volumeDeltaPct * (1 - (1 - model.rSquared)),
        high: volumeDeltaPct * (1 + (1 - model.rSquared)),
      }
    : undefined;

  return {
    priceDeltaBps,
    volumeDeltaPct,
    confidenceInterval: confidence,
  };
}

// ---------------------------------------------------------------------------
// Calibration from historical data
// ---------------------------------------------------------------------------

export interface DealOutcome {
  deal: Transaction;
  proposedRate: number;
  won: boolean;
  competitorRate?: number;
}

/**
 * Calibrates an elasticity model from historical deal outcomes
 * using simple linear regression on rate delta vs. win/loss.
 *
 * Returns null if insufficient data (< 10 observations).
 */
export function calibrateFromHistory(
  outcomes: DealOutcome[],
  product: string,
  segment: string,
  calibratorEmail: string,
): ElasticityModel | null {
  // Filter to relevant cohort
  const filtered = outcomes.filter(
    (o) => o.deal.productType === product && o.deal.clientType === segment,
  );

  if (filtered.length < 10) {
    log.info('Insufficient data for calibration', { product, segment, count: filtered.length });
    return null;
  }

  // Build dataset: x = rate delta vs competitor (bps), y = win (1) or loss (0)
  const points: { x: number; y: number }[] = [];

  for (const outcome of filtered) {
    if (outcome.competitorRate == null) continue;
    const rateDeltaBps = (outcome.proposedRate - outcome.competitorRate) * 10_000;
    points.push({ x: rateDeltaBps, y: outcome.won ? 1 : 0 });
  }

  if (points.length < 10) return null;

  // Simple linear regression
  const { slope, intercept, rSquared } = linearRegression(points);

  return {
    id: `elasticity-${product}-${segment}-${Date.now()}`,
    product,
    segment,
    slope,
    intercept,
    rSquared,
    source: 'empirical' as ElasticitySource,
    sampleSize: points.length,
    calibratedAt: new Date().toISOString(),
    calibratedByEmail: calibratorEmail,
    validFrom: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Creates an expert-judgment elasticity model.
 */
export function createExpertModel(
  product: string,
  segment: string,
  slope: number,
  intercept: number,
  createdByEmail: string,
  notes?: string,
): ElasticityModel {
  return {
    id: `elasticity-expert-${product}-${segment}-${Date.now()}`,
    product,
    segment,
    slope,
    intercept,
    rSquared: null,
    source: 'expert',
    calibratedAt: new Date().toISOString(),
    calibratedByEmail: createdByEmail,
    validFrom: new Date().toISOString().slice(0, 10),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------

function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared: Math.max(0, rSquared) };
}
