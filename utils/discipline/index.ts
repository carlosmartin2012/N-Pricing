/**
 * Pricing Discipline engine — re-exports for convenience.
 */

export { resolveCohort, resolveTenorBucket, findMatchingCell, findClosestCell, isValidCohort } from './cohortMatcher';
export { computeVariance, computeBatchVariances, computeLeakage, aggregateLeakage, averageVarianceMetrics } from './varianceCalculator';
export type { VarianceInput } from './varianceCalculator';
export { resolveToleranceBand, isOutOfBand, applyBandToVariance } from './bandResolver';
export { aggregateByDimension, computeKpis, topOutliers } from './leakageAggregator';
export type { AggregationDimension, DimensionAggregate } from './leakageAggregator';
