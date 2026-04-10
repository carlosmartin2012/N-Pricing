import type { Transaction, ApprovalMatrixConfig, FTPResult } from '../../types';
import {
  calculatePricing,
  PricingContext,
  PricingShocks,
  DEFAULT_PRICING_SHOCKS,
} from '../pricingEngine';

export interface InverseOptimizationInput {
  deal: Transaction;
  targetRaroc: number;    // target RAROC in %
  approvalMatrix: ApprovalMatrixConfig;
  context?: PricingContext;
  shocks?: PricingShocks;
  /** Search bounds for marginTarget in %. Default [0, 10] */
  marginBounds?: [number, number];
  /** Precision: stop when |achieved - target| < this. Default 0.05 (5bps) */
  precision?: number;
  /** Max iterations. Default 40 */
  maxIterations?: number;
}

export interface InverseOptimizationResult {
  converged: boolean;
  iterations: number;
  optimalMargin: number;
  achievedRaroc: number;
  finalResult: FTPResult;
  /** True if target RAROC is unreachable within bounds */
  infeasible: boolean;
}

/**
 * Inverse pricing: find the minimum marginTarget that achieves a target RAROC.
 * Uses bisection search on marginTarget, since RAROC is monotonically
 * increasing in marginTarget (more margin → more revenue → higher RAROC).
 */
export function optimizeMarginForTargetRaroc(
  input: InverseOptimizationInput,
): InverseOptimizationResult {
  const bounds = input.marginBounds ?? [0, 10];
  const precision = input.precision ?? 0.05;
  const maxIterations = input.maxIterations ?? 40;

  let lo = bounds[0];
  let hi = bounds[1];

  // Evaluate pricing at a given margin without mutating the input deal.
  const evaluate = (margin: number): FTPResult => {
    const dealCopy: Transaction = { ...input.deal, marginTarget: margin };
    return calculatePricing(
      dealCopy,
      input.approvalMatrix,
      input.context,
      input.shocks ?? DEFAULT_PRICING_SHOCKS,
    );
  };

  const loResult = evaluate(lo);
  const hiResult = evaluate(hi);

  // Already at/above target at the lower bound → no optimization needed.
  if (loResult.raroc >= input.targetRaroc) {
    return {
      converged: true,
      iterations: 0,
      optimalMargin: lo,
      achievedRaroc: loResult.raroc,
      finalResult: loResult,
      infeasible: false,
    };
  }

  // Even at the upper bound we can't reach the target → infeasible.
  if (hiResult.raroc < input.targetRaroc) {
    return {
      converged: false,
      iterations: 0,
      optimalMargin: hi,
      achievedRaroc: hiResult.raroc,
      finalResult: hiResult,
      infeasible: true,
    };
  }

  // Bisection — RAROC monotone in marginTarget.
  let iterations = 0;
  let midResult: FTPResult = hiResult;
  let mid = hi;
  while (iterations < maxIterations && hi - lo > 0.001) {
    mid = (lo + hi) / 2;
    midResult = evaluate(mid);
    const gap = midResult.raroc - input.targetRaroc;

    if (Math.abs(gap) < precision) break;
    if (gap < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
    iterations++;
  }

  return {
    converged: Math.abs(midResult.raroc - input.targetRaroc) < precision,
    iterations,
    optimalMargin: mid,
    achievedRaroc: midResult.raroc,
    finalResult: midResult,
    infeasible: false,
  };
}
