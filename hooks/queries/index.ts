/**
 * React Query hooks — barrel export.
 *
 * Usage:
 *   import { useDealsQuery, useUpsertDeal, queryKeys } from '../hooks/queries';
 */

export { queryKeys } from './queryKeys';

// Deals
export {
  useDealsQuery,
  useDealsPaginatedQuery,
  useDealVersionsQuery,
  useUpsertDeal,
  useBatchUpsertDeals,
  useDeleteDeal,
  useTransitionDeal,
  useCreateDealVersion,
} from './useDealsQuery';

// Market Data
export {
  useYieldCurvesQuery,
  useLiquidityCurvesQuery,
  useBehaviouralModelsQuery,
  useCurveHistoryQuery,
  useUpsertYieldCurves,
  useSaveCurveHistorySnapshot,
  useUpsertModel,
  useDeleteModel,
} from './useMarketDataQueries';

// Config & Master Data
export {
  useRulesQuery,
  useUpsertRule,
  useDeleteRule,
  useClientsQuery,
  useUpsertClient,
  useDeleteClient,
  useProductsQuery,
  useUpsertProduct,
  useDeleteProduct,
  useBusinessUnitsQuery,
  useUpsertBusinessUnit,
  useDeleteBusinessUnit,
  useUsersQuery,
  useUpsertUser,
  useDeleteUser,
  useShocksQuery,
  useSaveShocks,
  useRateCardsQuery,
  useSaveRateCards,
  useEsgGridQuery,
  useSaveEsgGrid,
  useRarocInputsQuery,
  useSaveRarocInputs,
  useApprovalMatrixQuery,
  useSaveApprovalMatrix,
  useMarketDataSourcesQuery,
  useSaveMarketDataSources,
  useMethodologyChangeRequestsQuery,
  useSaveMethodologyChangeRequests,
  useMethodologyVersionsQuery,
  useSaveMethodologyVersions,
  useApprovalTasksQuery,
  useSaveApprovalTasks,
  usePricingDossiersQuery,
  useSavePricingDossiers,
  usePortfolioSnapshotsQuery,
  useSavePortfolioSnapshots,
} from './useConfigQueries';
