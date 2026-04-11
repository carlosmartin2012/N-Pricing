import { useEffect, useRef } from 'react';
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
  activeEntityId?: string;
  isGroupScope?: boolean;
  isEntityLoading?: boolean;
  addToast: (type: 'warning' | 'error' | 'success' | 'info', message: string, duration?: number) => void;
}

export function useInitialHydration({
  data,
  currentUser,
  activeEntityId,
  isGroupScope = false,
  isEntityLoading = false,
  addToast,
}: InitialHydrationOptions) {
  const queryClient = useQueryClient();
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (currentUser && isEntityLoading) return;

    const scopedEntityId = isGroupScope ? undefined : activeEntityId;
    let isCancelled = false;

    const hydrate = async () => {
      const context = dataRef.current;

      if (!isSupabaseConfigured) {
        applyMockData(context, 'mock');
        context.setIsLoading(false);
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
          dealsApi.listDeals(scopedEntityId),
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

        if (isCancelled) return;

        // Seed React Query cache so subsequent useQuery calls are instant
        const resolvedDeals = resolveWithFallback(dbDeals, MOCK_DEALS);
        queryClient.setQueryData(queryKeys.deals.all, resolvedDeals);
        if (scopedEntityId) {
          queryClient.setQueryData([...queryKeys.deals.all, scopedEntityId], resolvedDeals);
        }
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
        context.setDeals(resolvedDeals);
        context.setBehaviouralModels(resolveWithFallback(dbModels, MOCK_BEHAVIOURAL_MODELS));
        context.setRules(resolveWithFallback(dbRules, MOCK_RULES));
        context.setClients(resolveWithFallback(dbClients, MOCK_CLIENTS));
        context.setBusinessUnits(resolveWithFallback(dbUnits, MOCK_BUSINESS_UNITS));
        context.setProducts(resolveWithFallback(dbProducts, MOCK_PRODUCT_DEFS));
        context.setUsers(resolveWithFallback(dbUsers, MOCK_USERS));
        if (dbShocks) context.setShocks(dbShocks);
        context.setFtpRateCards(resolveWithFallback(dbRateCards, MOCK_FTP_RATE_CARDS));
        context.setTransitionGrid(resolveWithFallback(dbTransGrid as TransitionRateCard[], MOCK_TRANSITION_GRID));
        context.setPhysicalGrid(resolveWithFallback(dbPhysGrid as PhysicalRateCard[], MOCK_PHYSICAL_GRID));
        context.setGreeniumGrid(resolveWithFallback(dbGreeniumGrid as GreeniumRateCard[], MOCK_GREENIUM_GRID));
        // API returns YieldCurveSnapshot[] — extract gridData for context, or fallback to mock
        const yieldCurvePoints = dbYieldCurves?.length
          ? dbYieldCurves.flatMap((snapshot: YieldCurveSnapshot) => snapshot.gridData ?? [])
          : null;
        context.setYieldCurves(resolveWithFallback(yieldCurvePoints, MOCK_YIELD_CURVE));
        context.setLiquidityCurves(resolveWithFallback(dbLiqCurves, MOCK_LIQUIDITY_CURVES));
        if (dbRaroc && typeof dbRaroc === 'object' && 'transactionId' in dbRaroc) {
          context.setRarocInputs(dbRaroc as RAROCInputs);
        }
        if (dbApprovalMatrix && typeof dbApprovalMatrix === 'object' && 'autoApprovalThreshold' in dbApprovalMatrix) {
          context.setApprovalMatrix(dbApprovalMatrix as ApprovalMatrixConfig);
        }
        context.setMethodologyChangeRequests(dbMethodologyChangeRequests);
        context.setMethodologyVersions(dbMethodologyVersions);
        context.setApprovalTasks(dbApprovalTasks);
        context.setPricingDossiers(dbPricingDossiers);
        context.setPortfolioSnapshots(dbPortfolioSnapshots);
        context.setMarketDataSources(dbMarketDataSources);

        const hasRemoteData = [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts].some(
          (dataset) => dataset?.length
        );
        const nextSyncStatus: DataContextType['syncStatus'] = hasRemoteData ? 'synced' : 'mock';
        context.setSyncStatus(nextSyncStatus);

        await auditApi.logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.name || 'System',
          action: 'SYSTEM_BOOTSTRAP',
          module: 'CALCULATOR',
          description: `Data hydrated. Status: ${nextSyncStatus}.`,
        });
      } catch (error) {
        if (isCancelled) return;
        log.warn('Supabase sync failed, loading mock data', { error: String(error) });
        addToast('warning', 'Could not connect to server. Using offline demo data.');
        applyMockData(context, 'error');
        await auditApi.logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.name || 'System',
          action: 'SYSTEM_BOOTSTRAP',
          module: 'CALCULATOR',
          description: 'Data hydrated. Status: error.',
        });
      } finally {
        context.setIsLoading(false);
      }
    };

    void hydrate();
    return () => {
      isCancelled = true;
    };
  }, [activeEntityId, addToast, currentUser, isEntityLoading, isGroupScope, queryClient]);
}
