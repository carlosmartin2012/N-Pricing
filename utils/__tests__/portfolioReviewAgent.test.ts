import { describe, it, expect } from 'vitest';
import {
  detectUnderpricingClusters,
  identifyRepricingCandidates,
  identifyRenegotiationCandidates,
  runPortfolioReview,
  buildPortfolioReviewPrompt,
  type PortfolioDeal,
} from '../pricing/portfolioReviewAgent';
import type { FTPResult, Transaction } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseFtpResult: FTPResult = {
  baseRate: 3.0,
  liquiditySpread: 0.5,
  _liquidityPremiumDetails: 0,
  _clcChargeDetails: 0,
  strategicSpread: 0,
  optionCost: 0,
  regulatoryCost: 0.3,
  operationalCost: 0.2,
  capitalCharge: 1.0,
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  floorPrice: 4.0,
  technicalPrice: 4.5,
  targetPrice: 5.0,
  totalFTP: 3.5,
  finalClientRate: 5.5,
  raroc: 15.0,
  economicProfit: 50_000,
  approvalLevel: 'Auto',
  accountingEntry: {
    source: 'BU-001',
    dest: 'BU-900',
    amountDebit: 0,
    amountCredit: 0,
  },
  matchedMethodology: 'TEST',
  matchReason: 'fixture',
};

const baseTransaction: Transaction = {
  id: 'DEAL-BASE',
  clientId: 'CLIENT-001',
  clientType: 'Corporate',
  businessUnit: 'BU_CORP',
  fundingBusinessUnit: 'BU_TREASURY',
  businessLine: 'CORP_LENDING',
  productType: 'LOAN_MORT',
  category: 'Asset',
  currency: 'EUR',
  amount: 1_000_000,
  startDate: '2025-01-01',
  durationMonths: 60,
  amortization: 'Bullet',
  repricingFreq: 'Quarterly',
  marginTarget: 2.0,
  riskWeight: 1.0,
  capitalRatio: 0.08,
  targetROE: 15.0,
  operationalCostBps: 20,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

function makeDeal(overrides: {
  deal?: Partial<Transaction>;
  result?: Partial<FTPResult>;
}): PortfolioDeal {
  return {
    deal: { ...baseTransaction, ...overrides.deal },
    result: { ...baseFtpResult, ...overrides.result },
  };
}

// ---------------------------------------------------------------------------
// detectUnderpricingClusters
// ---------------------------------------------------------------------------

describe('detectUnderpricingClusters', () => {
  it('returns no clusters for an empty portfolio', () => {
    expect(detectUnderpricingClusters([])).toEqual([]);
  });

  it('returns no clusters when only one deal matches (below minClusterSize)', () => {
    const portfolio = [
      makeDeal({ deal: { id: 'D1' }, result: { raroc: 5 } }),
    ];
    expect(detectUnderpricingClusters(portfolio)).toEqual([]);
  });

  it('flags a cluster with 3+ severely underpriced deals as HIGH severity', () => {
    const portfolio = [
      makeDeal({ deal: { id: 'D1', targetROE: 15 }, result: { raroc: 5 } }),
      makeDeal({ deal: { id: 'D2', targetROE: 15 }, result: { raroc: 6 } }),
      makeDeal({ deal: { id: 'D3', targetROE: 15 }, result: { raroc: 4 } }),
    ];
    const clusters = detectUnderpricingClusters(portfolio);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].severity).toBe('HIGH');
    expect(clusters[0].dealCount).toBe(3);
    expect(clusters[0].hurdleRate).toBe(15);
    expect(clusters[0].avgDelta).toBeLessThan(-5);
    expect(clusters[0].sampleDealIds).toEqual(['D1', 'D2', 'D3']);
  });

  it('does not flag a cluster when avg RAROC is at or above hurdle', () => {
    const portfolio = [
      makeDeal({ deal: { id: 'D1', targetROE: 10 }, result: { raroc: 15 } }),
      makeDeal({ deal: { id: 'D2', targetROE: 10 }, result: { raroc: 16 } }),
      makeDeal({ deal: { id: 'D3', targetROE: 10 }, result: { raroc: 14 } }),
    ];
    expect(detectUnderpricingClusters(portfolio)).toEqual([]);
  });

  it('separates clusters by dimensions (productType/businessUnit/clientType)', () => {
    const portfolio = [
      // Cluster A: LOAN_MORT / BU_CORP / Corporate
      makeDeal({
        deal: { id: 'A1', productType: 'LOAN_MORT', businessUnit: 'BU_CORP', clientType: 'Corporate', targetROE: 15 },
        result: { raroc: 5 },
      }),
      makeDeal({
        deal: { id: 'A2', productType: 'LOAN_MORT', businessUnit: 'BU_CORP', clientType: 'Corporate', targetROE: 15 },
        result: { raroc: 6 },
      }),
      makeDeal({
        deal: { id: 'A3', productType: 'LOAN_MORT', businessUnit: 'BU_CORP', clientType: 'Corporate', targetROE: 15 },
        result: { raroc: 7 },
      }),
      // Cluster B: different productType, all healthy
      makeDeal({
        deal: { id: 'B1', productType: 'LOAN_CORP', businessUnit: 'BU_CORP', clientType: 'Corporate', targetROE: 10 },
        result: { raroc: 15 },
      }),
    ];
    const clusters = detectUnderpricingClusters(portfolio);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].id).toBe('LOAN_MORT|BU_CORP|Corporate');
  });
});

// ---------------------------------------------------------------------------
// identifyRepricingCandidates
// ---------------------------------------------------------------------------

describe('identifyRepricingCandidates', () => {
  it('excludes Fixed-rate deals even if underpriced', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'FIX1', repricingFreq: 'Fixed', targetROE: 15 },
        result: { raroc: 5 },
      }),
    ];
    expect(identifyRepricingCandidates(portfolio)).toEqual([]);
  });

  it('includes variable-rate deals below hurdle with rationale', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'VAR1', repricingFreq: 'Quarterly', targetROE: 15, marginTarget: 2.0 },
        result: { raroc: 5 },
      }),
    ];
    const candidates = identifyRepricingCandidates(portfolio);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dealId).toBe('VAR1');
    expect(candidates[0].repricingFreq).toBe('Quarterly');
    expect(candidates[0].suggestedMargin).toBeGreaterThan(candidates[0].currentMargin);
    expect(candidates[0].expectedRarocUplift).toBeGreaterThan(0);
    expect(candidates[0].rationale).toContain('quarterly');
    expect(candidates[0].rationale).toContain('below hurdle');
  });

  it('sorts candidates by amount × expected uplift (biggest impact first)', () => {
    const portfolio = [
      // Small amount, big gap
      makeDeal({
        deal: { id: 'SMALL', amount: 100_000, repricingFreq: 'Monthly', targetROE: 15 },
        result: { raroc: 0 },
      }),
      // Large amount, smaller gap (but bigger $ impact)
      makeDeal({
        deal: { id: 'LARGE', amount: 50_000_000, repricingFreq: 'Monthly', targetROE: 15 },
        result: { raroc: 10 },
      }),
    ];
    const candidates = identifyRepricingCandidates(portfolio);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].dealId).toBe('LARGE');
    expect(candidates[1].dealId).toBe('SMALL');
  });

  it('excludes deals within threshold of hurdle', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'OK', repricingFreq: 'Monthly', targetROE: 15 },
        result: { raroc: 14 }, // only 1pp below, under default 2pp threshold
      }),
    ];
    expect(identifyRepricingCandidates(portfolio)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// identifyRenegotiationCandidates
// ---------------------------------------------------------------------------

describe('identifyRenegotiationCandidates', () => {
  it('excludes small-amount deals below minAmount', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'SMALL', amount: 100_000, durationMonths: 60, targetROE: 15 },
        result: { raroc: 5 },
      }),
    ];
    expect(identifyRenegotiationCandidates(portfolio)).toEqual([]);
  });

  it('excludes deals with short remaining duration', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'SHORT', amount: 5_000_000, durationMonths: 6, targetROE: 15 },
        result: { raroc: 5 },
      }),
    ];
    expect(identifyRenegotiationCandidates(portfolio)).toEqual([]);
  });

  it('includes large, long-duration, underpriced deals', () => {
    const portfolio = [
      makeDeal({
        deal: {
          id: 'BIG',
          amount: 10_000_000,
          durationMonths: 60,
          targetROE: 15,
          clientId: 'C-ACME',
        },
        result: { raroc: 5 },
      }),
    ];
    const candidates = identifyRenegotiationCandidates(portfolio);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dealId).toBe('BIG');
    expect(candidates[0].clientId).toBe('C-ACME');
    expect(candidates[0].marginHeadroomBps).toBeGreaterThan(0);
    expect(candidates[0].reason).toContain('below hurdle');
  });
});

// ---------------------------------------------------------------------------
// runPortfolioReview
// ---------------------------------------------------------------------------

describe('runPortfolioReview', () => {
  it('integrates all detectors and produces consolidated summary', () => {
    const portfolio = [
      // Healthy deal
      makeDeal({
        deal: { id: 'OK1', amount: 2_000_000, targetROE: 10 },
        result: { raroc: 20 },
      }),
      // Severely underpriced cluster (3 deals)
      makeDeal({
        deal: {
          id: 'BAD1',
          amount: 5_000_000,
          productType: 'LOAN_MORT',
          targetROE: 15,
          durationMonths: 60,
          repricingFreq: 'Quarterly',
        },
        result: { raroc: 5 },
      }),
      makeDeal({
        deal: {
          id: 'BAD2',
          amount: 5_000_000,
          productType: 'LOAN_MORT',
          targetROE: 15,
          durationMonths: 60,
          repricingFreq: 'Quarterly',
        },
        result: { raroc: 6 },
      }),
      makeDeal({
        deal: {
          id: 'BAD3',
          amount: 5_000_000,
          productType: 'LOAN_MORT',
          targetROE: 15,
          durationMonths: 60,
          repricingFreq: 'Quarterly',
        },
        result: { raroc: 4 },
      }),
    ];

    const result = runPortfolioReview(portfolio, '2026-04-09');

    expect(result.asOfDate).toBe('2026-04-09');
    expect(result.dealsAnalyzed).toBe(4);
    expect(result.totalPortfolioAmount).toBe(17_000_000);
    expect(result.underpricingClusters.length).toBeGreaterThanOrEqual(1);
    expect(result.repricingCandidates.length).toBe(3);
    expect(result.renegotiationCandidates.length).toBe(3);
    expect(result.summary.clustersDetected).toBe(result.underpricingClusters.length);
  });

  it('computes summary stats correctly (underpriced count & amount)', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'OK', amount: 1_000_000, targetROE: 10 },
        result: { raroc: 15 },
      }),
      makeDeal({
        deal: { id: 'BAD', amount: 3_000_000, targetROE: 15 },
        result: { raroc: 5 },
      }),
    ];
    const result = runPortfolioReview(portfolio);
    expect(result.summary.underpricedDealCount).toBe(1);
    expect(result.summary.underpricedAmount).toBe(3_000_000);
    expect(result.summary.underpricedAmountPct).toBeCloseTo(75, 1); // 3M / 4M
  });

  it('handles empty portfolio gracefully', () => {
    const result = runPortfolioReview([]);
    expect(result.dealsAnalyzed).toBe(0);
    expect(result.totalPortfolioAmount).toBe(0);
    expect(result.averagePortfolioRaroc).toBe(0);
    expect(result.underpricingClusters).toEqual([]);
    expect(result.summary.underpricedAmountPct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildPortfolioReviewPrompt
// ---------------------------------------------------------------------------

describe('buildPortfolioReviewPrompt', () => {
  it('builds a Spanish prompt including key metrics', () => {
    const portfolio = [
      makeDeal({
        deal: { id: 'D1', amount: 2_000_000, targetROE: 15 },
        result: { raroc: 5 },
      }),
      makeDeal({
        deal: { id: 'D2', amount: 3_000_000, targetROE: 15 },
        result: { raroc: 6 },
      }),
      makeDeal({
        deal: { id: 'D3', amount: 1_000_000, targetROE: 15 },
        result: { raroc: 4 },
      }),
    ];
    const result = runPortfolioReview(portfolio, '2026-04-09');
    const prompt = buildPortfolioReviewPrompt(result, 'es');

    expect(prompt).toContain('Fecha: 2026-04-09');
    expect(prompt).toContain('Deals analizados: 3');
    expect(prompt).toContain('RAROC medio cartera');
    expect(prompt).toContain('Clusters detectados');
    expect(prompt).toContain('español');
  });

  it('builds an English prompt when language is en', () => {
    const result = runPortfolioReview([], '2026-04-09');
    const prompt = buildPortfolioReviewPrompt(result, 'en');
    expect(prompt).toContain('Date: 2026-04-09');
    expect(prompt).toContain('Deals analyzed: 0');
    expect(prompt).toContain('English');
  });
});

// ---------------------------------------------------------------------------
// Regulatory edge cases — pin invariants a MRM validator would check.
// The worst failure mode for a portfolio agent is a silent false-positive:
// a cluster that lands in the committee pack when it shouldn't, or a
// cluster that *doesn't* land when it should.
// ---------------------------------------------------------------------------

describe('detectUnderpricingClusters — regulatory edge cases', () => {
  it('drops clusters whose total amount sums to zero (avoids NaN weighted avg)', () => {
    // Three deals with amount=0 form a cluster but the weighted mean
    // would divide by zero. The agent must skip silently.
    const portfolio = [
      makeDeal({ deal: { id: 'A', amount: 0 }, result: { raroc: 5 } }),
      makeDeal({ deal: { id: 'B', amount: 0 }, result: { raroc: 5 } }),
      makeDeal({ deal: { id: 'C', amount: 0 }, result: { raroc: 5 } }),
    ];
    expect(detectUnderpricingClusters(portfolio, 2, 3)).toEqual([]);
  });

  it('severity boundary: avgDelta exactly -5pp is MEDIUM, not HIGH', () => {
    // avgDelta = -5.0 should fall into MEDIUM (the code uses strict `<`).
    const portfolio = Array.from({ length: 3 }, (_, i) =>
      makeDeal({
        deal: { id: `D-${i}`, amount: 1_000_000, targetROE: 15 },
        result: { raroc: 10 }, // avgDelta = -5.0
      }),
    );
    const clusters = detectUnderpricingClusters(portfolio, 2, 3);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].severity).toBe('MEDIUM');
    expect(clusters[0].avgDelta).toBeCloseTo(-5, 4);
  });

  it('severity boundary: avgDelta below -5pp by a hair is HIGH', () => {
    const portfolio = Array.from({ length: 3 }, (_, i) =>
      makeDeal({
        deal: { id: `D-${i}`, amount: 1_000_000, targetROE: 15 },
        result: { raroc: 9.99 }, // avgDelta ~ -5.01 → HIGH
      }),
    );
    const clusters = detectUnderpricingClusters(portfolio, 2, 3);
    expect(clusters[0].severity).toBe('HIGH');
  });

  it('underpricingThreshold of 0 still excludes clusters above hurdle (no inversion)', () => {
    // A threshold of 0 should NOT flag deals that are at or above hurdle.
    // Regression guard: early versions could treat threshold=0 as
    // "everything is underpriced".
    const portfolio = Array.from({ length: 3 }, (_, i) =>
      makeDeal({
        deal: { id: `D-${i}`, amount: 1_000_000, targetROE: 15 },
        result: { raroc: 18 }, // above hurdle
      }),
    );
    const clusters = detectUnderpricingClusters(portfolio, 0, 3);
    expect(clusters).toEqual([]);
  });

  it('sorts HIGH severity clusters ahead of MEDIUM regardless of amount', () => {
    const portfolio = [
      // MEDIUM, huge amount (€50M)
      ...Array.from({ length: 3 }, (_, i) => makeDeal({
        deal: { id: `M-${i}`, productType: 'LOAN_PYME', amount: 50_000_000, targetROE: 15 },
        result: { raroc: 10 },
      })),
      // HIGH, small amount (€1M)
      ...Array.from({ length: 3 }, (_, i) => makeDeal({
        deal: { id: `H-${i}`, productType: 'LOAN_MORT', amount: 1_000_000, targetROE: 15 },
        result: { raroc: 5 },
      })),
    ];
    const clusters = detectUnderpricingClusters(portfolio, 2, 3);
    expect(clusters[0].severity).toBe('HIGH');
    expect(clusters[1].severity).toBe('MEDIUM');
  });

  it('produces at most 5 sample deal ids for drilldown (committee packs manageable)', () => {
    const portfolio = Array.from({ length: 10 }, (_, i) =>
      makeDeal({
        deal: { id: `D-${i}`, amount: 1_000_000, targetROE: 15 },
        result: { raroc: 5 },
      }),
    );
    const clusters = detectUnderpricingClusters(portfolio, 2, 3);
    expect(clusters[0].sampleDealIds.length).toBeLessThanOrEqual(5);
  });
});

describe('runPortfolioReview — consolidated invariants', () => {
  it('summary.underpricedCount equals the number of deals below hurdle - threshold', () => {
    const portfolio = [
      // 2 below hurdle by >2pp
      makeDeal({ deal: { id: 'A', amount: 1_000_000, targetROE: 15 }, result: { raroc: 5 } }),
      makeDeal({ deal: { id: 'B', amount: 1_000_000, targetROE: 15 }, result: { raroc: 6 } }),
      // 1 above hurdle
      makeDeal({ deal: { id: 'C', amount: 1_000_000, targetROE: 15 }, result: { raroc: 18 } }),
    ];
    const review = runPortfolioReview(portfolio, '2026-04-09');
    expect(review.summary.underpricedDealCount).toBe(2);
  });

  it('summary.underpricedAmount stays finite even when raroc inputs are NaN/Infinity', () => {
    // Regression note (2026-04-23): averagePortfolioRaroc currently
    // propagates NaN when deals contain NaN raroc — a resilience gap
    // flagged here but out of scope for this test PR. The amount
    // aggregates (which drive committee packs) remain finite because
    // they only sum amounts, not rarocs. Track the propagation fix
    // under utils/pricing/portfolioReviewAgent.ts weightedRaroc guard.
    const portfolio = [
      makeDeal({ deal: { id: 'X', amount: 1_000_000 }, result: { raroc: Number.NaN } }),
      makeDeal({ deal: { id: 'Y', amount: 1_000_000 }, result: { raroc: Number.POSITIVE_INFINITY } }),
    ];
    const review = runPortfolioReview(portfolio, '2026-04-09');
    // The aggregate amount is always finite (sum of finite amounts).
    expect(Number.isFinite(review.summary.underpricedAmount)).toBe(true);
    expect(Number.isFinite(review.summary.underpricedAmountPct)).toBe(true);
    expect(review.summary.clustersDetected).toBeGreaterThanOrEqual(0);
  });
});
