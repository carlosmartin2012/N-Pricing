/**
 * `utils/pricing/` — INTERNAL sub-modules of the pricing engine.
 *
 * The canonical public entry point is `utils/pricingEngine.ts`. This
 * barrel exists only to re-export the few curve-math primitives that
 * callers building custom scenarios (Stress Pricing UI, backtest runner)
 * legitimately need, plus the experimental bounded-context split below.
 *
 * For everyday pricing use the public API in `pricingEngine.ts`.
 */

export { interpolateYieldCurve, bootstrapZeroRates } from './curveUtils';
export type { FormulaResult } from './formulaEngine';
export { linearInterpolate, prepareYieldCurvePoints, prepareLiquidityCurvePoints } from './interpolation';

// Bounded contexts (migration in progress — see contexts/README.md)
export * as market     from './contexts/market';
export * as governance from './contexts/governance';
export * as capital    from './contexts/capital';
export * as liquidity  from './contexts/liquidity';
export * as credit     from './contexts/credit';
export * as analytics  from './contexts/analytics';
export * as core       from './contexts/core';
