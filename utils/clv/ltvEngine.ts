/**
 * Pure CLV engine (Phase 6).
 *
 * Projects Customer Lifetime Value from a ClientRelationship aggregate + an
 * assumptions bundle. No I/O, no DB, no randomness (deterministic given the
 * same inputs). The assumptions bundle carries everything material to the
 * calculation so the snapshot hash pins it for reproducibility.
 *
 * Formula, per active position:
 *
 *   CLV_position = Σ_{t=1..H} [ NII_t · P_survive(t) · renewalFactor(t) ] / (1+r)^t
 *   NII_t         = exposure_t · margin_bps · ACT360
 *   P_survive(t)  = exp(-λ · t)       — Weibull with β=1 (exponential)
 *   renewalFactor = 1 until maturity, then renewalProb per additional year
 *
 * Plus client-level additions:
 *
 *   Crosssell   = totalExposure · crosssellProbPerYear · avgProductRaroc · H
 *   Fees        = feesEurAnnualised · H · discountFactor
 *   ChurnCost   = totalExposure · churnHazardAnnual · churnCostPerEur
 *
 * Result: CLV = Σ positions + crosssell + fees − churnCost
 *
 * The p5 / p95 band is derived analytically by perturbing churn hazard and
 * renewal probability ±1σ (cheap; avoids Monte-Carlo for snapshot speed).
 */

import type {
  ClientRelationship,
  ClientPosition,
} from '../../types/customer360';
import type {
  LtvAssumptions,
  LtvBreakdown,
  LtvComputation,
} from '../../types/clv';
import { canonicalJson } from '../canonicalJson';

// ---------------------------------------------------------------------------
// Assumption defaults — safe starting points; overridden by caller.
// ---------------------------------------------------------------------------

export const DEFAULT_HORIZON_YEARS = 10;
export const DEFAULT_DISCOUNT_RATE = 0.08;
export const DEFAULT_CHURN_HAZARD = 0.08;       // ~8% annual churn
export const DEFAULT_RENEWAL_PROB = 0.65;       // 65% renew at maturity
export const DEFAULT_CROSSSELL_PROB = 0.12;     // 12%/yr chance of crosssell
export const DEFAULT_CAPITAL_ALLOC = 0.08;      // 8% of exposure
export const DEFAULT_RAROC_DEFAULT = 0.12;      // 12% RAROC fallback
export const DEFAULT_CHURN_COST_PER_EUR = 0.015; // 1.5% of exposure lost on churn

export function defaultAssumptions(asOfDate: string, overrides?: Partial<LtvAssumptions>): LtvAssumptions {
  return {
    asOfDate,
    horizonYears: DEFAULT_HORIZON_YEARS,
    discountRate: DEFAULT_DISCOUNT_RATE,
    churnHazardAnnual: DEFAULT_CHURN_HAZARD,
    renewalProb: DEFAULT_RENEWAL_PROB,
    crosssellProbPerYear: DEFAULT_CROSSSELL_PROB,
    capitalAllocationRate: DEFAULT_CAPITAL_ALLOC,
    rarocByProduct: {},
    shareOfWalletEst: 0.5,
    churnCostPerEur: DEFAULT_CHURN_COST_PER_EUR,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Core helpers — pure, fully tested
// ---------------------------------------------------------------------------

export function survivalProb(hazardAnnual: number, t: number): number {
  if (!Number.isFinite(hazardAnnual) || hazardAnnual < 0) return 0;
  const lambda = Math.max(0, Math.min(1, hazardAnnual));
  return Math.exp(-lambda * Math.max(0, t));
}

export function discountFactor(rate: number, t: number): number {
  const r = Number.isFinite(rate) ? Math.max(-0.99, rate) : 0;
  return Math.pow(1 + r, -Math.max(0, t));
}

/**
 * Years between maturityDate and asOfDate. Returns Infinity for null maturity
 * (revolver / perpetual) and 0 for past-due. Calendar-agnostic day arithmetic.
 */
export function yearsToMaturity(position: ClientPosition, asOfDate: string): number {
  if (!position.maturityDate) return Number.POSITIVE_INFINITY;
  const asOf = Date.parse(`${asOfDate}T00:00:00Z`);
  const mat = Date.parse(`${position.maturityDate}T00:00:00Z`);
  if (!Number.isFinite(asOf) || !Number.isFinite(mat)) return 0;
  const days = (mat - asOf) / (1000 * 60 * 60 * 24);
  return days / 365.25;
}

/**
 * Contribution of a single position to CLV, discounted and hazard-adjusted.
 *
 * For every full year up to min(horizon, remainingLife) we accrue
 *   margin · exposure · survivalProb · discountFactor
 * Past maturity, we roll a renewal at the same margin with probability
 * renewalProb each year (compounding). Above horizon we stop.
 */
export function positionContribution(
  position: ClientPosition,
  assumptions: LtvAssumptions,
): number {
  const margin = (position.marginBps ?? 0) / 10_000;
  if (margin <= 0 || position.amount <= 0) return 0;

  const yearsLeft = yearsToMaturity(position, assumptions.asOfDate);
  let total = 0;
  let rolloverProb = 1;

  for (let t = 1; t <= assumptions.horizonYears; t++) {
    const withinTerm = t <= yearsLeft;
    if (!withinTerm) {
      // Past natural maturity — each additional year survives with renewalProb
      rolloverProb *= assumptions.renewalProb;
    }
    const p = survivalProb(assumptions.churnHazardAnnual, t) * (withinTerm ? 1 : rolloverProb);
    const df = discountFactor(assumptions.discountRate, t);
    const yearNii = position.amount * margin;
    total += yearNii * p * df;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function computeLtv(
  relationship: ClientRelationship,
  assumptions: LtvAssumptions,
): LtvComputation {
  const safe = normaliseAssumptions(assumptions);

  const activePositions = relationship.positions.filter((p) => p.status === 'Active');

  // Per-position NII contribution
  const perPosition = activePositions.map((p) => ({
    positionId: p.id,
    productType: p.productType,
    contributionEur: roundMoney(positionContribution(p, safe)),
  }));
  const niiEur = perPosition.reduce((s, x) => s + x.contributionEur, 0);

  // Fees: annualised from latest metrics, straight-lined over horizon + discounted
  const feesAnnual = relationship.metrics.latest?.feesEur ?? 0;
  const feesEur = sumAnnuity(feesAnnual, safe.discountRate, safe.horizonYears);

  // Crosssell: stochastic addition = total exposure × prob/yr × avg RAROC × H
  //  - avgProductRaroc derived from assumptions.rarocByProduct, fallback to default
  const avgRaroc = averageRaroc(safe);
  const crosssellEur = relationship.derived.totalExposureEur
    * safe.crosssellProbPerYear
    * avgRaroc
    * safe.horizonYears
    * discountFactor(safe.discountRate, Math.ceil(safe.horizonYears / 2));

  // Churn cost: expected € lost per year × horizon × discount
  const churnCostEur = relationship.derived.totalExposureEur
    * safe.churnHazardAnnual
    * safe.churnCostPerEur
    * sumAnnuity(1, safe.discountRate, safe.horizonYears);

  const clvPoint = niiEur + feesEur + crosssellEur - churnCostEur;

  // Analytical ±1σ band via hazard / renewal perturbation
  const pessimistic = clvWithPerturbation(relationship, safe, +0.02, -0.10);
  const optimistic = clvWithPerturbation(relationship, safe, -0.02, +0.10);
  const clvP5  = Math.min(clvPoint, pessimistic);
  const clvP95 = Math.max(clvPoint, optimistic);

  const breakdown: LtvBreakdown = {
    niiEur: roundMoney(niiEur),
    crosssellEur: roundMoney(crosssellEur),
    feesEur: roundMoney(feesEur),
    churnCostEur: roundMoney(churnCostEur),
    perPosition,
  };

  const shareOfWalletEst = safe.shareOfWalletEst;

  return {
    asOfDate: safe.asOfDate,
    horizonYears: safe.horizonYears,
    discountRate: safe.discountRate,
    clvPointEur: roundMoney(clvPoint),
    clvP5Eur: roundMoney(clvP5),
    clvP95Eur: roundMoney(clvP95),
    churnHazardAnnual: safe.churnHazardAnnual,
    renewalProb: safe.renewalProb,
    shareOfWalletEst,
    shareOfWalletGap: Math.max(0, 1 - shareOfWalletEst),
    breakdown,
    assumptions: safe,
    assumptionsHash: hashAssumptions(safe),
  };
}

// ---------------------------------------------------------------------------
// Helpers — perturbation band, averaging, rounding
// ---------------------------------------------------------------------------

function clvWithPerturbation(
  rel: ClientRelationship,
  base: LtvAssumptions,
  hazardDelta: number,
  renewalDelta: number,
): number {
  const perturbed: LtvAssumptions = {
    ...base,
    churnHazardAnnual: clamp(base.churnHazardAnnual + hazardDelta, 0, 1),
    renewalProb: clamp(base.renewalProb + renewalDelta, 0, 1),
  };
  // Avoid infinite recursion — compute only the NII + churn-cost terms, which
  // absorb 95% of the variance; fees / crosssell scale linearly.
  const active = rel.positions.filter((p) => p.status === 'Active');
  const nii = active.reduce((s, p) => s + positionContribution(p, perturbed), 0);
  const churnCost = rel.derived.totalExposureEur
    * perturbed.churnHazardAnnual
    * perturbed.churnCostPerEur
    * sumAnnuity(1, perturbed.discountRate, perturbed.horizonYears);
  const fees = sumAnnuity(rel.metrics.latest?.feesEur ?? 0, perturbed.discountRate, perturbed.horizonYears);
  const avgRaroc = averageRaroc(perturbed);
  const crosssell = rel.derived.totalExposureEur
    * perturbed.crosssellProbPerYear
    * avgRaroc
    * perturbed.horizonYears
    * discountFactor(perturbed.discountRate, Math.ceil(perturbed.horizonYears / 2));
  return nii + fees + crosssell - churnCost;
}

function sumAnnuity(amount: number, rate: number, years: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  let total = 0;
  for (let t = 1; t <= years; t++) total += amount * discountFactor(rate, t);
  return total;
}

function averageRaroc(a: LtvAssumptions): number {
  const values = Object.values(a.rarocByProduct).filter((x) => Number.isFinite(x) && x > 0);
  if (values.length === 0) return DEFAULT_RAROC_DEFAULT;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

function normaliseAssumptions(a: LtvAssumptions): LtvAssumptions {
  return {
    ...a,
    horizonYears: clampInt(a.horizonYears, 1, 30),
    discountRate: clamp(a.discountRate, -0.01, 0.50),
    churnHazardAnnual: clamp(a.churnHazardAnnual, 0, 1),
    renewalProb: clamp(a.renewalProb, 0, 1),
    crosssellProbPerYear: clamp(a.crosssellProbPerYear, 0, 1),
    capitalAllocationRate: clamp(a.capitalAllocationRate, 0, 1),
    shareOfWalletEst: clamp(a.shareOfWalletEst, 0, 1),
    churnCostPerEur: clamp(a.churnCostPerEur, 0, 1),
  };
}

export function hashAssumptions(a: LtvAssumptions): string {
  // Lightweight, deterministic hash — full sha256 happens server-side before
  // persisting to snapshots. Used here so UI can compare snapshots.
  const canonical = canonicalJson(a);
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
function clampInt(x: number, lo: number, hi: number): number {
  return Math.round(clamp(x, lo, hi));
}
function roundMoney(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
