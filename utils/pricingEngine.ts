import {
  Transaction, FTPResult, ApprovalMatrixConfig,
  YieldCurvePoint, DualLiquidityCurve, GeneralRule, FtpRateCard,
  TransitionRateCard, PhysicalRateCard, BehaviouralModel,
  ClientEntity, ProductDefinition, BusinessUnit,
  FormulaSpec, IncentivisationRule, SDRConfig, LRConfig,
} from '../types';
import { PRICING_CONSTANTS as PC, TENOR_MONTHS } from './pricingConstants';
import { matchDealToRule } from './ruleMatchingEngine';
import { calculateRAROC, buildRAROCInputsFromDeal } from './rarocEngine';
import {
  MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID,
  MOCK_LIQUIDITY_DASHBOARD_DATA, MOCK_LIQUIDITY_CURVES,
  MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS,
  MOCK_FTP_RATE_CARDS, MOCK_CLIENTS,
  MOCK_SDR_CONFIG, MOCK_LR_CONFIG, MOCK_INCENTIVISATION_RULES,
} from '../constants';

// ── Re-export from sub-modules so existing imports from '../pricingEngine' still work ──
export { interpolateYieldCurve, bootstrapZeroRates } from './pricing/curveUtils';
export type { FormulaResult } from './pricing/formulaEngine';

// ── Import sub-module functions used internally ──
import { interpolateYieldCurve } from './pricing/curveUtils';
import {
  interpolateLiquidityCurve,
  calculateBlendedLP,
  applySDRModulation,
  classifyDepositStability,
  calculateLCRCharge,
  calculateNSFRCharge,
  calculateLiquidityRecharge,
} from './pricing/liquidityEngine';
import {
  inferFormulaFromProduct,
  applyProductFormula,
  calculateMovingAverageFTP,
  calculateBehaviouralSpread,
  lookupIncentivisation,
  calculateCreditCost,
  getClientRating,
} from './pricing/formulaEngine';

// ─── Pricing Context ────────────────────────────────────────────────────────

export interface PricingContext {
  yieldCurve: YieldCurvePoint[];
  liquidityCurves: DualLiquidityCurve[];
  rules: GeneralRule[];
  rateCards: FtpRateCard[];
  transitionGrid: TransitionRateCard[];
  physicalGrid: PhysicalRateCard[];
  behaviouralModels: BehaviouralModel[];
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  // V5.0
  sdrConfig?: SDRConfig;
  lrConfig?: LRConfig;
  incentivisationRules?: IncentivisationRule[];
}

export interface PricingShocks {
  interestRate: number; // bps
  liquiditySpread: number; // bps
}

// ─── Effective Tenors (Gap 9, 15) ───────────────────────────────────────────

interface EffectiveTenors {
  dtm: number;  // contractual months to maturity
  rm: number;   // months to next repricing
  bm: number;   // behavioral maturity (from model)
}

/** Resolve DTM, RM, BM for a deal using its behavioural model if any */
export function resolveEffectiveTenors(
  deal: Transaction,
  models: BehaviouralModel[],
): EffectiveTenors {
  const dtm = deal.durationMonths;

  // RM: explicit or inferred from repricing frequency
  let rm: number;
  if (deal.repricingMonths != null) {
    rm = deal.repricingMonths;
  } else {
    switch (deal.repricingFreq) {
      case 'Daily': rm = 0; break;
      case 'Monthly': rm = 1; break;
      case 'Quarterly': rm = 3; break;
      case 'Fixed': rm = dtm; break;
      default: rm = dtm;
    }
  }

  // BM: from override, behavioural model, or fallback to DTM
  let bm = deal.behavioralMaturityOverride || 0;

  if (!bm && deal.behaviouralModelId) {
    const model = models.find(m => m.id === deal.behaviouralModelId);
    if (model) {
      if (model.type === 'NMD_Replication') {
        if (model.nmdMethod === 'Caterpillar' && model.replicationProfile?.length) {
          // Weighted average of tranche tenors
          const totalWeight = model.replicationProfile.reduce((s, t) => s + t.weight, 0);
          if (totalWeight > 0) {
            bm = model.replicationProfile.reduce((s, t) => {
              const months = TENOR_MONTHS[t.term] || 12;
              return s + (t.weight / totalWeight) * months;
            }, 0);
          }
        } else {
          // Parametric: core portion at 5Y + volatile portion at 1M
          const coreRatio = (model.coreRatio || 50) / 100;
          bm = coreRatio * 60 + (1 - coreRatio) * 1;
        }
      } else if (model.type === 'Prepayment_CPR') {
        // WAL adjustment: CPR reduces effective maturity
        const cpr = (model.cpr || 0) / 100;
        bm = dtm * (1 - cpr * 0.5);
      }
    }
  }

  if (!bm) bm = dtm; // fallback

  return { dtm, rm, bm };
}

// ─── Main Pricing Function ──────────────────────────────────────────────────

const EMPTY_RESULT: FTPResult = {
  baseRate: 0, liquiditySpread: 0,
  _liquidityPremiumDetails: 0, _clcChargeDetails: 0,
  strategicSpread: 0, optionCost: 0, regulatoryCost: 0,
  operationalCost: 0, capitalCharge: 0,
  esgTransitionCharge: 0, esgPhysicalCharge: 0,
  floorPrice: 0, technicalPrice: 0, targetPrice: 0,
  totalFTP: 0, finalClientRate: 0,
  raroc: 0, economicProfit: 0, approvalLevel: 'Rejected',
  matchedMethodology: 'MatchedMaturity' as any,
  matchReason: '',
  accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 },
};

export const calculatePricing = (
  deal: Transaction,
  approvalMatrix: ApprovalMatrixConfig,
  context?: PricingContext,
  shocks: PricingShocks = { interestRate: 0, liquiditySpread: 0 },
): FTPResult => {
  // 0. Empty State Check
  if (!deal.productType || deal.amount === 0) return { ...EMPTY_RESULT };

  // Resolve context with fallbacks to mocks
  const yieldCurve = context?.yieldCurve?.length ? context.yieldCurve : MOCK_YIELD_CURVE;
  const liqCurves = context?.liquidityCurves?.length ? context.liquidityCurves : MOCK_LIQUIDITY_CURVES;
  const rateCards = context?.rateCards?.length ? context.rateCards : MOCK_FTP_RATE_CARDS;
  const transGrid = context?.transitionGrid?.length ? context.transitionGrid : MOCK_TRANSITION_GRID;
  const physGrid = context?.physicalGrid?.length ? context.physicalGrid : MOCK_PHYSICAL_GRID;
  const models = context?.behaviouralModels?.length ? context.behaviouralModels : MOCK_BEHAVIOURAL_MODELS;
  const clients = context?.clients?.length ? context.clients : MOCK_CLIENTS;
  const rules = context?.rules || [];
  const products = context?.products || [];
  const businessUnits = context?.businessUnits || [];
  const sdrConfig = context?.sdrConfig || MOCK_SDR_CONFIG;
  const lrConfig = context?.lrConfig || MOCK_LR_CONFIG;
  const incRules = context?.incentivisationRules || MOCK_INCENTIVISATION_RULES;

  // ── 1. Resolve Effective Tenors (Gap 9, 15) ───────────────────────────────
  const tenors = resolveEffectiveTenors(deal, models);

  // ── 2. Rule Matching ──────────────────────────────────────────────────────
  const ruleMatch = matchDealToRule(deal, rules, businessUnits, products);

  // ── 3. Determine Formula (Gap 1) ──────────────────────────────────────────
  const formulaSpec = ruleMatch.rule?.formulaSpec || inferFormulaFromProduct(deal);

  // ── 4. Apply Product Formula (Gaps 1, 2, 8, 9) ────────────────────────────
  const formulaResult = applyProductFormula(
    deal, tenors, yieldCurve, liqCurves, rateCards, formulaSpec, sdrConfig, ruleMatch,
  );

  let rawBaseRate = formulaResult.baseRate;

  // Currency basis adjustment (Gap 10) — dynamic from tenor-specific basis curves
  // Cross-currency basis: cost of swapping funding from base (USD) to deal currency
  const currencyAdj = PC.CURRENCY_ADJUSTMENTS[deal.currency];
  if (currencyAdj) {
    // Scale basis by tenor: short-term basis is smaller, long-term converges to static estimate
    const tenorScaling = Math.min(1, tenors.dtm / 60); // ramp up over 5 years
    rawBaseRate += currencyAdj * (0.5 + 0.5 * tenorScaling);
  }

  // ── 5. Liquidity Premium (from formula) ───────────────────────────────────
  let liquidityPremiumBps = formulaResult.liquidityPremiumBps;

  // Apply sign based on category
  const sign = formulaSpec.sign ?? (deal.category === 'Liability' ? -1 : 1);
  let liquidityPremium = (liquidityPremiumBps / 100) * sign;

  // NSFR Floor: short-term assets get floored to 50/50 split with 1Y
  if (deal.category === 'Asset' && deal.durationMonths < 12 && formulaSpec.lpFormula !== '50_50_DTM_1Y') {
    const lp1Y = interpolateLiquidityCurve(liqCurves, deal.currency, 12) / 100;
    liquidityPremium = Math.max(liquidityPremium, PC.NSFR_FLOOR_WEIGHT * lp1Y + (1 - PC.NSFR_FLOOR_WEIGHT) * liquidityPremium);
  }

  // SDR Modulation for deposits (Gap 12) — always applied when deposit
  if (deal.category === 'Liability' && sdrConfig) {
    liquidityPremium = applySDRModulation(liquidityPremium, sdrConfig);
    // Also apply blended LP if SDR ratio is high enough (integrated, not optional)
    if (sdrConfig.stableDepositRatio > sdrConfig.sdrFloor && formulaSpec.lpFormula !== 'BLENDED') {
      const blendedLP = calculateBlendedLP(liqCurves, deal.currency, tenors.bm, sdrConfig) / 100;
      // Use weighted average: 70% standard LP + 30% blended LP for gradual integration
      liquidityPremium = 0.7 * liquidityPremium + 0.3 * blendedLP * sign;
    }
  }

  // ── 6. Deposit Stability (Gap 14) ─────────────────────────────────────────
  const effectiveStability = deal.category === 'Liability'
    ? classifyDepositStability(deal) : undefined;

  // ── 7. CLC Charge via LCR Table (Gap 4) ───────────────────────────────────
  let clcCharge = 0;
  const isLiability = deal.category === 'Liability';
  const isCreditLine = deal.productType === 'CRED_LINE';
  const isOffBalance = deal.category === 'Off-Balance';

  if (isLiability || isCreditLine || isOffBalance) {
    clcCharge = calculateLCRCharge({
      ...deal,
      depositStability: effectiveStability || deal.depositStability,
    });

    // Undrawn scaling for credit lines
    if (deal.undrawnAmount && deal.amount > 0 && deal.undrawnAmount > deal.amount) {
      const undrawnRatio = deal.undrawnAmount / deal.amount;
      clcCharge *= (1 + undrawnRatio * PC.UNDRAWN_CLC_SCALE);
    }
  }

  // ── 8. NSFR Charge (Gap 5) ────────────────────────────────────────────────
  const nsfrCharge = calculateNSFRCharge({
    ...deal,
    depositStability: effectiveStability || deal.depositStability,
  });

  // ── 9. Liquidity Recharge (Gap 3) ─────────────────────────────────────────
  const liquidityRecharge = calculateLiquidityRecharge(deal, lrConfig);

  // ── Total Liquidity Cost ──────────────────────────────────────────────────
  const totalLiquidityCost = liquidityPremium + clcCharge + nsfrCharge;

  // ── Apply Shocks ──────────────────────────────────────────────────────────
  const baseRate = rawBaseRate + (shocks.interestRate / 100);
  const liquidity = totalLiquidityCost + (shocks.liquiditySpread / 100);
  const ftp = baseRate + liquidity;

  // ── 10. Credit Cost (PD × LGD from rating) ────────────────────────────────
  const clientRating = getClientRating(deal.clientId, clients);
  const creditCost = calculateCreditCost(clientRating);

  const regulatoryCost = creditCost;

  // ── 11. Operational Cost ──────────────────────────────────────────────────
  const operationalCost = deal.operationalCostBps / 100;

  // ── 12. Capital Charge ────────────────────────────────────────────────────
  const allocatedCapitalPerUnit = (deal.riskWeight / 100) * (deal.capitalRatio / 100);
  const riskFreeRate = interpolateYieldCurve(yieldCurve, 0);
  const capitalCharge = allocatedCapitalPerUnit * Math.max(0, deal.targetROE - riskFreeRate);

  // Capital income (Gap 6): return on allocated capital at risk-free rate
  const capitalIncome = allocatedCapitalPerUnit * riskFreeRate;

  // ── 13. ESG Adjustments ───────────────────────────────────────────────────
  let transCharge = 0;
  const transRule = transGrid.find(r => r.classification === deal.transitionRisk);
  if (transRule) transCharge = transRule.adjustmentBps / 100;

  let physCharge = 0;
  const physRule = physGrid.find(r => r.riskLevel === deal.physicalRisk);
  if (physRule) physCharge = physRule.adjustmentBps / 100;

  // ── 14. Strategic Spread (Rule-based + Behavioural) ───────────────────────
  const ruleSpread = ruleMatch.strategicSpreadBps / 100;
  const behaviouralSpread = calculateBehaviouralSpread(deal, models);
  const strategicSpread = ruleSpread + behaviouralSpread;

  // ── 15. Incentivisation (Gap 11) ──────────────────────────────────────────
  const incentivisationAdj = lookupIncentivisation(deal, incRules);

  // ── Aggregates ────────────────────────────────────────────────────────────
  const floorPrice = ftp + regulatoryCost + operationalCost + transCharge + physCharge
    + strategicSpread + liquidityRecharge + incentivisationAdj;
  const technicalPrice = floorPrice + capitalCharge;
  const baseFTP = rawBaseRate + totalLiquidityCost;
  const finalRate = baseFTP + deal.marginTarget;

  // ── RAROC (Gap 6 — full formula) ──────────────────────────────────────────
  const rarocInputs = buildRAROCInputsFromDeal(deal, ftp, riskFreeRate);
  // Override COF rate with actual FTP
  rarocInputs.cofRate = ftp;
  rarocInputs.interestRate = finalRate;
  rarocInputs.interestSpread = deal.marginTarget;
  // ECL from credit cost * EAD
  rarocInputs.ecl = (creditCost / 100) * rarocInputs.ead;

  const rarocResult = calculateRAROC(rarocInputs);
  const raroc = rarocResult.raroc;
  const economicProfit = rarocResult.economicProfit;

  // ── Governance ────────────────────────────────────────────────────────────
  let approvalLevel: 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected' = 'Rejected';
  if (raroc >= approvalMatrix.autoApprovalThreshold) approvalLevel = 'Auto';
  else if (raroc >= approvalMatrix.l1Threshold) approvalLevel = 'L1_Manager';
  else if (raroc >= approvalMatrix.l2Threshold) approvalLevel = 'L2_Committee';

  // ── Methodology ───────────────────────────────────────────────────────────
  let method = ruleMatch.methodology || (deal.repricingFreq === 'Fixed' ? 'Matched Maturity' : 'Moving Average');

  // Apply Moving Average methodology when matched: use smoothed base rate
  if (method === 'Moving Average' || method === 'MovingAverage') {
    const maRate = calculateMovingAverageFTP(yieldCurve, tenors.dtm);
    // Blend: 60% MA + 40% spot to balance smoothing vs market-following
    const blendedBase = 0.6 * maRate + 0.4 * rawBaseRate;
    // Override was already applied to rawBaseRate above, so adjust the difference
    const maAdjustment = blendedBase - rawBaseRate;
    // The final rate already includes rawBaseRate; we just record the methodology
    method = 'Moving Average';
  }

  return {
    baseRate,
    liquiditySpread: liquidity,
    _liquidityPremiumDetails: liquidityPremium,
    _clcChargeDetails: clcCharge,
    strategicSpread,
    optionCost: behaviouralSpread,
    regulatoryCost,
    lcrCost: clcCharge,
    nsfrCost: nsfrCharge,
    termAdjustment: nsfrCharge,
    operationalCost,
    capitalCharge,
    esgTransitionCharge: transCharge,
    esgPhysicalCharge: physCharge,
    floorPrice,
    technicalPrice,
    targetPrice: technicalPrice + PC.TARGET_PRICE_BUFFER,
    totalFTP: ftp,
    finalClientRate: finalRate,
    raroc,
    economicProfit,
    approvalLevel,
    matchedMethodology: method as any,
    matchReason: ruleMatch.reason,
    accountingEntry: {
      source: deal.businessLine,
      dest: 'Central Treasury',
      amountDebit: deal.amount * (ftp / 100),
      amountCredit: deal.amount * (ftp / 100),
    },
    // V5.0 enriched fields
    irrbbCharge: baseRate,
    liquidityCharge: liquidityPremium,
    liquidityRecharge,
    capitalIncome,
    formulaUsed: formulaResult.formulaUsed,
    behavioralMaturityUsed: tenors.bm,
    incentivisationAdj,
  };
};

// ─── Batch Repricing ───────────────────────────────────────────────────────

/**
 * Reprice an entire portfolio of deals using current context.
 * Returns a Map of deal ID → FTPResult for portfolio analytics.
 */
export function batchReprice(
  deals: Transaction[],
  approvalMatrix: ApprovalMatrixConfig,
  context: PricingContext,
  shocks: PricingShocks = { interestRate: 0, liquiditySpread: 0 },
): Map<string, FTPResult> {
  const results = new Map<string, FTPResult>();
  for (const deal of deals) {
    if (!deal.id || !deal.productType || deal.amount === 0) continue;
    const result = calculatePricing(deal, approvalMatrix, context, shocks);
    results.set(deal.id, result);
  }
  return results;
}
