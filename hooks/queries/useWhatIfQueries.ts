/**
 * React Query hooks for Methodology What-If (Ola 3).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as whatIfApi from '../../api/whatIf';
import { useData } from '../../contexts/DataContext';
import type {
  SandboxMethodology,
  ElasticityModel,
  BacktestRun,
  GridFilters,
} from '../../types';

// ---------------------------------------------------------------------------
// Sandbox queries
// ---------------------------------------------------------------------------

export function useSandboxesQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.sandboxes, dataMode, entityId]
      : [...queryKeys.whatIf.sandboxes, dataMode],
    queryFn: () => whatIfApi.listSandboxes(entityId),
  });
}

export function useSandboxQuery(id: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.sandbox(id), dataMode],
    queryFn: () => whatIfApi.getSandbox(id),
    enabled: id.length > 0,
  });
}

export function useCreateSandbox() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sandbox: Omit<SandboxMethodology, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.createSandbox(sandbox);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function useUpdateSandbox() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SandboxMethodology> }) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.updateSandbox(id, updates);
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandbox(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function useDeleteSandbox() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.deleteSandbox(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function usePublishSandbox() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.publishSandbox(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
      void queryClient.invalidateQueries({ queryKey: queryKeys.governance.methodologyChangeRequests });
    },
  });
}

// ---------------------------------------------------------------------------
// Impact report
// ---------------------------------------------------------------------------

export function useImpactReportQuery(sandboxId: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.impact(sandboxId), dataMode],
    queryFn: () => whatIfApi.getImpactReport(sandboxId),
    enabled: sandboxId.length > 0,
  });
}

export function useComputeImpactReport() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sandboxId: string) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.computeImpactReport(sandboxId);
    },
    onSuccess: (_data, sandboxId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.impact(sandboxId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandbox(sandboxId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

// ---------------------------------------------------------------------------
// Elasticity models
// ---------------------------------------------------------------------------

export function useElasticityModelsQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.elasticity, dataMode, entityId]
      : [...queryKeys.whatIf.elasticity, dataMode],
    queryFn: () => whatIfApi.listElasticityModels(entityId),
  });
}

export function useUpsertElasticityModel() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (model: ElasticityModel) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.upsertElasticityModel(model);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.elasticity });
    },
  });
}

export function useCalibrateElasticityModel() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product, segment, entityId }: { product: string; segment: string; entityId?: string }) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.calibrateElasticityModel(product, segment, entityId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.elasticity });
    },
  });
}

// ---------------------------------------------------------------------------
// Backtesting
// ---------------------------------------------------------------------------

export function useBacktestRunsQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.backtests, dataMode, entityId]
      : [...queryKeys.whatIf.backtests, dataMode],
    queryFn: () => whatIfApi.listBacktestRuns(entityId),
  });
}

export function useBacktestResultQuery(runId: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.backtestResult(runId), dataMode],
    queryFn: () => whatIfApi.getBacktestResult(runId),
    enabled: runId.length > 0,
  });
}

export function useCreateBacktestRun() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (run: Omit<BacktestRun, 'id' | 'startedAt' | 'status'>) => {
      if (dataMode !== 'live') throw new Error('What-If mutations are disabled in demo mode');
      return whatIfApi.createBacktestRun(run);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.backtests });
    },
  });
}

// ---------------------------------------------------------------------------
// Market benchmarks
// ---------------------------------------------------------------------------

export function useBenchmarksQuery(filters?: GridFilters) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.benchmarks, dataMode, filters],
    queryFn: () => whatIfApi.listBenchmarks(filters),
  });
}

export function useBenchmarkComparisonQuery(snapshotId: string, asOfDate?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.benchmarkComparison(snapshotId), dataMode, asOfDate],
    queryFn: () => whatIfApi.compareBenchmarks(snapshotId, asOfDate),
    enabled: snapshotId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export function useBudgetTargetsQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.budget, dataMode, entityId]
      : [...queryKeys.whatIf.budget, dataMode],
    queryFn: () => whatIfApi.listBudgetTargets(entityId),
  });
}

export function useBudgetConsistencyQuery(snapshotId: string, entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.whatIf.budgetConsistency(snapshotId), dataMode, entityId],
    queryFn: () => whatIfApi.checkBudgetConsistency(snapshotId, entityId),
    enabled: snapshotId.length > 0,
  });
}
