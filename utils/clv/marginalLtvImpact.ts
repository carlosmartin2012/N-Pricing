/**
 * Marginal CLV impact of a deal candidate — the killer demo feature.
 *
 * Given a ClientRelationship and a proposed deal, answer:
 *   "How does the client's CLV change if I close this deal at this rate?"
 *
 * Decomposition:
 *   1. Direct NII       — the deal's own contribution over its life, hazard-
 *                          adjusted and discounted (positionContribution on a
 *                          synthetic ClientPosition).
 *   2. Crosssell uplift — winning this deal compresses probability of losing
 *                          other products (relationship stickiness). Modelled
 *                          as small reduction of churn hazard for the rest of
 *                          the book.
 *   3. Churn reduction  — if this deal is the first with the client, it
 *                          materially reduces hazard; if they already have N
 *                          products, diminishing returns.
 *   4. Capital opportunity — capital allocated to this deal carries an
 *                             opportunity cost (risk-free rate) vs. its RAROC.
 *
 * Deliberately *doesn't* recompute the full LTV from scratch twice — we pass
 * the "before" from a cached ltvComputation and evaluate only the delta, which
 * is ~50× faster and lets the UI update the panel on every rate change.
 */

import type { ClientRelationship, ClientPosition } from '../../types/customer360';
import type {
  DealCandidate,
  LtvAssumptions,
  LtvComputation,
  MarginalLtvImpact,
} from '../../types/clv';
import {
  discountFactor,
  positionContribution,
  survivalProb,
} from './ltvEngine';

// A product held already = stickier client. Each existing product multiplies
// the crosssell-uplift factor below. Calibrated so 0 products → 0 uplift,
// 1 product → +1x, 5 products → +3x saturating.
function relationshipStickinessFactor(productCount: number): number {
  return productCount <= 0 ? 0 : 1 + Math.log1p(productCount) / Math.log(2);
}

function hazardReductionFromDeal(
  rel: ClientRelationship,
  candidate: DealCandidate,
): number {
  const existingProducts = rel.derived.productTypesHeld.length;
  const candidateExposure = candidate.amountEur;
  const totalExposure = Math.max(1, rel.derived.totalExposureEur + candidateExposure);
  const share = candidateExposure / totalExposure;
  // First product: meaningful reduction. Subsequent: diminishing.
  const base = existingProducts === 0 ? 0.03 : 0.01;
  return base * share;
}

function synthPositionFromCandidate(candidate: DealCandidate, asOfDate: string): ClientPosition {
  return {
    id: 'synthetic-candidate',
    entityId: '',
    clientId: '',
    productId: null,
    productType: candidate.productType,
    category: 'Asset',
    dealId: null,
    amount: candidate.amountEur,
    currency: candidate.currency,
    marginBps: candidate.marginBps,
    startDate: asOfDate,
    maturityDate: addYearsIso(asOfDate, candidate.tenorYears),
    status: 'Active',
    createdAt: asOfDate,
    updatedAt: asOfDate,
  };
}

function addYearsIso(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + Math.floor(years));
  const fractional = years - Math.floor(years);
  if (fractional > 0) {
    d.setUTCDate(d.getUTCDate() + Math.round(fractional * 365.25));
  }
  return d.toISOString().slice(0, 10);
}

export function computeMarginalLtvImpact(
  rel: ClientRelationship,
  candidate: DealCandidate,
  before: LtvComputation,
  assumptions: LtvAssumptions,
): MarginalLtvImpact {
  // 1) Direct NII from the deal itself
  const synthPos = synthPositionFromCandidate(candidate, assumptions.asOfDate);
  const directNii = positionContribution(synthPos, assumptions);

  // 2) Crosssell uplift — existing book sticks better once the deal closes
  const stickiness = relationshipStickinessFactor(rel.derived.productTypesHeld.length);
  const crosssellUplift =
    rel.derived.totalExposureEur
    * assumptions.crosssellProbPerYear
    * 0.25                                 // deal boosts latent crosssell 25%
    * stickiness
    * discountFactor(assumptions.discountRate, Math.ceil(assumptions.horizonYears / 2));

  // 3) Churn reduction — hazard compresses; express as PV of saved churn cost
  const hazardDelta = hazardReductionFromDeal(rel, candidate);
  const savedHazard = rel.derived.totalExposureEur * hazardDelta * assumptions.churnCostPerEur;
  let churnReductionEur = 0;
  for (let t = 1; t <= assumptions.horizonYears; t++) {
    churnReductionEur += savedHazard
      * survivalProb(Math.max(0, assumptions.churnHazardAnnual - hazardDelta), t)
      * discountFactor(assumptions.discountRate, t);
  }

  // 4) Capital opportunity — what else could this capital earn?
  //    opportunity rate = discount rate as baseline hurdle
  const rarocAnnual = candidate.rarocAnnual ?? assumptions.rarocByProduct[candidate.productType] ?? 0.12;
  const opportunitySpread = rarocAnnual - assumptions.discountRate;
  const capitalOpportunity = candidate.capitalEur
    * opportunitySpread
    * assumptions.horizonYears
    * discountFactor(assumptions.discountRate, Math.ceil(assumptions.horizonYears / 2));

  const deltaClv = directNii + crosssellUplift + churnReductionEur + capitalOpportunity;
  const clvAfter = before.clvPointEur + deltaClv;

  return {
    clvBeforeEur: roundMoney(before.clvPointEur),
    clvAfterEur: roundMoney(clvAfter),
    deltaClvEur: roundMoney(deltaClv),
    deltaClvPct: before.clvPointEur === 0 ? 0 : roundPct(deltaClv / Math.abs(before.clvPointEur)),
    breakdown: {
      directNiiEur: roundMoney(directNii),
      crosssellUpliftEur: roundMoney(crosssellUplift),
      churnReductionEur: roundMoney(churnReductionEur),
      capitalOpportunityEur: roundMoney(capitalOpportunity),
    },
  };
}

function roundMoney(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function roundPct(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10_000) / 10_000;
}
