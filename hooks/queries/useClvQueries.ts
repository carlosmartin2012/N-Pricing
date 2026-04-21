/**
 * React Query hooks for CLV + 360º temporal (Phase 6).
 *
 * Model migration: these are the first CLV-era queries routed through
 * React Query. Serve as the reference pattern when migrating other domains
 * (useData / DataContext) off direct fetch and into the cache.
 *
 * Design choices:
 *   - `ltvHistory` and `timeline` are cheap to re-render → default
 *     staleTime 30s, refetch on window focus off.
 *   - `previewImpact` is debounced upstream (LtvImpactPanel); we still give
 *     it a short cache of 5s so rapid rate oscillations don't hit the
 *     server twice with the same fingerprint.
 *   - Mutations invalidate the narrow slice they changed, not the whole
 *     CLV tree.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as clvApi from '../../api/clv';
import { queryKeys } from './queryKeys';
import type { DealCandidate, LtvAssumptions } from '../../types/clv';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useClientTimelineQuery(clientId: string | null, limit = 100) {
  return useQuery({
    queryKey: clientId ? queryKeys.clv.timeline(clientId) : ['clv', 'timeline', 'disabled'],
    queryFn: () => clvApi.listClientTimeline(clientId!, limit),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useClientLtvHistoryQuery(clientId: string | null) {
  return useQuery({
    queryKey: clientId ? queryKeys.clv.ltvHistory(clientId) : ['clv', 'ltv', 'disabled'],
    queryFn: () => clvApi.listClientLtvSnapshots(clientId!),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useClientNbaQuery(clientId: string | null, onlyOpen = true) {
  return useQuery({
    queryKey: clientId ? queryKeys.clv.nba(clientId, onlyOpen) : ['clv', 'nba', 'disabled'],
    queryFn: () => clvApi.listClientNba(clientId!, onlyOpen),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

/**
 * Preview CLV impact for a deal candidate. The caller provides a stable
 * `fingerprint` string (typically JSON.stringify of the candidate) so the
 * cache key deduplicates identical requests.
 */
export function useLtvImpactPreviewQuery(
  clientId: string | null,
  candidate: DealCandidate | null,
  fingerprint: string,
  assumptions?: Partial<LtvAssumptions>,
  asOfDate?: string,
) {
  return useQuery({
    queryKey: clientId && candidate
      ? queryKeys.clv.previewImpact(clientId, fingerprint)
      : ['clv', 'preview-impact', 'disabled'],
    queryFn: () => clvApi.previewLtvImpact(clientId!, candidate!, assumptions, asOfDate),
    enabled: !!clientId && !!candidate,
    staleTime: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRecomputeLtv(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Partial<LtvAssumptions> & { asOfDate?: string } = {}) =>
      clvApi.recomputeClientLtv(clientId, params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clv.ltvHistory(clientId) });
      void qc.invalidateQueries({ queryKey: queryKeys.clv.timeline(clientId) });
    },
  });
}

export function useGenerateNba(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Partial<LtvAssumptions> & { asOfDate?: string; topN?: number } = {}) =>
      clvApi.generateNba(clientId, params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clv.nba(clientId, true) });
      void qc.invalidateQueries({ queryKey: queryKeys.clv.nba(clientId, false) });
      void qc.invalidateQueries({ queryKey: queryKeys.clv.timeline(clientId) });
    },
  });
}

export function useConsumeNba(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clvApi.consumeNba(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clv.nba(clientId, true) });
      void qc.invalidateQueries({ queryKey: queryKeys.clv.nba(clientId, false) });
      void qc.invalidateQueries({ queryKey: queryKeys.clv.timeline(clientId) });
    },
  });
}

export function useAppendClientEvent(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: Parameters<typeof clvApi.appendClientEvent>[1]) =>
      clvApi.appendClientEvent(clientId, event),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clv.timeline(clientId) });
    },
  });
}
