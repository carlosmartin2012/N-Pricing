import {
  Transaction, FTPResult, ApprovalMatrixConfig,
  YieldCurvePoint, DualLiquidityCurve, GeneralRule, FtpRateCard,
  TransitionRateCard, PhysicalRateCard, GreeniumRateCard, BehaviouralModel,
  ClientEntity, ProductDefinition, BusinessUnit,
  IncentivisationRule, SDRConfig, LRConfig,
} from '../types';
import { PRICING_CONSTANTS as PC, TENOR_MONTHS } from './pricingConstants';
import { matchDealToRule, clearRuleMatchCache } from './ruleMatchingEngine';
import { calculateRAROC, buildRAROCInputsFromDeal } from './rarocEngine';
import {
  MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID, MOCK_GREENIUM_GRID,
  MOCK_LIQUIDITY_CURVES,
  MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS,
  MOCK_FTP_RATE_CARDS, MOCK_CLIENTS,
  MOCK_SDR_CONFIG, MOCK_LR_CONFIG, MOCK_INCENTIVISATION_RULES,
} from './seedData';

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
  calculateBehaviouralSpread,
  lookupIncentivisation,
} from './pricing/formulaEngine';
import { calculateFullCreditRisk } from './pricing/creditRiskEngine';
import { assessCreditLifecycle } from './pricing/creditLifecycle';
import { calculateAdditionalFTPCharges } from './pricing/additionalCharges';
import {
  calculateCapitalWithOutputFloor,
  calculateBufferedCapitalCharge,
} from './pricing/capitalEngineCRR3';
import { calculateCrossBonusAdjustment } from './pricing/crossBonuses';
import {
  resolveDelegation,
  tierToLegacyApprovalLevel,
} from './pricing/delegationEngine';

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
  greeniumGrid: GreeniumRateCard[];
  // V5.0
  sdrConfig?: SDRConfig;
  lrConfig?: LRConfig;
  incentivisationRules?: IncentivisationRule[];
}

export interface PricingShocks {
  interestRate: number; // bps
  liquiditySpread: number; // bps
}

export const DEFAULT_PRICING_SHOCKS: PricingShocks = {
  interestRate: 0,
  liquiditySpread: 0,
};

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
  esgTransitionCharge: 0, esgPhysicalCharge: 0, esgGreeniumAdj: 0, esgDnshCapitalAdj: 0, esgPillar1Adj: 0,
  floorPrice: 0, technicalPrice: 0, targetPrice: 0,
  totalFTP: 0, finalClientRate: 0,
  raroc: 0, economicProfit: 0, approvalLevel: 'Rejected',
  matchedMethodology: 'Matched Maturity',
  matchReason: '',
  accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 },
};

export const calculatePricing = (
  deal: Transaction,
  approvalMatrix: ApprovalMatrixConfig,
  context?: PricingContext,
  shocks: PricingShocks = DEFAULT_PRICING_SHOCKS,
): FTPResult => {
  // 0. Empty State Check
  if (!deal.productType || deal.amount === 0) return { ...EMPTY_RESULT };

  // Guard against NaN/Infinity propagation
  if (!Number.isFinite(deal.amount) || !Number.isFinite(deal.durationMonths)) {
    return { ...EMPTY_RESULT };
  }

  // Resolve context with fallbacks to mocks
  const yieldCurve = context?.yieldCurve?.length ? context.yieldCurve : MOCK_YIELD_CURVE;
  const liqCurves = context?.liquidityCurves?.length ? context.liquidityCurves : MOCK_LIQUIDITY_CURVES;
  const rateCards = context?.rateCards?.length ? context.rateCards : MOCK_FTP_RATE_CARDS;
  const transGrid = context?.transitionGrid?.length ? context.transitionGrid : MOCK_TRANSITION_GRID;
  const physGrid = context?.physicalGrid?.length ? context.physicalGrid : MOCK_PHYSICAL_GRID;
  const greenGrid = context?.greeniumGrid?.length ? context.greeniumGrid : MOCK_GREENIUM_GRID;
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
  const liquidityPremiumBps = formulaResult.liquidityPremiumBps;

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

  // ── 9b. CSRBB + Contingent Liquidity (Gaps 20, 21) ────────────────────────
  // CSRBB: credit spread risk on asset-side banking book exposures.
  // Contingent Liquidity: term charge for undrawn commitments.
  const additionalCharges = calculateAdditionalFTPCharges(deal, deal.clientRating);
  const csrbbCharge = additionalCharges.csrbb.chargePct;
  const contingentLiquidityCharge = additionalCharges.contingentLiquidity.chargePct;

  // ── Total Liquidity Cost ──────────────────────────────────────────────────
  const totalLiquidityCost =
    liquidityPremium +
    clcCharge +
    nsfrCharge +
    csrbbCharge +
    contingentLiquidityCharge;

  // ── Apply Shocks ──────────────────────────────────────────────────────────
  const baseRate = rawBaseRate + (shocks.interestRate / 100);
  const liquidity = totalLiquidityCost + (shocks.liquiditySpread / 100);
  const ftp = baseRate + liquidity;

  // ── 10. Credit Cost (Anejo IX) ─────────────────────────────────────────────
  const anejoResult = calculateFullCreditRisk({
    productType: deal.productType,
    clientType: deal.clientType,
    amount: deal.amount,
    ltvPct: deal.haircutPct ? deal.haircutPct / 100 : 0,
    collateralType: deal.collateralType || 'None',
    collateralValue: deal.collateralType && deal.collateralType !== 'None' && deal.haircutPct && deal.haircutPct > 0
      ? deal.amount / (deal.haircutPct / 100)
      : 0,
    durationMonths: deal.durationMonths,
    guaranteeType: deal.guaranteeType,
    appraisalAgeMonths: deal.appraisalAgeMonths,
    publicGuaranteePct: deal.publicGuaranteePct,
    undrawnAmount: deal.undrawnAmount,
    ccfType: deal.ccfType,
    utilizationRate: deal.utilizationRate,
    mode: deal.creditRiskMode,
    externalPd12m: deal.externalPd12m,
    externalLgd: deal.externalLgd,
    externalEad: deal.externalEad,
  });

  // ── 10b. IFRS 9 Lifecycle Overlay (stage 2/3 triggers lifetime EL) ────────
  const capParams = anejoResult.capitalParams;
  const lifecycleResult = capParams
    ? assessCreditLifecycle(
        capParams.pd,
        capParams.lgd,
        capParams.ead,
        deal.durationMonths,
        {
          pdMultiplier: deal.pdMultiplier,
          daysPastDue: deal.daysPastDue,
          isRefinanced: deal.isRefinanced,
          isWatchlist: deal.isWatchlist,
          isForborne: deal.isForborne,
        },
        deal.ifrs9Stage,
      )
    : null;

  // Stage-aware regulatory cost: stage 1 keeps Anejo IX annualized cost;
  // stage 2/3 uses lifetime EL amortized over remaining duration.
  const regulatoryCost =
    lifecycleResult && lifecycleResult.stage !== 1
      ? lifecycleResult.annualCostPct / 100
      : anejoResult.creditCostAnnualPct / 100;

  // ── 11. Operational Cost ──────────────────────────────────────────────────
  const operationalCost = deal.operationalCostBps / 100;

  // ── 12. Capital Charge (CRR3 output floor + Basel III buffer stack) ───────
  const riskFreeRate = interpolateYieldCurve(yieldCurve, 0);

  // Derive SA RWA if not provided explicitly
  const rwaStandardized = deal.rwaStandardized ?? (deal.riskWeight / 100) * deal.amount;

  // CRR3 full buffer stack only applies when the deal opts in by providing
  // rwaIrb (IRB-authorized bank) OR explicit SIFI flags. Otherwise fall back
  // to legacy single-ratio mode: capitalRatio is the total capital requirement.
  const useFullBufferStack = deal.rwaIrb != null || deal.isGSII || deal.isOSII;

  const capitalCalc = calculateCapitalWithOutputFloor({
    ead: deal.amount,
    rwaStandardized,
    rwaIrb: deal.rwaIrb,
    year: new Date().getFullYear(),
    buffers: useFullBufferStack
      ? { pillar1: deal.capitalRatio }
      : {
          // Legacy mode: capitalRatio is the only charge, zero out everything else
          pillar1: deal.capitalRatio,
          pillar2Requirement: 0,
          conservationBuffer: 0,
          countercyclicalBuffer: 0,
          systemicRiskBuffer: 0,
          gSIIBuffer: 0,
          oSIIBuffer: 0,
          managementBuffer: 0,
        },
    isGSII: deal.isGSII,
    isOSII: deal.isOSII,
  });

  const allocatedCapitalPerUnit =
    deal.amount > 0 ? capitalCalc.totalCapitalRequired / deal.amount : 0;
  const capitalCharge = calculateBufferedCapitalCharge(
    capitalCalc,
    deal.amount,
    deal.targetROE,
    riskFreeRate,
  );

  // Capital income (Gap 6): return on allocated capital at risk-free rate
  const capitalIncome = allocatedCapitalPerUnit * riskFreeRate;

  // ── 13. ESG Adjustments ───────────────────────────────────────────────────
  let transCharge = 0;
  const transRule = transGrid.find(r => r.classification === deal.transitionRisk);
  if (transRule) transCharge = transRule.adjustmentBps / 100;

  let physCharge = 0;
  const physRule = physGrid.find(r => r.riskLevel === deal.physicalRisk);
  if (physRule) physCharge = physRule.adjustmentBps / 100;

  // ── 13b. Greenium / Movilización (Gap 17) ────────────────────────────
  // Strategic ESG discount for deals with verified green/sustainable format
  let greeniumAdj = 0;
  if (deal.greenFormat && deal.greenFormat !== 'None') {
    const greenRule = greenGrid.find(r => r.greenFormat === deal.greenFormat);
    if (greenRule) greeniumAdj = greenRule.adjustmentBps / 100; // negative = discount
  }

  // ── 13c. DNSH Capital Discount (Gap 18) ──────────────────────────────
  // Deals compliant with Do No Significant Harm get a capital charge reduction
  let dnshCapitalAdj = 0;
  if (deal.dnshCompliant) {
    dnshCapitalAdj = capitalCharge * (1 - PC.DNSH_CAPITAL_DISCOUNT_FACTOR);
  }

  // ── 13d. ESG Pillar I — ISF Overlay (Gap 19) ────────────────────────
  // Infrastructure Supporting Factor: CRR2 Art. 501a reduces RW by 25%
  // for qualifying infrastructure/project finance exposures.
  // Since the capital charge scales linearly with effective RWA, ISF reduction
  // equals capitalCharge × (1 - ISF_RW_FACTOR) = 25% when factor is 0.75.
  let pillar1Adj = 0;
  if (deal.isfEligible) {
    pillar1Adj = capitalCharge * (1 - PC.ISF_RW_FACTOR);
  }

  // ── 14. Strategic Spread (Rule-based + Behavioural) ───────────────────────
  const ruleSpread = ruleMatch.strategicSpreadBps / 100;
  const behaviouralSpread = calculateBehaviouralSpread(deal, models);
  const strategicSpread = ruleSpread + behaviouralSpread;

  // ── 15. Incentivisation (Gap 11) ──────────────────────────────────────────
  const incentivisationAdj = lookupIncentivisation(deal, incRules);

  // ── 15b. Cross-bonuses (bonificaciones cruzadas, spec §M5) ────────────────
  const crossBonus = calculateCrossBonusAdjustment({
    attachments: deal.crossBonusAttachments ?? [],
    loanAmount: deal.amount,
    loanDurationMonths: deal.durationMonths,
  });
  // totalDiscountPct = expected rate discount to client (subtracts from client rate)
  // netBonusAdjustmentPct = net gain to bank (positive = can lower FTP)
  const crossBonusDiscount = crossBonus.totalDiscountPct;

  // ── Aggregates ────────────────────────────────────────────────────────────
  const floorPrice = ftp + regulatoryCost + operationalCost + transCharge + physCharge
    + greeniumAdj + strategicSpread + liquidityRecharge + incentivisationAdj;
  const effectiveCapitalCharge = capitalCharge - dnshCapitalAdj - pillar1Adj;
  const technicalPrice = floorPrice + effectiveCapitalCharge;
  // Client rate: margin target minus expected cross-bonus discount
  const finalRate = ftp + deal.marginTarget - crossBonusDiscount;

  // ── RAROC (Gap 6 — full formula) ──────────────────────────────────────────
  const rarocInputs = buildRAROCInputsFromDeal(deal, ftp, riskFreeRate);
  // Override COF rate with actual FTP
  rarocInputs.cofRate = ftp;
  rarocInputs.interestRate = finalRate;
  rarocInputs.interestSpread = finalRate - ftp;
  // ECL from Anejo IX credit cost × EAD
  // regulatoryCost is already in fraction form (e.g. 0.005 for 0.5%),
  // so multiply directly by EAD to get the absolute € amount expected by calculateRAROC.
  rarocInputs.ecl = regulatoryCost * rarocInputs.ead;

  const rarocResult = calculateRAROC(rarocInputs);
  const raroc = rarocResult.raroc;
  const economicProfit = rarocResult.economicProfit;

  // ── Governance (legacy single-threshold + multi-dimensional delegation) ──
  let legacyApprovalLevel: 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected' = 'Rejected';
  if (raroc >= approvalMatrix.autoApprovalThreshold) legacyApprovalLevel = 'Auto';
  else if (raroc >= approvalMatrix.l1Threshold) legacyApprovalLevel = 'L1_Manager';
  else if (raroc >= approvalMatrix.l2Threshold) legacyApprovalLevel = 'L2_Committee';

  // Multi-dimensional delegation (spec §M8): amount × segment × rating × LTV × RAROC
  const delegation = resolveDelegation({
    amount: deal.amount,
    segment: deal.clientType,
    rating: deal.clientRating,
    ltvPct: deal.ltvPct ?? (deal.haircutPct ? 100 - deal.haircutPct : undefined),
    raroc,
    hurdleRate: deal.targetROE,
    businessUnit: deal.businessUnit,
    managerRole: deal.submittedByRole,
  });
  const delegationLevel = tierToLegacyApprovalLevel(delegation.tier);

  // Final approval: delegation engine is opt-in — only used when the deal
  // provides enough data (at minimum clientRating) to evaluate multi-dim rules.
  // Otherwise the legacy single-threshold is authoritative. When both apply,
  // pick the most restrictive (delegation can ESCALATE but never downgrade).
  const APPROVAL_ORDER = { 'Auto': 0, 'L1_Manager': 1, 'L2_Committee': 2, 'Rejected': 3 } as const;
  const hasDelegationData = deal.clientRating != null;
  const approvalLevel: 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected' =
    hasDelegationData &&
    delegation.matchedRuleId !== null &&
    APPROVAL_ORDER[delegationLevel] > APPROVAL_ORDER[legacyApprovalLevel]
      ? delegationLevel
      : legacyApprovalLevel;

  // ── Methodology ───────────────────────────────────────────────────────────
  let method = ruleMatch.methodology || (deal.repricingFreq === 'Fixed' ? 'Matched Maturity' : 'Moving Average');

  // Moving Average is flagged as the chosen methodology even though the
  // current output already uses the effective base rate calculated above.
  if (method === 'Moving Average' || method === 'MovingAverage') {
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
    esgGreeniumAdj: greeniumAdj,
    esgDnshCapitalAdj: dnshCapitalAdj,
    esgPillar1Adj: pillar1Adj,
    floorPrice,
    technicalPrice,
    targetPrice: technicalPrice + PC.TARGET_PRICE_BUFFER,
    totalFTP: ftp,
    finalClientRate: finalRate,
    raroc,
    economicProfit,
    approvalLevel,
    matchedMethodology: method,
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
    anejoSegment: anejoResult.anejoSegment,

    // ── Phase 1: additional FTP charges (Gaps 20, 21) ──
    csrbbCost: csrbbCharge,
    contingentLiquidityCost: contingentLiquidityCharge,

    // ── Phase 1: CRR3 capital diagnostics ──
    effectiveRwa: capitalCalc.effectiveRwa,
    outputFloorBinding: capitalCalc.outputFloorBinding,
    outputFloorFactor: capitalCalc.outputFloorFactor,
    totalCapitalRatio: capitalCalc.totalCapitalRatio,
    capitalBuffersBreakdown: capitalCalc.buffersBreakdown,

    // ── Phase 1: IFRS 9 / SICR diagnostics ──
    ifrs9StageUsed: lifecycleResult?.stage,
    sicrTriggered: lifecycleResult?.sicrResult.triggered,
    sicrReasons: lifecycleResult?.sicrResult.reasons,
    lifetimeEL: lifecycleResult?.elLifetime,

    // ── Phase 1 R2: Cross-bonuses (bonificaciones cruzadas) ──
    crossBonusDiscountPct: crossBonus.totalDiscountPct,
    crossBonusNpvIncome: crossBonus.totalNpvMarginIncome,
    crossBonusNetAdjPct: crossBonus.netBonusAdjustmentPct,

    // ── Phase 1 R2: Multi-dimensional delegation ──
    delegationTier: delegation.tier,
    delegationRuleId: delegation.matchedRuleId,
    delegationRuleLabel: delegation.matchedRuleLabel,
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
  shocks: PricingShocks = DEFAULT_PRICING_SHOCKS,
): Map<string, FTPResult> {
  // Clear caches so stale rule matches from previous batches don't leak
  clearRuleMatchCache();

  const results = new Map<string, FTPResult>();
  for (const deal of deals) {
    if (!deal.id || !deal.productType || deal.amount === 0) continue;
    const result = calculatePricing(deal, approvalMatrix, context, shocks);
    results.set(deal.id, result);
  }

  // Clean up after batch
  clearRuleMatchCache();
  return results;
}
