import { useQuery } from '@tanstack/react-query';
import * as dealTimelineApi from '../../api/dealTimeline';
import { queryKeys } from './queryKeys';

/**
 * React Query hook for the unified Deal Timeline (Ola 7 Bloque A).
 *
 * Aggregates pricing snapshots, escalations and signed dossiers per
 * deal. The timeline shifts only when one of those source tables
 * receives a new row, so a 30 s staleTime is plenty — and a refresh
 * happens immediately if the user navigates away and back.
 *
 * Pass an empty `dealId` to keep the query disabled (used during
 * initial render before a deal is selected).
 */
export function useDealTimelineQuery(dealId: string) {
  return useQuery({
    queryKey: queryKeys.deals.timeline(dealId),
    queryFn: () => dealTimelineApi.getDealTimeline(dealId),
    staleTime: 30_000,
    enabled: dealId.length > 0,
  });
}
