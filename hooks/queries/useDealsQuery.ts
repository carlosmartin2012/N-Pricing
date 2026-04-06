/**
 * React Query hooks for the Deals domain.
 *
 * These wrap the `api/deals` layer and provide cached, auto-refetching
 * queries plus optimistic-friendly mutations with automatic invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Transaction, FTPResult } from '../../types';
import * as dealsApi from '../../api/deals';
import { queryKeys } from './queryKeys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all deals, optionally scoped to an entity. */
export function useDealsQuery(entityId?: string) {
  return useQuery({
    queryKey: entityId ? [...queryKeys.deals.all, entityId] : queryKeys.deals.all,
    queryFn: () => dealsApi.listDeals(entityId),
  });
}

/** Fetch a paginated slice of deals. */
export function useDealsPaginatedQuery(page: number = 1, pageSize: number = 50) {
  return useQuery({
    queryKey: queryKeys.deals.paginated(page, pageSize),
    queryFn: () => dealsApi.listDealsPaginated(page, pageSize),
  });
}

/** Fetch version history for a single deal. */
export function useDealVersionsQuery(dealId: string) {
  return useQuery({
    queryKey: queryKeys.deals.versions(dealId),
    queryFn: () => dealsApi.listDealVersions(dealId),
    enabled: !!dealId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upsert (create or update) a deal. Invalidates the deals list on success. */
export function useUpsertDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deal: Transaction) => dealsApi.upsertDeal(deal),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
  });
}

/** Batch upsert multiple deals. */
export function useBatchUpsertDeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deals: Transaction[]) => dealsApi.batchUpsertDeals(deals),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
  });
}

/** Delete a deal by id. Invalidates the deals list on success. */
export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dealsApi.deleteDeal(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
  });
}

/** Transition a deal to a new workflow status. */
export function useTransitionDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: dealsApi.TransitionOptions) => dealsApi.transitionDeal(opts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
  });
}

/** Create a point-in-time version snapshot of a deal. */
export function useCreateDealVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      dealId: string;
      version: number;
      snapshot: Transaction;
      pricingResult: FTPResult | null;
      changedBy: string;
      reason?: string;
    }) =>
      dealsApi.createDealVersion(
        params.dealId,
        params.version,
        params.snapshot,
        params.pricingResult,
        params.changedBy,
        params.reason,
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.deals.versions(variables.dealId),
      });
    },
  });
}
