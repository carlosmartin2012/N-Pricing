import { apiGet } from '../utils/apiFetch';
import type {
  EntryPair,
  MatchStatus,
  ReconciliationSummary,
} from '../types/reconciliation';

/**
 * FTP Reconciliation — client HTTP layer for the controller-grade view.
 * Matches the server routes mounted at /api/reconciliation.
 */

export interface ReconciliationSummaryResponse {
  summary: ReconciliationSummary;
  pairs: EntryPair[];
}

export async function getReconciliationSummary(
  asOfPeriod?: string,
): Promise<ReconciliationSummaryResponse | null> {
  try {
    const q = asOfPeriod ? `?asOf=${encodeURIComponent(asOfPeriod)}` : '';
    return await apiGet<ReconciliationSummaryResponse>(`/reconciliation/summary${q}`);
  } catch {
    return null;
  }
}

export async function getReconciliationEntries(
  status: MatchStatus | 'all' | 'unmatched' = 'all',
  asOfPeriod?: string,
): Promise<EntryPair[]> {
  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (asOfPeriod) params.set('asOf', asOfPeriod);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const res = await apiGet<{ pairs: EntryPair[] }>(`/reconciliation/entries${suffix}`);
    return Array.isArray(res?.pairs) ? res.pairs : [];
  } catch {
    return [];
  }
}
