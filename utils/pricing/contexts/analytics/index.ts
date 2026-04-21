/**
 * Analytics bounded context — public surface (Ola C-6).
 *
 * Post-trade + behavioural primitives. Consumers: Reporting dashboards,
 * RAROC Terminal, Pricing Discipline, Elasticity calibration worker.
 *
 *   - expostRaroc           — realised vs expected RAROC comparison,
 *                              underpricing detection.
 *   - rarocRealization      — MAPE computation and serialization helpers
 *                              for deal_realizations rows.
 *   - priceElasticity       — elasticity model fit + bucketing helpers.
 *   - elasticityCalibration — Bayesian prior application + group-by-segment.
 *
 * The "analytics" context is read-heavy and downstream of pricing; it does
 * not feed back into the motor itself, which is why it lives separately
 * from credit/liquidity/capital.
 */

// expostRaroc
export {
  extractExpectedFromSnapshot,
  calculateRealizedRaroc,
  compareExpectedVsRealized,
  detectSystematicUnderpricing,
} from '../../expostRaroc';

export type {
  RealizedPerformance,
  ExpectedRaroc,
  ExPostComparisonResult,
  UnderpricingAlert,
} from '../../expostRaroc';

// rarocRealization
export {
  computeMapeRaroc,
  buildEstimates,
  deserializeRealization,
} from '../../rarocRealization';

export type {
  RecomputeMethod,
  DealRealization,
  RarocEstimates,
} from '../../rarocRealization';

// priceElasticity
export {
  buildSegmentKey,
  bucketAmount,
  bucketTenor,
  fitElasticityModel,
} from '../../priceElasticity';

export type {
  HistoricalDemandObservation,
  ElasticityModel,
} from '../../priceElasticity';

// elasticityCalibration
export {
  DEFAULT_EXPERT_PRIOR,
  dealToObservation,
  groupBySegment,
} from '../../elasticityCalibration';

export type {
  CalibrationMethod,
  CalibratedModel,
  ExpertPrior,
} from '../../elasticityCalibration';
