import type {
  Transaction, YieldCurvePoint, DualLiquidityCurve,
  FtpRateCard, BehaviouralModel, ClientEntity,
  FormulaSpec, IncentivisationRule, SDRConfig,
} from '../../types';
import { PRICING_CONSTANTS as PC, CREDIT_PARAMS } from '../pricingConstants';
import { lookupRateCard } from '../ruleMatchingEngine';
import { interpolateYieldCurve } from './curveUtils';
import { interpolateLiquidityCurve, calculateBlendedLP } from './liquidityEngine';

// ─── Product Formula Dispatcher (Gaps 1, 2, 3, 8) ──────────────────────────

export interface FormulaResult {
  baseRate: number;         // %
  liquidityPremiumBps: number; // bps
  formulaUsed: string;
}

/**
 * Infer formula from product/category when no rule formulaSpec exists.
 * Based on Santander Product Level Recommendations.
 */
export function inferFormulaFromProduct(deal: Transaction): FormulaSpec {
  // Deposits (liabilities) — use BM-based LP, sign = -1
  if (deal.category === 'Liability') {
    return { baseRateKey: 'BM', lpFormula: 'LP_BM', sign: -1 };
  }

  // Off-balance (credit lines, swaps)
  if (deal.category === 'Off-Balance') {
    return { baseRateKey: 'DTM', lpFormula: 'LP_DTM', sign: 1 };
  }

  // Assets
  if (deal.collateralType && deal.collateralType !== 'None') {
    return { baseRateKey: 'DTM', lpFormula: 'SECURED_LP', lpCurveType: 'secured', sign: 1 };
  }

  // Short-term corporate assets: 50/50 split
  if (deal.durationMonths < 12) {
    return { baseRateKey: 'DTM', lpFormula: '50_50_DTM_1Y', sign: 1 };
  }

  // Long-term assets: BR[min(BM,RM)] + LP(BM)
  return { baseRateKey: 'MIN_BM_RM', lpFormula: 'LP_BM', sign: 1 };
}

// ─── EffectiveTenors type (local reference) ─────────────────────────────────

interface EffectiveTenors {
  dtm: number;
  rm: number;
  bm: number;
}

/**
 * Apply product-specific FTP formula.
 * Returns base rate (%), LP (bps), and formula description.
 */
export function applyProductFormula(
  deal: Transaction,
  tenors: EffectiveTenors,
  yieldCurve: YieldCurvePoint[],
  liqCurves: DualLiquidityCurve[],
  rateCards: FtpRateCard[],
  spec: FormulaSpec,
  sdrConfig?: SDRConfig,
  ruleMatch?: { liquidityReference: string | null },
): FormulaResult {
  const { dtm, rm, bm } = tenors;
  const ccy = deal.currency;

  // Resolve base rate tenor
  let baseTenor: number;
  switch (spec.baseRateKey) {
    case 'DTM': baseTenor = dtm; break;
    case 'BM': baseTenor = bm; break;
    case 'RM': baseTenor = rm; break;
    case 'MIN_BM_RM': baseTenor = Math.min(bm, rm || dtm); break;
    default: baseTenor = dtm;
  }
  const baseRate = interpolateYieldCurve(yieldCurve, baseTenor);

  // Resolve LP
  let lpBps: number;
  let formulaDesc: string;

  // Helper: get LP from rate card or curve
  const getLPFromCurveOrCard = (months: number, type: 'unsecured' | 'secured' = 'unsecured'): number => {
    if (ruleMatch?.liquidityReference) {
      const cardRate = lookupRateCard(rateCards, ruleMatch.liquidityReference, months);
      if (cardRate !== null) return cardRate * 100; // rate cards in % → bps
    }
    return interpolateLiquidityCurve(liqCurves, ccy, months, type);
  };

  switch (spec.lpFormula) {
    case '50_50_DTM_1Y': {
      // 50% LP(DTM) + 50% LP(1Y) — NSFR floor for short-term assets
      const lpDTM = getLPFromCurveOrCard(dtm);
      const lp1Y = getLPFromCurveOrCard(12);
      lpBps = 0.5 * lpDTM + 0.5 * lp1Y;
      formulaDesc = `BR(${spec.baseRateKey}) + 50%LP(DTM=${dtm}M) + 50%LP(1Y)`;
      break;
    }

    case 'LP_BM': {
      // LP at behavioral maturity
      lpBps = getLPFromCurveOrCard(bm);
      formulaDesc = `BR(${spec.baseRateKey}=${Math.round(baseTenor)}M) + LP(BM=${Math.round(bm)}M)`;
      break;
    }

    case 'LP_DTM': {
      // LP at contractual maturity
      lpBps = getLPFromCurveOrCard(dtm);
      formulaDesc = `BR(${spec.baseRateKey}=${Math.round(baseTenor)}M) + LP(DTM=${dtm}M)`;
      break;
    }

    case 'SECURED_LP': {
      // (1 - haircut) × SecuredLP + haircut × UnsecuredLP
      const hc = (deal.haircutPct || 0) / 100;
      const secLP = interpolateLiquidityCurve(liqCurves, ccy, dtm, 'secured');
      const unsecLP = interpolateLiquidityCurve(liqCurves, ccy, dtm, 'unsecured');
      lpBps = (1 - hc) * secLP + hc * unsecLP;
      formulaDesc = `BR(DTM) + (1-HC${Math.round(hc * 100)}%)·SecLP + HC·UnsecLP`;
      break;
    }

    case 'BLENDED': {
      // Blended LP using SDR modulation
      if (sdrConfig) {
        lpBps = calculateBlendedLP(liqCurves, ccy, bm, sdrConfig);
      } else {
        lpBps = getLPFromCurveOrCard(bm);
      }
      formulaDesc = `BR(${spec.baseRateKey}) + BlendedLP(BM=${Math.round(bm)}M)`;
      break;
    }

    default: {
      lpBps = getLPFromCurveOrCard(dtm);
      formulaDesc = `BR(DTM) + LP(DTM)`;
    }
  }

  return { baseRate, liquidityPremiumBps: lpBps, formulaUsed: formulaDesc };
}

// ─── Moving Average FTP (Gap 16) ────────────────────────────────────────────

/**
 * Moving Average FTP: weighted average of historical rates for stable portfolios.
 * For portfolios where matched maturity would cause excessive P&L volatility.
 * Uses exponential decay weighting: recent rates have more weight.
 */
export function calculateMovingAverageFTP(
  yieldCurve: YieldCurvePoint[],
  targetMonths: number,
  windowMonths: number = 12,
): number {
  // Use current curve points as proxy for historical rates
  // In production, this would use stored historical curve snapshots
  const currentRate = interpolateYieldCurve(yieldCurve, targetMonths);

  // Simulate moving average with exponential decay over the window
  // Decay factor: more recent periods weighted higher
  const periods = Math.max(1, Math.floor(windowMonths));
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < periods; i++) {
    const weight = Math.exp(-0.05 * i); // exponential decay
    // Simulate historical rate as current rate ± seasonal variation
    const historicalRate = currentRate + (Math.sin(i * 0.5) * 0.1);
    weightedSum += weight * historicalRate;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : currentRate;
}

// ─── Behavioural Model Spread (Option Cost) ─────────────────────────────────

export function calculateBehaviouralSpread(
  deal: Transaction,
  models: BehaviouralModel[],
): number {
  if (!deal.behaviouralModelId) return 0;
  const model = models.find(m => m.id === deal.behaviouralModelId);
  if (!model) return 0;

  if (model.type === 'Prepayment_CPR') {
    const cpr = model.cpr || 0;
    const penaltyExempt = model.penaltyExempt || 0;
    return (cpr / 100) * ((penaltyExempt / 100) * 0.8 + 0.2) * 100 * 0.02;
  }

  if (model.type === 'NMD_Replication') {
    if (model.nmdMethod === 'Caterpillar' && model.replicationProfile?.length) {
      const totalWeight = model.replicationProfile.reduce((sum, t) => sum + t.weight, 0);
      if (totalWeight === 0) return 0;
      const weightedSpread = model.replicationProfile.reduce(
        (sum, t) => sum + (t.weight / totalWeight) * t.spread, 0,
      );
      const spreadPct = weightedSpread / 100;
      return deal.category === 'Liability' ? -Math.abs(spreadPct) : spreadPct;
    }

    const coreRatio = (model.coreRatio || 50) / 100;
    const beta = model.betaFactor || 0.5;
    const decayRate = (model.decayRate || 15) / 100;
    // Stability benefit: higher core ratio + lower beta + lower decay = more stable = higher benefit
    // Model-derived: core * (1-beta) * (1-decay) as annualized spread factor
    const stabilityBenefit = coreRatio * (1 - beta) * (1 - decayRate);
    return deal.category === 'Liability' ? -stabilityBenefit : stabilityBenefit * 0.5;
  }

  return 0;
}

// ─── Incentivisation (Gap 11) ───────────────────────────────────────────────

export function lookupIncentivisation(
  deal: Transaction,
  rules?: IncentivisationRule[],
): number {
  if (!rules?.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const matching = rules.find(r =>
    (r.productType === deal.productType || r.productType === 'Any') &&
    (r.segment === deal.clientType || r.segment === 'All') &&
    r.validFrom <= today &&
    r.validTo >= today,
  );

  return matching ? matching.subsidyBps / 100 : 0; // bps → %
}

// ─── Credit Cost ────────────────────────────────────────────────────────────

/** Expected Loss = PD × LGD (annualized, in %) */
export function calculateCreditCost(clientRating: string): number {
  const params = CREDIT_PARAMS[clientRating] || CREDIT_PARAMS[PC.DEFAULT_CREDIT_RATING];
  if (!params) return 0.09;
  return (params.pd / 100) * (params.lgd / 100) * 100;
}

export function getClientRating(clientId: string, clients: ClientEntity[]): string {
  return clients.find(c => c.id === clientId)?.rating || PC.DEFAULT_CREDIT_RATING;
}
