import { useQuery } from '@tanstack/react-query';
import * as reconciliationApi from '../../api/reconciliation';
import { queryKeys } from './queryKeys';
import type { MatchStatus } from '../../types/reconciliation';

/**
 * React Query hooks for FTP Reconciliation.
 *
 * Both queries default to the current YYYY-MM period and share a 60s
 * staleTime — reconciliation output shifts only when new deals book or
 * new snapshots write, neither of which happen every second.
 */

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function useReconciliationSummaryQuery(asOfPeriod?: string) {
  const period = asOfPeriod ?? currentPeriod();
  return useQuery({
    queryKey: queryKeys.reconciliation.summary(period),
    queryFn: () => reconciliationApi.getReconciliationSummary(period),
    staleTime: 60_000,
  });
}

export function useReconciliationEntriesQuery(
  status: MatchStatus | 'all' | 'unmatched' = 'all',
  asOfPeriod?: string,
) {
  const period = asOfPeriod ?? currentPeriod();
  return useQuery({
    queryKey: queryKeys.reconciliation.entries(status, period),
    queryFn: () => reconciliationApi.getReconciliationEntries(status, period),
    staleTime: 60_000,
  });
}
