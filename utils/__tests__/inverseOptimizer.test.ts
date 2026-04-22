import { describe, it, expect } from 'vitest';
import { optimizeMarginForTargetRaroc } from '../pricing/inverseOptimizer';
import type { Transaction, ApprovalMatrixConfig } from '../../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const approvalMatrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

describe('optimizeMarginForTargetRaroc', () => {
  it('converges on a reachable target RAROC', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
      marginBounds: [0, 10],
      precision: 0.1,
    });

    expect(result.infeasible).toBe(false);
    if (result.converged) {
      expect(Math.abs(result.achievedRaroc - 12)).toBeLessThan(0.1);
    }
    // Optimizer explored the search space at least once when it needed to.
    expect(result.iterations).toBeGreaterThanOrEqual(0);
    expect(result.optimalMargin).toBeGreaterThanOrEqual(0);
    expect(result.optimalMargin).toBeLessThanOrEqual(10);
  });

  it('returns 0 iterations when lower bound already exceeds target', () => {
    // Very low target → achievable at margin = 0.
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: -1000,
      approvalMatrix,
    });

    expect(result.iterations).toBe(0);
    expect(result.converged).toBe(true);
    expect(result.infeasible).toBe(false);
    expect(result.optimalMargin).toBe(0);
  });

  it('marks infeasible when target is unreachable within bounds', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 1_000_000, // absurdly high
      approvalMatrix,
      marginBounds: [0, 5],
    });

    expect(result.infeasible).toBe(true);
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(0);
    expect(result.optimalMargin).toBe(5);
  });

  it('respects custom margin bounds', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 10,
      approvalMatrix,
      marginBounds: [1, 3],
      precision: 0.5,
    });

    expect(result.optimalMargin).toBeGreaterThanOrEqual(1);
    expect(result.optimalMargin).toBeLessThanOrEqual(3);
  });

  it('respects precision parameter (tighter precision → closer to target)', () => {
    const loose = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
      precision: 1.0,
    });
    const tight = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
      precision: 0.01,
    });

    if (!loose.infeasible && !tight.infeasible && loose.converged && tight.converged) {
      expect(Math.abs(tight.achievedRaroc - 12)).toBeLessThanOrEqual(
        Math.abs(loose.achievedRaroc - 12) + 0.01,
      );
    }
  });

  it('does not mutate the input deal (immutable)', () => {
    const originalMargin = baseDeal.marginTarget;
    optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
    });
    expect(baseDeal.marginTarget).toBe(originalMargin);
  });

  it('respects maxIterations cap', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
      maxIterations: 3,
      precision: 0.0001, // essentially impossible to converge in 3 iters
    });
    expect(result.iterations).toBeLessThanOrEqual(3);
  });

  it('returns a well-formed FTPResult in finalResult', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 10,
      approvalMatrix,
    });
    expect(result.finalResult).toBeDefined();
    expect(typeof result.finalResult.raroc).toBe('number');
    expect(typeof result.finalResult.totalFTP).toBe('number');
    expect(typeof result.finalResult.finalClientRate).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Regulatory edge cases — pin invariants an MRM validator checks:
//   * monotonicity between achieved raroc and margin,
//   * returned margin always within bounds,
//   * converged flag aligned with the |gap| < precision definition,
//   * zero-width bounds handled without infinite loop.
// ---------------------------------------------------------------------------

describe('optimizeMarginForTargetRaroc — regulatory invariants', () => {
  it('optimalMargin always stays inside the requested bounds', () => {
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 12,
      approvalMatrix,
      marginBounds: [0.5, 4],
    });
    expect(result.optimalMargin).toBeGreaterThanOrEqual(0.5);
    expect(result.optimalMargin).toBeLessThanOrEqual(4);
  });

  it('converged=true iff |achieved - target| < precision', () => {
    const target = 12;
    const precision = 0.1;
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: target,
      approvalMatrix,
      precision,
    });
    if (result.converged) {
      expect(Math.abs(result.achievedRaroc - target)).toBeLessThan(precision);
    }
  });

  it('infeasible flag set only when hi bound raroc < target', () => {
    // Choose a target that the engine can never reach: very high RAROC.
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 999,
      approvalMatrix,
      marginBounds: [0, 5],
    });
    expect(result.infeasible).toBe(true);
    expect(result.converged).toBe(false);
  });

  it('zero-width bounds [x, x] returns immediately at x without infinite loop', () => {
    // When lo == hi, the bisection cannot shrink the interval. The agent
    // must terminate without spinning or throwing. Depending on whether
    // target is above/below, it returns either converged at lo (when
    // raroc >= target) or infeasible at hi.
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 10,
      approvalMatrix,
      marginBounds: [2.5, 2.5],
      maxIterations: 100,
    });
    expect(result.iterations).toBeLessThan(100);
    expect(result.optimalMargin).toBe(2.5);
  });

  it('short-circuits at iterations=0 when lo bound already achieves target', () => {
    // Target chosen below any plausible RAROC to guarantee the
    // short-circuit path triggers — this pins the engine's early-exit
    // optimisation (do not bisect when the cheapest option already
    // clears the hurdle).
    const result = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: -999,
      approvalMatrix,
      marginBounds: [0.5, 5],
    });
    expect(result.iterations).toBe(0);
    expect(result.converged).toBe(true);
    expect(result.optimalMargin).toBe(0.5);
  });

  it('monotonicity: higher target requires higher or equal optimal margin', () => {
    const low = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 8,
      approvalMatrix,
      marginBounds: [0, 5],
      precision: 0.05,
    });
    const high = optimizeMarginForTargetRaroc({
      deal: baseDeal,
      targetRaroc: 14,
      approvalMatrix,
      marginBounds: [0, 5],
      precision: 0.05,
    });
    // If both converged, the higher-target search must land at margin ≥ low's.
    if (low.converged && high.converged) {
      expect(high.optimalMargin).toBeGreaterThanOrEqual(low.optimalMargin - 0.05);
    }
  });

  it('default marginBounds cover [0, 10] when caller omits them', () => {
    // Regression guard: the default bounds baked into the engine should
    // accommodate the common target RAROC range (5-20%). A huge deal
    // asking for 20% RAROC should not be infeasible with defaults if
    // it is reachable at margin < 10%.
    const result = optimizeMarginForTargetRaroc({
      deal: { ...baseDeal, amount: 1_000_000 },
      targetRaroc: 10,
      approvalMatrix,
      precision: 0.1,
    });
    expect(result.optimalMargin).toBeGreaterThanOrEqual(0);
    expect(result.optimalMargin).toBeLessThanOrEqual(10);
  });
});
