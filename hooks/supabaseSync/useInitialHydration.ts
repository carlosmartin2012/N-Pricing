import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DataContextType } from '../../contexts/DataContext';
import type {
  ApprovalMatrixConfig,
  GreeniumRateCard,
  PhysicalRateCard,
  RAROCInputs,
  TransitionRateCard,
  UserProfile,
} from '../../types';
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
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { createLogger } from '../../utils/logger';
import { applyMockData, resolveWithFallback } from './syncUtils';

import * as dealsApi from '../../api/deals';
import * as marketDataApi from '../../api/marketData';
import * as configApi from '../../api/config';
import * as auditApi from '../../api/audit';
import type { YieldCurveSnapshot } from '../../api/mappers';
import { queryKeys } from '../queries/queryKeys';

const log = createLogger('sync-hydration');

interface InitialHydrationOptions {
  data: DataContextType;
  currentUser: UserProfile | null;
  addToast: (type: 'warning' | 'error' | 'success' | 'info', message: string, duration?: number) => void;
}

export function useInitialHydration({ data, currentUser, addToast }: InitialHydrationOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const hydrate = async () => {
      if (!isSupabaseConfigured) {
        applyMockData(data, 'mock');
        data.setIsLoading(false);
        return;
      }

      try {
        // Fetch all data via the centralized api/ layer and seed React Query cache
        const [
          dbDeals,
          dbModels,
          dbRules,
          dbClients,
          dbUnits,
          dbProducts,
          dbUsers,
          dbShocks,
          dbRateCards,
          dbTransGrid,
          dbPhysGrid,
          dbGreeniumGrid,
          dbYieldCurves,
          dbRaroc,
          dbApprovalMatrix,
          dbLiqCurves,
          dbMethodologyChangeRequests,
          dbMethodologyVersions,
          dbApprovalTasks,
          dbPricingDossiers,
          dbPortfolioSnapshots,
          dbMarketDataSources,
        ] = await Promise.all([
          dealsApi.listDeals(),
          marketDataApi.listModels(),
          configApi.listRules(),
          configApi.listClients(),
          configApi.listBusinessUnits(),
          configApi.listProducts(),
          configApi.listUsers(),
          configApi.fetchShocks(),
          configApi.fetchRateCards(),
          configApi.fetchEsgGrid('transition'),
          configApi.fetchEsgGrid('physical'),
          configApi.fetchEsgGrid('greenium'),
          marketDataApi.listYieldCurves(),
          configApi.fetchRarocInputs(),
          configApi.fetchApprovalMatrix(),
          marketDataApi.listLiquidityCurves(),
          configApi.fetchMethodologyChangeRequests(),
          configApi.fetchMethodologyVersions(),
          configApi.fetchApprovalTasks(),
          configApi.fetchPricingDossiers(),
          configApi.fetchPortfolioSnapshots(),
          configApi.fetchMarketDataSources(),
        ]);

        // Seed React Query cache so subsequent useQuery calls are instant
        queryClient.setQueryData(queryKeys.deals.all, resolveWithFallback(dbDeals, MOCK_DEALS));
        queryClient.setQueryData(queryKeys.marketData.behaviouralModels, resolveWithFallback(dbModels, MOCK_BEHAVIOURAL_MODELS));
        queryClient.setQueryData(queryKeys.config.rules, resolveWithFallback(dbRules, MOCK_RULES));
        queryClient.setQueryData(queryKeys.config.clients, resolveWithFallback(dbClients, MOCK_CLIENTS));
        queryClient.setQueryData(queryKeys.config.businessUnits, resolveWithFallback(dbUnits, MOCK_BUSINESS_UNITS));
        queryClient.setQueryData(queryKeys.config.products, resolveWithFallback(dbProducts, MOCK_PRODUCT_DEFS));
        queryClient.setQueryData(queryKeys.config.users, resolveWithFallback(dbUsers, MOCK_USERS));
        queryClient.setQueryData(queryKeys.config.shocks, dbShocks);
        queryClient.setQueryData(queryKeys.config.rateCards, resolveWithFallback(dbRateCards, MOCK_FTP_RATE_CARDS));
        queryClient.setQueryData(queryKeys.config.esgGrid('transition'), resolveWithFallback(dbTransGrid as unknown[], MOCK_TRANSITION_GRID));
        queryClient.setQueryData(queryKeys.config.esgGrid('physical'), resolveWithFallback(dbPhysGrid as unknown[], MOCK_PHYSICAL_GRID));
        queryClient.setQueryData(queryKeys.config.esgGrid('greenium'), resolveWithFallback(dbGreeniumGrid as unknown[], MOCK_GREENIUM_GRID));
        queryClient.setQueryData(queryKeys.marketData.yieldCurves, dbYieldCurves?.length ? dbYieldCurves : MOCK_YIELD_CURVE);
        queryClient.setQueryData(queryKeys.config.rarocInputs, dbRaroc);
        queryClient.setQueryData(queryKeys.config.approvalMatrix, dbApprovalMatrix);
        queryClient.setQueryData(queryKeys.marketData.liquidityCurves, resolveWithFallback(dbLiqCurves, MOCK_LIQUIDITY_CURVES));
        queryClient.setQueryData(queryKeys.governance.methodologyChangeRequests, dbMethodologyChangeRequests);
        queryClient.setQueryData(queryKeys.governance.methodologyVersions, dbMethodologyVersions);
        queryClient.setQueryData(queryKeys.governance.approvalTasks, dbApprovalTasks);
        queryClient.setQueryData(queryKeys.governance.pricingDossiers, dbPricingDossiers);
        queryClient.setQueryData(queryKeys.governance.portfolioSnapshots, dbPortfolioSnapshots);
        queryClient.setQueryData(queryKeys.config.marketDataSources, dbMarketDataSources);

        // Hydrate context providers for backward compatibility
        data.setDeals(resolveWithFallback(dbDeals, MOCK_DEALS));
        data.setBehaviouralModels(resolveWithFallback(dbModels, MOCK_BEHAVIOURAL_MODELS));
        data.setRules(resolveWithFallback(dbRules, MOCK_RULES));
        data.setClients(resolveWithFallback(dbClients, MOCK_CLIENTS));
        data.setBusinessUnits(resolveWithFallback(dbUnits, MOCK_BUSINESS_UNITS));
        data.setProducts(resolveWithFallback(dbProducts, MOCK_PRODUCT_DEFS));
        data.setUsers(resolveWithFallback(dbUsers, MOCK_USERS));
        if (dbShocks) data.setShocks(dbShocks);
        data.setFtpRateCards(resolveWithFallback(dbRateCards, MOCK_FTP_RATE_CARDS));
        data.setTransitionGrid(resolveWithFallback(dbTransGrid as TransitionRateCard[], MOCK_TRANSITION_GRID));
        data.setPhysicalGrid(resolveWithFallback(dbPhysGrid as PhysicalRateCard[], MOCK_PHYSICAL_GRID));
        data.setGreeniumGrid(resolveWithFallback(dbGreeniumGrid as GreeniumRateCard[], MOCK_GREENIUM_GRID));
        // API returns YieldCurveSnapshot[] — extract gridData for context, or fallback to mock
        const yieldCurvePoints = dbYieldCurves?.length
          ? dbYieldCurves.flatMap((snapshot: YieldCurveSnapshot) => snapshot.gridData ?? [])
          : null;
        data.setYieldCurves(resolveWithFallback(yieldCurvePoints, MOCK_YIELD_CURVE));
        data.setLiquidityCurves(resolveWithFallback(dbLiqCurves, MOCK_LIQUIDITY_CURVES));
        if (dbRaroc && typeof dbRaroc === 'object' && 'transactionId' in dbRaroc) {
          data.setRarocInputs(dbRaroc as RAROCInputs);
        }
        if (dbApprovalMatrix && typeof dbApprovalMatrix === 'object' && 'autoApprovalThreshold' in dbApprovalMatrix) {
          data.setApprovalMatrix(dbApprovalMatrix as ApprovalMatrixConfig);
        }
        data.setMethodologyChangeRequests(dbMethodologyChangeRequests);
        data.setMethodologyVersions(dbMethodologyVersions);
        data.setApprovalTasks(dbApprovalTasks);
        data.setPricingDossiers(dbPricingDossiers);
        data.setPortfolioSnapshots(dbPortfolioSnapshots);
        data.setMarketDataSources(dbMarketDataSources);

        const hasRemoteData = [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts].some(
          (dataset) => dataset?.length
        );
        const nextSyncStatus: DataContextType['syncStatus'] = hasRemoteData ? 'synced' : 'mock';
        data.setSyncStatus(nextSyncStatus);

        await auditApi.logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.name || 'System',
          action: 'SYSTEM_BOOTSTRAP',
          module: 'CALCULATOR',
          description: `Data hydrated. Status: ${nextSyncStatus}.`,
        });
      } catch (error) {
        log.warn('Supabase sync failed, loading mock data', { error: String(error) });
        addToast('warning', 'Could not connect to server. Using offline demo data.');
        applyMockData(data, 'error');
        await auditApi.logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.name || 'System',
          action: 'SYSTEM_BOOTSTRAP',
          module: 'CALCULATOR',
          description: 'Data hydrated. Status: error.',
        });
      } finally {
        data.setIsLoading(false);
      }
    };

    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
