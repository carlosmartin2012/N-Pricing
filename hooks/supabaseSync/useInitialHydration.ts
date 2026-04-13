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
  MOCK_METHODOLOGY_SNAPSHOT,
  MOCK_TARGET_GRID_CELLS,
  MOCK_CANONICAL_TEMPLATES,
  MOCK_TOLERANCE_BANDS,
  MOCK_ELASTICITY_MODELS,
} from '../../constants';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { createLogger } from '../../utils/logger';
import { resolveHydrationPlan } from '../../utils/dataModeUtils';
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
      context.setIsLoading(true);
      const hydrationPlan = resolveHydrationPlan({
        dataMode: context.dataMode,
        isSupabaseConfigured,
      });

      if (hydrationPlan.source === 'mock') {
        applyMockData(context, hydrationPlan.syncStatus, queryClient);
        context.setIsLoading(false);
        return;
      }

      try {
        // Fetch all data via the centralized api/ layer and seed React Query cache
        // Use Promise.allSettled so a single failing endpoint doesn't lose
        // all successfully-fetched data — partial hydration > total fallback.
        const settled = await Promise.allSettled([
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

        const failedCount = settled.filter(r => r.status === 'rejected').length;
        if (failedCount > 0) {
          log.warn(`${failedCount}/${settled.length} hydration calls failed — using partial data`);
        }

        const v = <T,>(r: PromiseSettledResult<T>): T | null =>
          r.status === 'fulfilled' ? r.value : null;

        const dbDeals = v(settled[0]);
        const dbModels = v(settled[1]);
        const dbRules = v(settled[2]);
        const dbClients = v(settled[3]);
        const dbUnits = v(settled[4]);
        const dbProducts = v(settled[5]);
        const dbUsers = v(settled[6]);
        const dbShocks = v(settled[7]);
        const dbRateCards = v(settled[8]);
        const dbTransGrid = v(settled[9]);
        const dbPhysGrid = v(settled[10]);
        const dbGreeniumGrid = v(settled[11]);
        const dbYieldCurves = v(settled[12]);
        const dbRaroc = v(settled[13]);
        const dbApprovalMatrix = v(settled[14]);
        const dbLiqCurves = v(settled[15]);
        const dbMethodologyChangeRequests = v(settled[16]);
        const dbMethodologyVersions = v(settled[17]);
        const dbApprovalTasks = v(settled[18]);
        const dbPricingDossiers = v(settled[19]);
        const dbPortfolioSnapshots = v(settled[20]);
        const dbMarketDataSources = v(settled[21]);

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

        // Seed new views (Target Grid, Discipline, What-If) with mock fallback
        // These views don't have dedicated Supabase endpoints yet, so always use mock data
        queryClient.setQueryData(queryKeys.targetGrid.snapshots, [MOCK_METHODOLOGY_SNAPSHOT]);
        queryClient.setQueryData(queryKeys.targetGrid.snapshot(MOCK_METHODOLOGY_SNAPSHOT.id), MOCK_METHODOLOGY_SNAPSHOT);
        queryClient.setQueryData(queryKeys.targetGrid.cells(MOCK_METHODOLOGY_SNAPSHOT.id), MOCK_TARGET_GRID_CELLS);
        queryClient.setQueryData(queryKeys.targetGrid.templates, MOCK_CANONICAL_TEMPLATES);
        queryClient.setQueryData(queryKeys.discipline.bands, MOCK_TOLERANCE_BANDS);
        queryClient.setQueryData(queryKeys.whatIf.elasticity, MOCK_ELASTICITY_MODELS);

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
        if (dbMethodologyChangeRequests) context.setMethodologyChangeRequests(dbMethodologyChangeRequests);
        if (dbMethodologyVersions) context.setMethodologyVersions(dbMethodologyVersions);
        if (dbApprovalTasks) context.setApprovalTasks(dbApprovalTasks);
        if (dbPricingDossiers) context.setPricingDossiers(dbPricingDossiers);
        if (dbPortfolioSnapshots) context.setPortfolioSnapshots(dbPortfolioSnapshots);
        if (dbMarketDataSources) context.setMarketDataSources(dbMarketDataSources);

        const hasRemoteData = [dbDeals, dbModels, dbRules, dbClients, dbUnits, dbProducts].some(
          (dataset) => dataset?.length
        );
        const nextSyncStatus: DataContextType['syncStatus'] = hasRemoteData ? 'synced' : 'mock';
        context.setSyncStatus(nextSyncStatus);

        if (failedCount > 0 && hasRemoteData) {
          addToast('warning', `Loaded with ${failedCount} partial failure(s). Some data may use defaults.`);
        }

        await auditApi.logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.name || 'System',
          action: 'SYSTEM_BOOTSTRAP',
          module: 'CALCULATOR',
          description: `Data hydrated. Status: ${nextSyncStatus}. Failures: ${failedCount}/${settled.length}.`,
        });
      } catch (error) {
        if (isCancelled) return;
        log.warn('Supabase sync failed, loading mock data', { error: String(error) });
        addToast('warning', 'Could not connect to server. Using offline demo data.');
        applyMockData(context, 'error', queryClient);
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
  }, [activeEntityId, addToast, currentUser, isEntityLoading, isGroupScope, queryClient, data.dataMode]);
}
