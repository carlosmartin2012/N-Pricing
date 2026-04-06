/**
 * React Query hooks for the Market Data domain.
 *
 * Wraps `api/marketData` with cached queries and mutations
 * for yield curves, liquidity curves, and behavioural models.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BehaviouralModel, YieldCurvePoint } from '../../types';
import * as marketDataApi from '../../api/marketData';
import { queryKeys } from './queryKeys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all yield curve snapshots. */
export function useYieldCurvesQuery() {
  return useQuery({
    queryKey: queryKeys.marketData.yieldCurves,
    queryFn: marketDataApi.listYieldCurves,
  });
}

/** Fetch all liquidity curves. */
export function useLiquidityCurvesQuery() {
  return useQuery({
    queryKey: queryKeys.marketData.liquidityCurves,
    queryFn: marketDataApi.listLiquidityCurves,
  });
}

/** Fetch all behavioural models. */
export function useBehaviouralModelsQuery() {
  return useQuery({
    queryKey: queryKeys.marketData.behaviouralModels,
    queryFn: marketDataApi.listModels,
  });
}

/** Fetch curve history for a specific curve. */
export function useCurveHistoryQuery(curveId: string, months: number = 12) {
  return useQuery({
    queryKey: queryKeys.marketData.curveHistory(curveId, months),
    queryFn: () => marketDataApi.listCurveHistory(curveId, months),
    enabled: !!curveId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Insert a new yield curve snapshot. */
export function useUpsertYieldCurves() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currency: string; date: string; points: YieldCurvePoint[] }) =>
      marketDataApi.upsertYieldCurves(params.currency, params.date, params.points),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.marketData.yieldCurves });
    },
  });
}

/** Save a curve history snapshot. */
export function useSaveCurveHistorySnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      curveId: string;
      currency: string;
      date: string;
      points: YieldCurvePoint[];
    }) =>
      marketDataApi.saveCurveHistorySnapshot(
        params.curveId,
        params.currency,
        params.date,
        params.points,
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.marketData.curveHistory(variables.curveId),
      });
    },
  });
}

/** Upsert a behavioural model. */
export function useUpsertModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (model: BehaviouralModel) => marketDataApi.upsertModel(model),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.marketData.behaviouralModels,
      });
    },
  });
}

/** Delete a behavioural model. */
export function useDeleteModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketDataApi.deleteModel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.marketData.behaviouralModels,
      });
    },
  });
}
