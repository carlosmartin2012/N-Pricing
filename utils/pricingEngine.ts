import {
  Transaction, FTPResult, ApprovalMatrixConfig,
  YieldCurvePoint, DualLiquidityCurve, GeneralRule, FtpRateCard,
  TransitionRateCard, PhysicalRateCard, BehaviouralModel,
  ClientEntity, ProductDefinition, BusinessUnit,
  FormulaSpec, IncentivisationRule, SDRConfig, LRConfig,
} from '../types';
import { PRICING_CONSTANTS as PC, TENOR_MONTHS, CREDIT_PARAMS } from './pricingConstants';
import { matchDealToRule, lookupRateCard } from './ruleMatchingEngine';
import { LCR_OUTFLOW_TABLE, NSFR_ASF_TABLE, NSFR_RSF_TABLE, LCR_HQLA_COST_BPS, NSFR_BASE_COST_BPS } from '../constants/regulations';
import { calculateRAROC, buildRAROCInputsFromDeal } from './rarocEngine';
import {
  MOCK_TRANSITION_GRID, MOCK_PHYSICAL_GRID,
  MOCK_LIQUIDITY_DASHBOARD_DATA, MOCK_LIQUIDITY_CURVES,
  MOCK_YIELD_CURVE, MOCK_BEHAVIOURAL_MODELS,
  MOCK_FTP_RATE_CARDS, MOCK_CLIENTS,
  MOCK_SDR_CONFIG, MOCK_LR_CONFIG, MOCK_INCENTIVISATION_RULES,
} from '../constants';

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

// ─── Curve Interpolation ────────────────────────────────────────────────────

/** Linear interpolation on a yield curve (tenor string → rate) */
export function interpolateYieldCurve(curve: YieldCurvePoint[], targetMonths: number): number {
  if (!curve || curve.length === 0) return 0;
  const points = curve
    .map(p => ({ months: TENOR_MONTHS[p.tenor] ?? 0, rate: p.rate }))
    .sort((a, b) => a.months - b.months);

  if (targetMonths <= points[0].months) return points[0].rate;
  if (targetMonths >= points[points.length - 1].months) return points[points.length - 1].rate;

  const upperIdx = points.findIndex(p => p.months >= targetMonths);
  if (upperIdx <= 0) return points[0].rate;

  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const ratio = (targetMonths - lower.months) / (upper.months - lower.months);
  return lower.rate + ratio * (upper.rate - lower.rate);
}

/** Interpolate LP curve (returns bps). Gap 8: supports secured/unsecured selection */
function interpolateLiquidityCurve(
  curves: DualLiquidityCurve[],
  currency: string,
  targetMonths: number,
  curveType: 'unsecured' | 'secured' = 'unsecured',
): number {
  // Find curve matching currency + type; fallback to any matching currency, then first curve
  const curve =
    curves.find(c => c.currency === currency && c.curveType === curveType) ||
    curves.find(c => c.currency === currency) ||
    curves[0];
  if (!curve || !curve.points.length) return 0;

  const points = curve.points
    .map(p => ({ months: TENOR_MONTHS[p.tenor] ?? 0, lp: p.termLP }))
    .sort((a, b) => a.months - b.months);

  if (targetMonths <= points[0].months) return points[0].lp;
  if (targetMonths >= points[points.length - 1].months) return points[points.length - 1].lp;

  const upperIdx = points.findIndex(p => p.months >= targetMonths);
  if (upperIdx <= 0) return points[0].lp;

  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const ratio = (targetMonths - lower.months) / (upper.months - lower.months);
  return lower.lp + ratio * (upper.lp - lower.lp);
}

// ─── Blended LP Curve (Gap 2) ───────────────────────────────────────────────

/**
 * Blended LP = ExternalPct × WholesaleSpread + InternalPct × TermPremium
 * Where TermPremium ≈ termLP from the internal curve.
 * Applies 2-point rolling average smoothing per client LP Curve XLSM.
 */
function calculateBlendedLP(
  curves: DualLiquidityCurve[],
  currency: string,
  targetMonths: number,
  sdrConfig: SDRConfig,
): number {
  const externalPct = sdrConfig.externalFundingPct;
  const internalPct = 1 - externalPct;

  // External: use wholesale spread from curve
  const curve = curves.find(c => c.currency === currency && c.curveType !== 'secured') || curves[0];
  if (!curve || !curve.points.length) return 0;

  const points = curve.points
    .map(p => ({
      months: TENOR_MONTHS[p.tenor] ?? 0,
      wholesale: p.wholesaleSpread,
      termLP: p.termLP,
    }))
    .sort((a, b) => a.months - b.months);

  // Compute blended for each point, then apply rolling 2-point average
  const blended = points.map(p => externalPct * p.wholesale + internalPct * p.termLP);
  const smoothed = blended.map((val, i) =>
    i === 0 ? val : (val + blended[i - 1]) / 2,
  );

  // Build interpolable array and interpolate
  const smoothedPoints = points.map((p, i) => ({ months: p.months, lp: smoothed[i] }));

  if (targetMonths <= smoothedPoints[0].months) return smoothedPoints[0].lp;
  if (targetMonths >= smoothedPoints[smoothedPoints.length - 1].months) {
    return smoothedPoints[smoothedPoints.length - 1].lp;
  }

  const upperIdx = smoothedPoints.findIndex(p => p.months >= targetMonths);
  if (upperIdx <= 0) return smoothedPoints[0].lp;

  const lower = smoothedPoints[upperIdx - 1];
  const upper = smoothedPoints[upperIdx];
  const ratio = (targetMonths - lower.months) / (upper.months - lower.months);
  return lower.lp + ratio * (upper.lp - lower.lp);
}

// ─── Zero Coupon Bootstrap (Gap 7) ──────────────────────────────────────────

/**
 * Bootstrap zero-coupon rates from a par yield curve.
 * Short-term (<12M): zero ≈ par (simple interest)
 * Long-term: iterative bootstrap with semi-annual compounding
 */
export function bootstrapZeroRates(parCurve: YieldCurvePoint[]): YieldCurvePoint[] {
  const sorted = [...parCurve]
    .map(p => ({ tenor: p.tenor, months: TENOR_MONTHS[p.tenor] ?? 0, rate: p.rate }))
    .sort((a, b) => a.months - b.months);

  const zeroRates: { tenor: string; months: number; rate: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const { tenor, months, rate } = sorted[i];
    if (months <= 12) {
      // Short-term: zero ≈ par
      zeroRates.push({ tenor, months, rate });
    } else {
      // Bootstrap: solve for zero rate
      const periods = Math.round(months / 6); // semi-annual periods
      const coupon = rate / 2; // semi-annual coupon as % of par
      let pvCoupons = 0;

      for (let j = 1; j < periods; j++) {
        const tMonths = j * 6;
        // Interpolate known zero rates for this coupon period
        const zr = interpolateFromZeros(zeroRates, tMonths);
        const df = 1 / Math.pow(1 + zr / 200, j); // semi-annual discount
        pvCoupons += coupon * df;
      }

      // Par = sum(coupon × df) + (100 + coupon) × df_final => df_final
      const dfFinal = (100 - pvCoupons) / (100 + coupon);
      // Convert discount factor back to zero rate (semi-annual)
      const zeroRate = dfFinal > 0
        ? (Math.pow(1 / dfFinal, 1 / periods) - 1) * 200
        : rate;

      zeroRates.push({ tenor, months, rate: zeroRate });
    }
  }

  return zeroRates.map(z => ({ tenor: z.tenor, rate: z.rate }));
}

function interpolateFromZeros(zeros: { months: number; rate: number }[], targetMonths: number): number {
  if (zeros.length === 0) return 0;
  if (targetMonths <= zeros[0].months) return zeros[0].rate;
  if (targetMonths >= zeros[zeros.length - 1].months) return zeros[zeros.length - 1].rate;

  const upperIdx = zeros.findIndex(z => z.months >= targetMonths);
  if (upperIdx <= 0) return zeros[0].rate;

  const lower = zeros[upperIdx - 1];
  const upper = zeros[upperIdx];
  const ratio = (targetMonths - lower.months) / (upper.months - lower.months);
  return lower.rate + ratio * (upper.rate - lower.rate);
}

// ─── Product Formula Dispatcher (Gaps 1, 2, 3, 8) ──────────────────────────

interface FormulaResult {
  baseRate: number;         // %
  liquidityPremiumBps: number; // bps
  formulaUsed: string;
}

/**
 * Infer formula from product/category when no rule formulaSpec exists.
 * Based on Santander Product Level Recommendations.
 */
function inferFormulaFromProduct(deal: Transaction): FormulaSpec {
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

/**
 * Apply product-specific FTP formula.
 * Returns base rate (%), LP (bps), and formula description.
 */
function applyProductFormula(
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

// ─── LCR Charge (Gap 4) ────────────────────────────────────────────────────

/**
 * Calculate LCR charge using regulatory outflow table.
 * LCR charge = outflowFactor × HQLA carry cost (bps) → converted to %
 */
function calculateLCRCharge(deal: Transaction): number {
  let outflowFactor = 0;

  // Try specific lookup key based on product + stability + client type
  if (deal.depositStability) {
    const key = `${deal.productType}_${deal.depositStability}`;
    if (LCR_OUTFLOW_TABLE[key] != null) {
      outflowFactor = LCR_OUTFLOW_TABLE[key];
    }
  }

  // Try product + depositType (operational/non-operational)
  if (!outflowFactor && deal.depositType) {
    const key = `${deal.productType}_${deal.depositType}`;
    if (LCR_OUTFLOW_TABLE[key] != null) {
      outflowFactor = LCR_OUTFLOW_TABLE[key];
    }
  }

  // Try legacy lcrClassification
  if (!outflowFactor && deal.lcrClassification) {
    outflowFactor = LCR_OUTFLOW_TABLE[deal.lcrClassification] || 0;
  }

  // Fallback: use lcrOutflowPct from deal directly
  if (!outflowFactor && deal.lcrOutflowPct) {
    outflowFactor = deal.lcrOutflowPct / 100;
  }

  // Committed credit lines
  if (deal.productType === 'CRED_LINE' && deal.isCommitted) {
    const lineKey = deal.clientType === 'Institution'
      ? 'CRED_LINE_Committed_Financial'
      : deal.clientType === 'Retail'
        ? 'CRED_LINE_Committed_Retail'
        : 'CRED_LINE_Committed_Corporate';
    outflowFactor = LCR_OUTFLOW_TABLE[lineKey] || outflowFactor;
  }

  // LCR charge = outflow factor × HQLA cost (bps → %)
  return outflowFactor * (LCR_HQLA_COST_BPS / 100);
}

// ─── NSFR Charge (Gap 5) ────────────────────────────────────────────────────

/**
 * Calculate NSFR charge/benefit.
 * Assets: RSF factor × NSFR base cost
 * Liabilities: -(1 - ASF factor) × NSFR base cost (benefit for stable funding)
 */
function calculateNSFRCharge(deal: Transaction): number {
  if (deal.category === 'Asset') {
    // Determine RSF key based on product and risk weight
    let rsfKey: string;
    const rw = deal.riskWeight || 100;
    const isLongTerm = deal.durationMonths > 12;

    if (deal.productType === 'LOAN_MORT') {
      rsfKey = rw <= 35 ? 'MORTGAGE_RW_LT35' : 'MORTGAGE_RW_GT35';
    } else if (deal.productType === 'LOAN_AUTO' || deal.productType === 'LOAN_CONS') {
      rsfKey = 'CONSUMER_LOAN';
    } else if (deal.productType === 'CRED_LINE') {
      rsfKey = deal.isCommitted ? 'OFF_BALANCE_COMMITTED' : 'OFF_BALANCE_UNCOMMITTED';
    } else if (isLongTerm) {
      rsfKey = rw <= 35 ? 'LOAN_GT1Y_CORP_RW_LT35' : 'LOAN_GT1Y_CORP_RW_GT35';
    } else {
      rsfKey = 'LOAN_LT1Y_CORP';
    }

    const rsfFactor = NSFR_RSF_TABLE[rsfKey] || 0.85;
    return rsfFactor * (NSFR_BASE_COST_BPS / 100);
  }

  if (deal.category === 'Liability') {
    // ASF benefit — more stable deposits get higher ASF factor (lower cost)
    let asfKey: string;
    switch (deal.depositStability) {
      case 'Stable': asfKey = 'STABLE_DEPOSIT'; break;
      case 'Semi_Stable': asfKey = 'SEMI_STABLE_DEPOSIT'; break;
      case 'Non_Stable': asfKey = 'NON_STABLE_DEPOSIT'; break;
      default:
        asfKey = deal.isOperationalSegment ? 'OPERATIONAL_DEPOSIT' : 'NON_STABLE_DEPOSIT';
    }
    const asfFactor = NSFR_ASF_TABLE[asfKey] || 0.80;
    // Higher ASF = lower cost (benefit)
    return -(1 - asfFactor) * (NSFR_BASE_COST_BPS / 100);
  }

  return 0;
}

// ─── Liquidity Recharge (Gap 3) ─────────────────────────────────────────────

/**
 * LR = totalBufferCost × riskAppetiteAddon × BU allocation weight
 * Returns value in % (not bps)
 */
function calculateLiquidityRecharge(
  deal: Transaction,
  lrConfig?: LRConfig,
): number {
  if (!lrConfig) return 0;
  const buWeight = lrConfig.buAllocations[deal.businessUnit] || 0;
  return (lrConfig.totalBufferCostBps * lrConfig.riskAppetiteAddon * buWeight) / 100;
}

// ─── SDR Modulation (Gap 12) ────────────────────────────────────────────────

/**
 * SDR benefit modulates LP for deposits.
 * LP_final = LP_base × max(0.5, 1 - max(0, SDR - floor) × multiplier)
 */
function applySDRModulation(lpPct: number, sdrConfig?: SDRConfig): number {
  if (!sdrConfig) return lpPct;
  const sdrBenefit = Math.max(0, sdrConfig.stableDepositRatio - sdrConfig.sdrFloor);
  const modulator = Math.max(0.5, 1 - sdrBenefit * sdrConfig.sdrImpactMultiplier);
  return lpPct * modulator;
}

// ─── Deposit Stability Classification (Gap 14) ─────────────────────────────

function classifyDepositStability(deal: Transaction): 'Stable' | 'Semi_Stable' | 'Non_Stable' {
  if (deal.depositStability) return deal.depositStability;

  // Auto-classify based on client type and operational flag
  if (deal.isOperationalSegment) return 'Stable';
  if (deal.clientType === 'Retail') return 'Semi_Stable';
  if (deal.clientType === 'SME') return 'Semi_Stable';
  return 'Non_Stable';
}

// ─── Incentivisation (Gap 11) ───────────────────────────────────────────────

function lookupIncentivisation(
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
function calculateCreditCost(clientRating: string): number {
  const params = CREDIT_PARAMS[clientRating] || CREDIT_PARAMS[PC.DEFAULT_CREDIT_RATING];
  if (!params) return 0.09;
  return (params.pd / 100) * (params.lgd / 100) * 100;
}

function getClientRating(clientId: string, clients: ClientEntity[]): string {
  return clients.find(c => c.id === clientId)?.rating || PC.DEFAULT_CREDIT_RATING;
}

// ─── Behavioural Model Spread (Option Cost) ─────────────────────────────────

function calculateBehaviouralSpread(
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
    const stabilityBenefit = coreRatio * (1 - beta) * 0.40;
    return deal.category === 'Liability' ? -stabilityBenefit : stabilityBenefit * 0.5;
  }

  return 0;
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

  // Currency basis adjustment (Gap 10)
  const currencyAdj = PC.CURRENCY_ADJUSTMENTS[deal.currency];
  if (currencyAdj) rawBaseRate += currencyAdj;

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

  // SDR Modulation for deposits (Gap 12)
  if (deal.category === 'Liability') {
    liquidityPremium = applySDRModulation(liquidityPremium, sdrConfig);
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
    if (deal.undrawnAmount && deal.undrawnAmount > deal.amount) {
      const undrawnRatio = deal.undrawnAmount / (deal.amount || 1);
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
  const method = ruleMatch.methodology || (deal.repricingFreq === 'Fixed' ? 'Matched Maturity' : 'Moving Average');

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
