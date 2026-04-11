/**
 * React Query hooks for Configuration & Master Data.
 *
 * Wraps `api/config` with cached queries and mutations for
 * rules, clients, products, business units, users, and system config values.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BusinessUnit,
  ClientEntity,
  GeneralRule,
  ProductDefinition,
  UserProfile,
  FtpRateCard,
  ApprovalTask,
  MethodologyChangeRequest,
  MethodologyVersion,
  PricingDossier,
  PortfolioSnapshot,
  MarketDataSource,
} from '../../types';
import * as configApi from '../../api/config';
import { queryKeys } from './queryKeys';

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function useRulesQuery() {
  return useQuery({
    queryKey: queryKeys.config.rules,
    queryFn: configApi.listRules,
  });
}

export function useUpsertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: GeneralRule) => configApi.upsertRule(rule),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.rules }); },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => configApi.deleteRule(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.rules }); },
  });
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function useClientsQuery() {
  return useQuery({
    queryKey: queryKeys.config.clients,
    queryFn: configApi.listClients,
  });
}

export function useUpsertClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (client: ClientEntity) => configApi.upsertClient(client),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.clients }); },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configApi.deleteClient(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.clients }); },
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function useProductsQuery() {
  return useQuery({
    queryKey: queryKeys.config.products,
    queryFn: configApi.listProducts,
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (product: ProductDefinition) => configApi.upsertProduct(product),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.products }); },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configApi.deleteProduct(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.products }); },
  });
}

// ---------------------------------------------------------------------------
// Business Units
// ---------------------------------------------------------------------------

export function useBusinessUnitsQuery() {
  return useQuery({
    queryKey: queryKeys.config.businessUnits,
    queryFn: configApi.listBusinessUnits,
  });
}

export function useUpsertBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unit: BusinessUnit) => configApi.upsertBusinessUnit(unit),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.businessUnits }); },
  });
}

export function useDeleteBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configApi.deleteBusinessUnit(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.businessUnits }); },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.config.users,
    queryFn: configApi.listUsers,
  });
}

export function useUpsertUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: UserProfile) => configApi.upsertUser(user),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.users }); },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configApi.deleteUser(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.users }); },
  });
}

// ---------------------------------------------------------------------------
// System Config values (shocks, rate cards, ESG, RAROC, approval, etc.)
// ---------------------------------------------------------------------------

export function useShocksQuery() {
  return useQuery({
    queryKey: queryKeys.config.shocks,
    queryFn: configApi.fetchShocks,
  });
}

export function useSaveShocks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shocks: { interestRate: number; liquiditySpread: number }) =>
      configApi.saveShocks(shocks),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.shocks }); },
  });
}

export function useRateCardsQuery() {
  return useQuery({
    queryKey: queryKeys.config.rateCards,
    queryFn: configApi.fetchRateCards,
  });
}

export function useSaveRateCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cards: FtpRateCard[]) => configApi.saveRateCards(cards),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.rateCards }); },
  });
}

export function useEsgGridQuery(type: 'transition' | 'physical' | 'greenium') {
  return useQuery({
    queryKey: queryKeys.config.esgGrid(type),
    queryFn: () => configApi.fetchEsgGrid(type),
  });
}

export function useSaveEsgGrid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { type: 'transition' | 'physical' | 'greenium'; grid: unknown[] }) =>
      configApi.saveEsgGrid(params.type, params.grid),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.config.esgGrid(variables.type) });
    },
  });
}

export function useRarocInputsQuery() {
  return useQuery({
    queryKey: queryKeys.config.rarocInputs,
    queryFn: configApi.fetchRarocInputs,
  });
}

export function useSaveRarocInputs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: unknown) => configApi.saveRarocInputs(inputs),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.rarocInputs }); },
  });
}

export function useApprovalMatrixQuery() {
  return useQuery({
    queryKey: queryKeys.config.approvalMatrix,
    queryFn: configApi.fetchApprovalMatrix,
  });
}

export function useSaveApprovalMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: unknown) => configApi.saveApprovalMatrix(config),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.approvalMatrix }); },
  });
}

export function useMarketDataSourcesQuery() {
  return useQuery({
    queryKey: queryKeys.config.marketDataSources,
    queryFn: configApi.fetchMarketDataSources,
  });
}

export function useSaveMarketDataSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sources: MarketDataSource[]) => configApi.saveMarketDataSources(sources),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.config.marketDataSources }); },
  });
}

// ---------------------------------------------------------------------------
// Governance config values
// ---------------------------------------------------------------------------

export function useMethodologyChangeRequestsQuery() {
  return useQuery({
    queryKey: queryKeys.governance.methodologyChangeRequests,
    queryFn: configApi.fetchMethodologyChangeRequests,
  });
}

export function useSaveMethodologyChangeRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requests: MethodologyChangeRequest[]) =>
      configApi.saveMethodologyChangeRequests(requests),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.governance.methodologyChangeRequests });
    },
  });
}

export function useMethodologyVersionsQuery() {
  return useQuery({
    queryKey: queryKeys.governance.methodologyVersions,
    queryFn: configApi.fetchMethodologyVersions,
  });
}

export function useSaveMethodologyVersions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versions: MethodologyVersion[]) =>
      configApi.saveMethodologyVersions(versions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.governance.methodologyVersions });
    },
  });
}

export function useApprovalTasksQuery() {
  return useQuery({
    queryKey: queryKeys.governance.approvalTasks,
    queryFn: configApi.fetchApprovalTasks,
  });
}

export function useSaveApprovalTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tasks: ApprovalTask[]) => configApi.saveApprovalTasks(tasks),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.governance.approvalTasks });
    },
  });
}

export function usePricingDossiersQuery() {
  return useQuery({
    queryKey: queryKeys.governance.pricingDossiers,
    queryFn: configApi.fetchPricingDossiers,
  });
}

export function useSavePricingDossiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dossiers: PricingDossier[]) => configApi.savePricingDossiers(dossiers),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.governance.pricingDossiers });
    },
  });
}

export function usePortfolioSnapshotsQuery() {
  return useQuery({
    queryKey: queryKeys.governance.portfolioSnapshots,
    queryFn: configApi.fetchPortfolioSnapshots,
  });
}

export function useSavePortfolioSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshots: PortfolioSnapshot[]) =>
      configApi.savePortfolioSnapshots(snapshots),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.governance.portfolioSnapshots });
    },
  });
}
