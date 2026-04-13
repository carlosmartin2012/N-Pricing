import type { QueryClient } from '@tanstack/react-query';
import type { DataContextType } from '../../contexts/DataContext';
import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_FTP_RATE_CARDS,
  MOCK_GREENIUM_GRID,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
  MOCK_TRANSITION_GRID,
  MOCK_USERS,
  MOCK_YIELD_CURVE,
  MOCK_METHODOLOGY_SNAPSHOT,
  MOCK_TARGET_GRID_CELLS,
  MOCK_CANONICAL_TEMPLATES,
  MOCK_TOLERANCE_BANDS,
  MOCK_ELASTICITY_MODELS,
} from '../../constants';
import { buildDemoWorkspaceData } from '../../utils/demoWorkspaceData';
import { queryKeys } from '../queries/queryKeys';

export function resolveWithFallback<T>(dataset: T[] | null | undefined, fallback: T[]) {
  return dataset?.length ? dataset : fallback;
}

export function applyMockData(
  data: DataContextType,
  syncStatus: DataContextType['syncStatus'],
  queryClient?: QueryClient,
) {
  const demoWorkspaceData = buildDemoWorkspaceData({
    approvalMatrix: data.approvalMatrix,
  });


  data.setDeals(MOCK_DEALS);
  data.setClients(MOCK_CLIENTS);
  data.setUsers(MOCK_USERS);
  data.setBehaviouralModels(MOCK_BEHAVIOURAL_MODELS);
  data.setRules(MOCK_RULES);
  data.setProducts(MOCK_PRODUCT_DEFS);
  data.setBusinessUnits(MOCK_BUSINESS_UNITS);
  data.setFtpRateCards(MOCK_FTP_RATE_CARDS);
  data.setTransitionGrid(MOCK_TRANSITION_GRID);
  data.setPhysicalGrid(MOCK_PHYSICAL_GRID);
  data.setGreeniumGrid(MOCK_GREENIUM_GRID);
  data.setYieldCurves(MOCK_YIELD_CURVE);
  data.setLiquidityCurves(MOCK_LIQUIDITY_CURVES);
  data.setMethodologyChangeRequests([]);
  data.setMethodologyVersions(demoWorkspaceData.methodologyVersions);
  data.setApprovalTasks(demoWorkspaceData.approvalTasks);
  data.setPricingDossiers(demoWorkspaceData.pricingDossiers);
  data.setPortfolioSnapshots(demoWorkspaceData.portfolioSnapshots);
  data.setMarketDataSources(demoWorkspaceData.marketDataSources);
  data.setSyncStatus(syncStatus);

  // Seed React Query cache for new views (Target Grid, Discipline, What-If)
  if (queryClient) {
    queryClient.setQueryData(queryKeys.targetGrid.snapshots, [MOCK_METHODOLOGY_SNAPSHOT]);
    queryClient.setQueryData(queryKeys.targetGrid.snapshot(MOCK_METHODOLOGY_SNAPSHOT.id), MOCK_METHODOLOGY_SNAPSHOT);
    queryClient.setQueryData(queryKeys.targetGrid.cells(MOCK_METHODOLOGY_SNAPSHOT.id), MOCK_TARGET_GRID_CELLS);
    queryClient.setQueryData(queryKeys.targetGrid.templates, MOCK_CANONICAL_TEMPLATES);
    queryClient.setQueryData(queryKeys.discipline.bands, MOCK_TOLERANCE_BANDS);
    queryClient.setQueryData(queryKeys.whatIf.elasticity, MOCK_ELASTICITY_MODELS);
  }
}
