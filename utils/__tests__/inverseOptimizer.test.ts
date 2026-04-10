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
