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
import type { DealCandidate, LtvAssumptions, PipelineStatusFilter } from '../../types/clv';

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

/**
 * Firmwide Pipeline — aggregated NBA feed across every client for the
 * current entity. Shorter staleTime than per-client NBA because the
 * pipeline is the banker's live work queue: 10s is the right tradeoff
 * between freshness and server load.
 *
 * @param refetchIntervalMs - when > 0, turns on polling every N ms.
 *   Opt-in only (default = off) so bankers who do not want the feed
 *   to shift under their cursor see stable data until they manually
 *   refresh or change the filter.
 */
export function usePipelineNbaQuery(
  status: PipelineStatusFilter = 'open',
  refetchIntervalMs = 0,
) {
  return useQuery({
    queryKey: queryKeys.clv.pipelineNba(status),
    queryFn: () => clvApi.listPipelineNba(status),
    staleTime: 10_000,
    refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
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
      // Pipeline view is firmwide — refetch all status buckets.
      void qc.invalidateQueries({ queryKey: ['clv', 'pipeline', 'nba'] });
    },
  });
}

/**
 * Standalone consume used from the Pipeline view — client-id agnostic.
 * Invalidates every NBA query and the pipeline feed so the row disappears
 * from "open" immediately and reappears under "consumed".
 */
export function useConsumeNbaPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clvApi.consumeNba(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clv', 'pipeline', 'nba'] });
      void qc.invalidateQueries({ queryKey: ['clv', 'nba'] });
      // Antes faltaba: el server escribe un evento `nba_consumed` en
      // `client_events`. Si el usuario abre la ficha del cliente
      // afectado tras consumir desde Pipeline, la timeline mostraba
      // datos stale durante 30s. Invalida prefijo `['clv', 'timeline']`
      // para refrescar todos los timelines (no sabemos qué clientId).
      void qc.invalidateQueries({ queryKey: ['clv', 'timeline'] });
    },
  });
}

/**
 * Composite mutation: run LTV recompute + NBA generate in sequence for a
 * client. Used by the "Initialize CLV" empty-state CTA — with a single
 * click the banker goes from a client that has positions but no snapshot
 * to one with CLV projection + 2-3 NBA recommendations ready in the tabs.
 *
 * Failure isolation: if the LTV recompute fails we skip the NBA step and
 * surface the error; if NBA fails after LTV succeeded we keep the LTV
 * (partial success is better than rollback here). The hook exposes both
 * promises via `isPending`, `data` and `error` in the usual react-query
 * shape.
 */
export function useInitializeClv(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const snapshot = await clvApi.recomputeClientLtv(clientId);
      if (!snapshot) {
        throw new Error('initialize_clv_ltv_failed');
      }
      const nba = await clvApi.generateNba(clientId);
      return { snapshot, nba };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clv.ltvHistory(clientId) });
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
