/**
 * React Query hooks for market benchmarks (Ola 6 Bloque D).
 *
 * Cross-tenant reference data — a single shared cache key (no entityId
 * scoping). `staleTime` is generous since benchmark feed updates at most
 * daily.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMarketBenchmarks,
  upsertMarketBenchmark,
  deleteMarketBenchmark,
  type MarketBenchmarkFilters,
  type MarketBenchmarkWithId,
} from '../../api/marketBenchmarks';
import { queryKeys } from './queryKeys';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useMarketBenchmarksQuery(filters?: MarketBenchmarkFilters) {
  const key = filters
    ? queryKeys.marketBenchmarks.filtered(filters)
    : queryKeys.marketBenchmarks.all;
  return useQuery({
    queryKey: key,
    queryFn: () => listMarketBenchmarks(filters),
    staleTime: ONE_HOUR_MS,
  });
}

export function useUpsertMarketBenchmarkMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Omit<MarketBenchmarkWithId, 'id'> & { id?: string }) =>
      upsertMarketBenchmark(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketBenchmarks.all });
    },
  });
}

export function useDeleteMarketBenchmarkMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMarketBenchmark(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketBenchmarks.all });
    },
  });
}
