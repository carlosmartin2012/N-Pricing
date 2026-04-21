/**
 * Market bounded context — public surface (Ola C-2).
 *
 * Groups the low-level market data primitives the rest of the motor
 * consumes:
 *   - Yield curve interpolation (bootstrap + piecewise)
 *   - Nelson-Siegel-Svensson parametric curve + fitter
 *   - Linear / preparatory curve helpers
 *
 * Strategy: re-export from the existing flat modules so callers can migrate
 * their imports incrementally without any code movement. When the flat
 * files are physically moved here (Ola C-2.x), this barrel stays stable.
 *
 * The market context is the **root** dependency of the pricing engine —
 * every other bounded context (credit, liquidity, capital, analytics) is
 * allowed to import from here. Circular dependencies would indicate a
 * layering bug.
 */

// Curve interpolation + bootstrap
export {
  interpolateYieldCurve,
  bootstrapZeroRates,
  interpolateFromZeros,
} from '../../curveUtils';

// Linear interpolation + curve prep helpers
export {
  linearInterpolate,
  prepareYieldCurvePoints,
  prepareLiquidityCurvePoints,
} from '../../interpolation';

// Nelson-Siegel-Svensson parametric curve
export {
  nssYield,
  nssForwardRate,
  fitNSSLinear,
  interpolateNSS,
} from '../../nelsonSiegelSvensson';

export type {
  NSSParameters,
  NSSObservation,
  NSSFitResult,
} from '../../nelsonSiegelSvensson';
