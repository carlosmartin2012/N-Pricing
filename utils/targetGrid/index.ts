/**
 * Target Grid engine — re-exports for convenience.
 */

export {
  synthesizeCanonicalDeal,
  generateDimensionCombos,
} from './synthesizer';
export type { DimensionCombo, DimensionConfig } from './synthesizer';

export { computeTargetGrid, extractDimensions } from './gridCompute';
export type { ComputeGridParams } from './gridCompute';

export { diffGridCells, filterSignificantDiffs, summarizeDiff } from './diff';
export type { DiffSummary } from './diff';
