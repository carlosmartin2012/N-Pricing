import { describe, it, expect } from 'vitest';
import {
  extractExpectedFromSnapshot,
  calculateRealizedRaroc,
  compareExpectedVsRealized,
  detectSystematicUnderpricing,
  type ExpectedRaroc,
  type RealizedPerformance,
  type ExPostComparisonResult,
} from '../pricing/expostRaroc';
import type { FTPResult, Transaction } from '../../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseDeal: Pick<Transaction, 'amount' | 'marginTarget' | 'feeIncome' | 'operationalCostBps'> = {
  amount: 10_000_000,
  marginTarget: 2.0,       // 2.0%
  feeIncome: 5_000,        // €5k annual fee
  operationalCostBps: 20,  // 20bps
};

const baseSnapshot: FTPResult = {
  baseRate: 3.0,
  liquiditySpread: 0.5,
  _liquidityPremiumDetails: 0,
  _clcChargeDetails: 0,
  strategicSpread: 0,
  optionCost: 0,
  regulatoryCost: 0.3,     // 0.3% ECL
  operationalCost: 0.2,
  capitalCharge: 1.0,      // 1.0%
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  floorPrice: 4.0,
  technicalPrice: 4.5,
  targetPrice: 5.0,
  totalFTP: 3.5,           // 3.5% cost of funds
  finalClientRate: 5.5,
  raroc: 15.0,             // 15% expected RAROC
  economicProfit: 50_000,
  approvalLevel: 'Auto',
  accountingEntry: {
    source: 'BU-001',
    dest: 'BU-900',
    amountDebit: 0,
    amountCredit: 0,
  },
  matchedMethodology: 'TEST',
  matchReason: 'test fixture',
};

const baseExpected: ExpectedRaroc = {
  dealId: 'DEAL-001',
  expectedRaroc: 15.0,
  expectedRevenue: 200_000,
  expectedEcl: 30_000,
  expectedCof: 350_000,
  expectedOpCost: 20_000,
  expectedCapital: 1_000_000,
};

const basePerformance: RealizedPerformance = {
  dealId: 'DEAL-001',
  asOfDate: '2025-06-30',
  // 6-month observation, already matching annual expectations when annualized
  realizedRevenue: 100_000,       // → 200k annualized
  realizedCreditLosses: 15_000,   // → 30k annualized
  realizedCostOfFunds: 175_000,   // → 350k annualized
  realizedOperatingCost: 10_000,  // → 20k annualized
  allocatedCapital: 1_000_000,
  riskFreeRate: 3.0,              // 3%: contributes 30k capital income
  observationMonths: 6,
};

// ---------------------------------------------------------------------------
// extractExpectedFromSnapshot
// ---------------------------------------------------------------------------

describe('extractExpectedFromSnapshot', () => {
  it('reconstructs expected components from a pricing snapshot', () => {
    const result = extractExpectedFromSnapshot('DEAL-XYZ', baseDeal, baseSnapshot);

    expect(result.dealId).toBe('DEAL-XYZ');
    expect(result.expectedRaroc).toBeCloseTo(15.0, 4);
    // 10M * 2% + 5k fee = 205k
    expect(result.expectedRevenue).toBeCloseTo(205_000, 2);
    // 10M * 3.5% = 350k
    expect(result.expectedCof).toBeCloseTo(350_000, 2);
    // 10M * 20bps = 20k
    expect(result.expectedOpCost).toBeCloseTo(20_000, 2);
    // 10M * 0.3% = 30k
    expect(result.expectedEcl).toBeCloseTo(30_000, 2);
    // 10M * (1% capitalCharge / 100) * 10 = 1M
    expect(result.expectedCapital).toBeCloseTo(1_000_000, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateRealizedRaroc
// ---------------------------------------------------------------------------

describe('calculateRealizedRaroc', () => {
  it('annualizes a 6-month observation correctly', () => {
    const r = calculateRealizedRaroc(basePerformance);

    expect(r.revenueAnnualized).toBeCloseTo(200_000, 2);
    expect(r.creditLossesAnnualized).toBeCloseTo(30_000, 2);
    expect(r.cofAnnualized).toBeCloseTo(350_000, 2);
    expect(r.opCostAnnualized).toBeCloseTo(20_000, 2);
    // risk-adjusted return = 200k - 350k - 30k - 20k + (1M * 3%) = -170k
    // RAROC = -170k / 1M * 100 = -17
    expect(r.annualizedRaroc).toBeCloseTo(-17.0, 4);
  });

  it('returns 0 RAROC when allocated capital is zero (guard)', () => {
    const r = calculateRealizedRaroc({
      ...basePerformance,
      allocatedCapital: 0,
    });
    expect(r.annualizedRaroc).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// compareExpectedVsRealized
// ---------------------------------------------------------------------------

describe('compareExpectedVsRealized', () => {
  it('realized equals expected → rarocDelta near zero (after accounting for capital income convention)', () => {
    // Build an expected fixture whose RAROC matches the realized calc exactly.
    // Realized RAROC above evaluates to -17 (because COF > revenue in the expected fixture).
    // Align expected to that number so delta ≈ 0.
    const alignedExpected: ExpectedRaroc = {
      ...baseExpected,
      expectedRaroc: -17.0,
    };
    const result = compareExpectedVsRealized(alignedExpected, basePerformance);
    expect(result.rarocDelta).toBeCloseTo(0, 4);
    expect(result.isUnderpriced).toBe(false);
  });

  it('realized < expected → isUnderpriced true with default threshold', () => {
    // expected = 15%, realized = -17% → delta = -32 → underpriced
    const result = compareExpectedVsRealized(baseExpected, basePerformance);
    expect(result.rarocDelta).toBeLessThan(-2);
    expect(result.isUnderpriced).toBe(true);
  });

  it('realized > expected → isUnderpriced false, positive delta', () => {
    // Higher revenue, lower COF → realized RAROC much higher than -17
    const goodPerf: RealizedPerformance = {
      ...basePerformance,
      realizedRevenue: 500_000,       // → 1M annualized
      realizedCostOfFunds: 50_000,    // → 100k annualized
      realizedCreditLosses: 5_000,    // → 10k annualized
      realizedOperatingCost: 5_000,   // → 10k annualized
    };
    // Align expected low so we can observe positive delta
    const lowExpected: ExpectedRaroc = { ...baseExpected, expectedRaroc: 5.0 };
    const result = compareExpectedVsRealized(lowExpected, goodPerf);
    expect(result.rarocDelta).toBeGreaterThan(0);
    expect(result.isUnderpriced).toBe(false);
  });

  it('attribution: higher realized losses produce negative creditLossContribution', () => {
    const worsePerf: RealizedPerformance = {
      ...basePerformance,
      realizedCreditLosses: 50_000, // → 100k annualized (vs expected 30k)
    };
    const result = compareExpectedVsRealized(baseExpected, worsePerf);
    // -(100k - 30k) = -70k
    expect(result.attribution.creditLossContribution).toBeCloseTo(-70_000, 2);
  });

  it('attribution: higher realized revenue produces positive revenueContribution', () => {
    const betterPerf: RealizedPerformance = {
      ...basePerformance,
      realizedRevenue: 150_000, // → 300k annualized (vs expected 200k)
    };
    const result = compareExpectedVsRealized(baseExpected, betterPerf);
    // 300k - 200k = 100k
    expect(result.attribution.revenueContribution).toBeCloseTo(100_000, 2);
  });
});

// ---------------------------------------------------------------------------
// detectSystematicUnderpricing
// ---------------------------------------------------------------------------

function makeComparison(
  dealId: string,
  rarocDelta: number,
  attributionOverrides: Partial<ExPostComparisonResult['attribution']> = {},
): ExPostComparisonResult {
  return {
    dealId,
    expected: { ...baseExpected, dealId },
    realized: {
      annualizedRaroc: baseExpected.expectedRaroc + rarocDelta,
      revenueAnnualized: 200_000,
      creditLossesAnnualized: 30_000,
      cofAnnualized: 350_000,
      opCostAnnualized: 20_000,
    },
    rarocDelta,
    isUnderpriced: rarocDelta < -2.0,
    attribution: {
      revenueContribution: 0,
      creditLossContribution: 0,
      cofContribution: 0,
      opCostContribution: 0,
      capitalContribution: 0,
      ...attributionOverrides,
    },
  };
}

describe('detectSystematicUnderpricing', () => {
  it('requires a minimum number of observations (default 3)', () => {
    const comparisons = [
      makeComparison('DEAL-A', -20),
      makeComparison('DEAL-A', -15),
      // Only 2 observations for DEAL-A
    ];
    const alerts = detectSystematicUnderpricing(comparisons);
    expect(alerts).toHaveLength(0);
  });

  it('consistent significant underpricing is flagged as HIGH severity', () => {
    const comparisons = [
      makeComparison('DEAL-A', -20, { creditLossContribution: -100_000 }),
      makeComparison('DEAL-A', -18, { creditLossContribution: -90_000 }),
      makeComparison('DEAL-A', -22, { creditLossContribution: -110_000 }),
    ];
    const alerts = detectSystematicUnderpricing(comparisons);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].dealId).toBe('DEAL-A');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].averageDelta).toBeCloseTo(-20, 4);
    expect(alerts[0].observationCount).toBe(3);
    expect(alerts[0].dominantDriver).toBe('CREDIT_LOSS');
  });

  it('mixed results below 50% underpriced are not flagged', () => {
    const comparisons = [
      makeComparison('DEAL-B', -5),  // underpriced
      makeComparison('DEAL-B', 3),   // not underpriced
      makeComparison('DEAL-B', 4),   // not underpriced
      makeComparison('DEAL-B', 2),   // not underpriced
    ];
    const alerts = detectSystematicUnderpricing(comparisons);
    expect(alerts.find(a => a.dealId === 'DEAL-B')).toBeUndefined();
  });

  it('sorts alerts by severity (HIGH → MEDIUM → LOW)', () => {
    const comparisons = [
      // DEAL-LOW: avg -3 → LOW
      makeComparison('DEAL-LOW', -3),
      makeComparison('DEAL-LOW', -4),
      makeComparison('DEAL-LOW', -3),
      // DEAL-HIGH: avg -15 → HIGH
      makeComparison('DEAL-HIGH', -15),
      makeComparison('DEAL-HIGH', -14),
      makeComparison('DEAL-HIGH', -16),
      // DEAL-MED: avg -7 → MEDIUM
      makeComparison('DEAL-MED', -7),
      makeComparison('DEAL-MED', -6),
      makeComparison('DEAL-MED', -8),
    ];
    const alerts = detectSystematicUnderpricing(comparisons);
    expect(alerts).toHaveLength(3);
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[1].severity).toBe('MEDIUM');
    expect(alerts[2].severity).toBe('LOW');
    expect(alerts[0].dealId).toBe('DEAL-HIGH');
    expect(alerts[1].dealId).toBe('DEAL-MED');
    expect(alerts[2].dealId).toBe('DEAL-LOW');
  });
});
