/**
 * React Query hooks for Methodology What-If (Ola 3).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as whatIfApi from '../../api/whatIf';
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
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.sandboxes, entityId]
      : queryKeys.whatIf.sandboxes,
    queryFn: () => whatIfApi.listSandboxes(entityId),
  });
}

export function useSandboxQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.whatIf.sandbox(id),
    queryFn: () => whatIfApi.getSandbox(id),
    enabled: id.length > 0,
  });
}

export function useCreateSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sandbox: Omit<SandboxMethodology, 'id' | 'createdAt' | 'updatedAt'>) =>
      whatIfApi.createSandbox(sandbox),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function useUpdateSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SandboxMethodology> }) =>
      whatIfApi.updateSandbox(id, updates),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandbox(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function useDeleteSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => whatIfApi.deleteSandbox(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.sandboxes });
    },
  });
}

export function usePublishSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => whatIfApi.publishSandbox(id),
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
  return useQuery({
    queryKey: queryKeys.whatIf.impact(sandboxId),
    queryFn: () => whatIfApi.getImpactReport(sandboxId),
    enabled: sandboxId.length > 0,
  });
}

export function useComputeImpactReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sandboxId: string) => whatIfApi.computeImpactReport(sandboxId),
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
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.elasticity, entityId]
      : queryKeys.whatIf.elasticity,
    queryFn: () => whatIfApi.listElasticityModels(entityId),
  });
}

export function useUpsertElasticityModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (model: ElasticityModel) => whatIfApi.upsertElasticityModel(model),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.elasticity });
    },
  });
}

export function useCalibrateElasticityModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ product, segment, entityId }: { product: string; segment: string; entityId?: string }) =>
      whatIfApi.calibrateElasticityModel(product, segment, entityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.elasticity });
    },
  });
}

// ---------------------------------------------------------------------------
// Backtesting
// ---------------------------------------------------------------------------

export function useBacktestRunsQuery(entityId?: string) {
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.backtests, entityId]
      : queryKeys.whatIf.backtests,
    queryFn: () => whatIfApi.listBacktestRuns(entityId),
  });
}

export function useBacktestResultQuery(runId: string) {
  return useQuery({
    queryKey: queryKeys.whatIf.backtestResult(runId),
    queryFn: () => whatIfApi.getBacktestResult(runId),
    enabled: runId.length > 0,
  });
}

export function useCreateBacktestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: Omit<BacktestRun, 'id' | 'startedAt' | 'status'>) =>
      whatIfApi.createBacktestRun(run),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatIf.backtests });
    },
  });
}

// ---------------------------------------------------------------------------
// Market benchmarks
// ---------------------------------------------------------------------------

export function useBenchmarksQuery(filters?: GridFilters) {
  return useQuery({
    queryKey: [...queryKeys.whatIf.benchmarks, filters],
    queryFn: () => whatIfApi.listBenchmarks(filters),
  });
}

export function useBenchmarkComparisonQuery(snapshotId: string, asOfDate?: string) {
  return useQuery({
    queryKey: [...queryKeys.whatIf.benchmarkComparison(snapshotId), asOfDate],
    queryFn: () => whatIfApi.compareBenchmarks(snapshotId, asOfDate),
    enabled: snapshotId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export function useBudgetTargetsQuery(entityId?: string) {
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.whatIf.budget, entityId]
      : queryKeys.whatIf.budget,
    queryFn: () => whatIfApi.listBudgetTargets(entityId),
  });
}

export function useBudgetConsistencyQuery(snapshotId: string, entityId?: string) {
  return useQuery({
    queryKey: [...queryKeys.whatIf.budgetConsistency(snapshotId), entityId],
    queryFn: () => whatIfApi.checkBudgetConsistency(snapshotId, entityId),
    enabled: snapshotId.length > 0,
  });
}
