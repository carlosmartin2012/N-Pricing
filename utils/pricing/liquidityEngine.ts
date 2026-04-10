import type { Transaction, DualLiquidityCurve, SDRConfig, LRConfig } from '../../types';
import { TENOR_MONTHS } from '../pricingConstants';
import { LCR_OUTFLOW_TABLE, NSFR_ASF_TABLE, NSFR_RSF_TABLE, LCR_HQLA_COST_BPS, NSFR_BASE_COST_BPS } from '../../constants/regulations';
import { linearInterpolate } from './interpolation';

// ─── Liquidity Curve Interpolation ──────────────────────────────────────────

type LiquidityPointArray = DualLiquidityCurve['points'];
const liquidityCurveCache = new WeakMap<LiquidityPointArray, { x: number; y: number }[]>();

/** Interpolate LP curve (returns bps). Gap 8: supports secured/unsecured selection */
export function interpolateLiquidityCurve(
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

  let points = liquidityCurveCache.get(curve.points);
  if (!points) {
    points = curve.points
      .map(p => ({ x: TENOR_MONTHS[p.tenor] ?? 0, y: p.termLP }))
      .sort((a, b) => a.x - b.x);
    liquidityCurveCache.set(curve.points, points);
  }
  return linearInterpolate(points, targetMonths);
}

// ─── Blended LP Curve (Gap 2) ───────────────────────────────────────────────

/**
 * Blended LP = ExternalPct × WholesaleSpread + InternalPct × TermPremium
 * Where TermPremium ≈ termLP from the internal curve.
 * Applies 2-point rolling average smoothing per client LP Curve XLSM.
 */
export function calculateBlendedLP(
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

  // Build interpolable array and interpolate using shared utility
  const smoothedXY = points.map((p, i) => ({ x: p.months, y: smoothed[i] }));
  return linearInterpolate(smoothedXY, targetMonths);
}

// ─── SDR Modulation (Gap 12) ────────────────────────────────────────────────

/**
 * SDR benefit modulates LP for deposits.
 * LP_final = LP_base × max(0.5, 1 - max(0, SDR - floor) × multiplier)
 */
export function applySDRModulation(lpPct: number, sdrConfig?: SDRConfig): number {
  if (!sdrConfig) return lpPct;
  const sdrBenefit = Math.max(0, sdrConfig.stableDepositRatio - sdrConfig.sdrFloor);
  const modulator = Math.max(0.5, 1 - sdrBenefit * sdrConfig.sdrImpactMultiplier);
  return lpPct * modulator;
}

// ─── Deposit Stability Classification (Gap 14) ─────────────────────────────

export function classifyDepositStability(deal: Transaction): 'Stable' | 'Semi_Stable' | 'Non_Stable' {
  if (deal.depositStability) return deal.depositStability;

  // Auto-classify based on client type and operational flag
  if (deal.isOperationalSegment) return 'Stable';
  if (deal.clientType === 'Retail') return 'Semi_Stable';
  if (deal.clientType === 'SME') return 'Semi_Stable';
  return 'Non_Stable';
}

// ─── LCR Charge (Gap 4) ────────────────────────────────────────────────────

/**
 * Calculate LCR charge using regulatory outflow table.
 * LCR charge = outflowFactor × HQLA carry cost (bps) → converted to %
 */
export function calculateLCRCharge(deal: Transaction): number {
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
export function calculateNSFRCharge(deal: Transaction): number {
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
export function calculateLiquidityRecharge(
  deal: Transaction,
  lrConfig?: LRConfig,
): number {
  if (!lrConfig) return 0;
  const buWeight = lrConfig.buAllocations[deal.businessUnit] || 0;
  return (lrConfig.totalBufferCostBps * lrConfig.riskAppetiteAddon * buWeight) / 100;
}
