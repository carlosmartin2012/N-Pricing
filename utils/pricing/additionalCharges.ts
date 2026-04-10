import type { Transaction } from '../../types';

/**
 * CSRBB — Credit Spread Risk in the Banking Book
 * Per EBA GL/2022/14 and BCBS d504.
 *
 * The charge reflects the P&L volatility from changes in credit spreads
 * on non-trading book instruments. Applies mainly to:
 *   - Own funding issuances
 *   - Corporate bonds in the banking book
 *   - Any exposure where the credit spread is a material risk driver
 *
 * Simplified model: base charge per unit of duration × credit quality factor.
 */

/** Base CSRBB charge per year of duration (bps) */
export const CSRBB_BASE_BPS_PER_YEAR = 2.5;

/** CSRBB multiplier by counterparty credit quality */
export const CSRBB_QUALITY_MULTIPLIER: Record<string, number> = {
  'AAA': 0.3,
  'AA': 0.5,
  'A': 0.8,
  'BBB': 1.0,
  'BB': 1.8,
  'B': 3.0,
  'CCC': 5.0,
  'D': 8.0,
};

export interface CSRBBInput {
  durationMonths: number;
  clientRating?: string;
  category: 'Asset' | 'Liability' | 'Off-Balance';
  productType?: string;
}

export interface CSRBBResult {
  /** CSRBB charge in % (not bps) */
  chargePct: number;
  /** Effective duration used */
  durationYears: number;
  /** Quality multiplier applied */
  qualityMultiplier: number;
}

/**
 * Calculate CSRBB charge. Applies only to Assets and Off-Balance exposures
 * (Liabilities don't carry asset-side credit spread risk in this model).
 */
export function calculateCSRBBCharge(input: CSRBBInput): CSRBBResult {
  if (input.category === 'Liability') {
    return { chargePct: 0, durationYears: 0, qualityMultiplier: 0 };
  }

  const durationYears = Math.max(0, input.durationMonths / 12);
  const rating = (input.clientRating ?? 'BBB').toUpperCase();
  const qualityMultiplier = CSRBB_QUALITY_MULTIPLIER[rating] ?? 1.0;

  // Non-linear duration scaling: cap at 10Y to avoid extreme long-end
  const scaledDuration = Math.min(10, durationYears);
  const chargeBps = CSRBB_BASE_BPS_PER_YEAR * scaledDuration * qualityMultiplier;

  return {
    chargePct: chargeBps / 100,
    durationYears,
    qualityMultiplier,
  };
}

/**
 * Contingent Liquidity Charge — Gap 21
 *
 * Charge for undrawn commitments (credit lines, guarantees, standby facilities).
 * Different from LCR outflow (which is a one-time stress), this is a term charge
 * for the contingent liquidity that must be held.
 *
 * Formula: undrawnRatio × contingentFactor × liquidityBufferCost
 * Where contingentFactor depends on product type and commitment level.
 */

/** Base cost of holding 1% of HQLA against contingent exposure (bps/year) */
export const CONTINGENT_LIQUIDITY_COST_BPS = 15;

/** Contingent draw factor by product type (expected utilization of undrawn) */
export const CONTINGENT_DRAW_FACTOR: Record<string, number> = {
  'CRED_LINE_Committed_Retail': 0.05,
  'CRED_LINE_Committed_Corporate': 0.10,
  'CRED_LINE_Committed_Financial': 0.40,
  'CRED_LINE_Uncommitted': 0.02,
  'GUARANTEE_Performance': 0.05,
  'GUARANTEE_Financial': 0.20,
  'STANDBY_LC': 0.30,
  'DEFAULT': 0.05,
};

export interface ContingentLiquidityInput {
  productType: string;
  amount: number;           // drawn amount
  undrawnAmount?: number;   // committed but not drawn
  isCommitted?: boolean;
  clientType?: string;
}

export interface ContingentLiquidityResult {
  /** Charge in % of drawn amount (not bps) */
  chargePct: number;
  /** Effective draw factor used */
  drawFactor: number;
  /** Undrawn / drawn ratio */
  undrawnRatio: number;
}

/**
 * Calculate contingent liquidity charge.
 * Returns 0 for products with no undrawn commitment.
 */
export function calculateContingentLiquidityCharge(
  input: ContingentLiquidityInput,
): ContingentLiquidityResult {
  const undrawn = input.undrawnAmount ?? 0;
  const drawn = Math.max(1, input.amount);

  if (undrawn <= 0) {
    return { chargePct: 0, drawFactor: 0, undrawnRatio: 0 };
  }

  // Determine draw factor key
  let factorKey = 'DEFAULT';
  if (input.productType === 'CRED_LINE') {
    if (input.isCommitted) {
      if (input.clientType === 'Retail') factorKey = 'CRED_LINE_Committed_Retail';
      else if (input.clientType === 'Institution') factorKey = 'CRED_LINE_Committed_Financial';
      else factorKey = 'CRED_LINE_Committed_Corporate';
    } else {
      factorKey = 'CRED_LINE_Uncommitted';
    }
  } else if (input.productType?.startsWith('GUARANTEE')) {
    factorKey = input.productType;
  } else if (input.productType === 'STANDBY_LC') {
    factorKey = 'STANDBY_LC';
  }

  const drawFactor = CONTINGENT_DRAW_FACTOR[factorKey] ?? CONTINGENT_DRAW_FACTOR.DEFAULT;
  const undrawnRatio = undrawn / drawn;

  // Charge = expected undrawn draw × liquidity cost, scaled per drawn unit
  const chargeBps = undrawnRatio * drawFactor * CONTINGENT_LIQUIDITY_COST_BPS;

  return {
    chargePct: chargeBps / 100,
    drawFactor,
    undrawnRatio,
  };
}

/**
 * Helper: extract CSRBB + CL inputs from a Transaction and run both.
 * Returns the combined additional charges to add to totalLiquidityCost.
 */
export function calculateAdditionalFTPCharges(
  deal: Transaction,
  clientRating?: string,
): {
  csrbb: CSRBBResult;
  contingentLiquidity: ContingentLiquidityResult;
  totalAdditionalChargePct: number;
} {
  const csrbb = calculateCSRBBCharge({
    durationMonths: deal.durationMonths,
    clientRating,
    category: deal.category,
    productType: deal.productType,
  });

  const contingentLiquidity = calculateContingentLiquidityCharge({
    productType: deal.productType,
    amount: deal.amount,
    undrawnAmount: deal.undrawnAmount,
    isCommitted: deal.isCommitted,
    clientType: deal.clientType,
  });

  return {
    csrbb,
    contingentLiquidity,
    totalAdditionalChargePct: csrbb.chargePct + contingentLiquidity.chargePct,
  };
}
