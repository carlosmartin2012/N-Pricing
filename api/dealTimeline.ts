import { apiGet } from '../utils/apiFetch';
import type { DealTimeline } from '../types/dealTimeline';

/**
 * Deal Timeline — client HTTP layer for the unified per-deal timeline.
 * Matches the server route mounted at /api/deals/:id/timeline (Ola 7
 * Bloque A.2). Returns null on any error so consuming hooks can render
 * a graceful empty/error state without crashing.
 */
export async function getDealTimeline(dealId: string): Promise<DealTimeline | null> {
  if (!dealId) return null;
  try {
    return await apiGet<DealTimeline>(`/deals/${encodeURIComponent(dealId)}/timeline`);
  } catch {
    return null;
  }
}
