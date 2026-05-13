export { findApplicableCampaigns, pickBestForBorrower, remainingVolume } from '../../../utils/channels/campaignMatcher';
export { consume } from '../../../utils/channels/tokenBucket';
export type { BucketSpec, ConsumeResult } from '../../../utils/channels/tokenBucket';
export {
  computeLtv,
  defaultAssumptions,
  discountFactor,
  DEFAULT_CAPITAL_ALLOC,
  DEFAULT_CHURN_COST_PER_EUR,
  DEFAULT_CHURN_HAZARD,
  DEFAULT_CROSSSELL_PROB,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_HORIZON_YEARS,
  DEFAULT_RAROC_DEFAULT,
  DEFAULT_RENEWAL_PROB,
  hashAssumptions,
  positionContribution,
  survivalProb,
  yearsToMaturity,
} from '../../../utils/clv/ltvEngine';
export { computeMarginalLtvImpact } from '../../../utils/clv/marginalLtvImpact';
export { rankNextBestActions, REFERENCE_CATALOGUE } from '../../../utils/clv/nextBestAction';
export {
  buildClientRelationship,
  findApplicableTargets,
  mapClientMetricsSnapshotRow,
  mapClientPositionRow,
  mapPricingTargetRow,
  pickActiveTarget,
} from '../../../utils/customer360/relationshipAggregator';
export { parseMetricsCsv, parsePositionsCsv } from '../../../utils/customer360/csvImport';
export type { ParsedMetrics, ParsedPosition, ParseError, ParseResult } from '../../../utils/customer360/csvImport';
export { deriveAttachmentsFromRelationship } from '../../../utils/customer360/crossBonusFromRelationship';
export { computeTargetGrid, extractDimensions } from '../../../utils/targetGrid/gridCompute';
export type { ComputeGridParams } from '../../../utils/targetGrid/gridCompute';
export { diffGridCells, filterSignificantDiffs, summarizeDiff } from '../../../utils/targetGrid/diff';
export type { DiffSummary } from '../../../utils/targetGrid/diff';
export { generateDimensionCombos, synthesizeCanonicalDeal } from '../../../utils/targetGrid/synthesizer';
export type { DimensionCombo, DimensionConfig } from '../../../utils/targetGrid/synthesizer';
export { compareToMarket, findBenchmark } from '../../../utils/marketBenchmarks';
export type { BenchmarkLookupQuery, BenchmarkMatch, MarketBenchmark } from '../../../utils/marketBenchmarks';
export { parseMarketBenchmarksCsv } from '../../../utils/marketBenchmarks/csvImport';
export type {
  ParsedBenchmark,
  ParseError as MarketBenchmarkParseError,
  ParseResult as MarketBenchmarkParseResult,
} from '../../../utils/marketBenchmarks/csvImport';
export type {
  CampaignLookup,
  ChannelApiKey,
  ClientRelationship,
  GridComputeResult,
  GridDiff,
  PricingCampaign,
  TargetGridCell,
} from '../../../types';
