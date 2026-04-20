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
} from '../../constants';
import { buildDemoWorkspaceData } from '../../utils/demoWorkspaceData';

export function resolveWithFallback<T>(dataset: T[] | null | undefined, fallback: T[]) {
  return dataset?.length ? dataset : fallback;
}

export function applyMockData(data: DataContextType, syncStatus: DataContextType['syncStatus']) {
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
}
