import { apiGet, apiPost, apiPatch } from '../utils/apiFetch';
import type {
  ClientEvent,
  ClientLtvSnapshot,
  NbaRecommendation,
  DealCandidate,
  LtvAssumptions,
  MarginalLtvImpact,
  LtvComputation,
  PipelineNbaRow,
  PipelineStatusFilter,
} from '../types/clv';

/**
 * Read-heavy client for CLV + 360º temporal. Mutations are rare (recompute
 * snapshot on demand, generate NBA, consume NBA, append event) but explicit.
 * All endpoints are entity-scoped server-side; the client never sends
 * entity_id — the x-entity-id header is set by apiFetch via Auth headers in
 * higher layers (same contract as customer360).
 */

// ---------- Timeline ----------

export async function listClientTimeline(clientId: string, limit = 100): Promise<ClientEvent[]> {
  try {
    const rows = await apiGet<ClientEvent[]>(
      `/clv/clients/${encodeURIComponent(clientId)}/timeline?limit=${limit}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function appendClientEvent(
  clientId: string,
  event: Partial<ClientEvent>,
): Promise<ClientEvent | null> {
  try {
    return await apiPost<ClientEvent>(
      `/clv/clients/${encodeURIComponent(clientId)}/timeline`,
      event,
    );
  } catch {
    return null;
  }
}

// ---------- LTV ----------

export async function listClientLtvSnapshots(clientId: string): Promise<ClientLtvSnapshot[]> {
  try {
    const rows = await apiGet<ClientLtvSnapshot[]>(
      `/clv/clients/${encodeURIComponent(clientId)}/ltv`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function recomputeClientLtv(
  clientId: string,
  params: Partial<LtvAssumptions> & { asOfDate?: string } = {},
): Promise<ClientLtvSnapshot | null> {
  try {
    return await apiPost<ClientLtvSnapshot>(
      `/clv/clients/${encodeURIComponent(clientId)}/ltv/recompute`,
      params,
    );
  } catch {
    return null;
  }
}

// ---------- NBA ----------

/**
 * Firmwide Pipeline: every NBA (default = open only) for the entity,
 * enriched with client name/segment/rating. Powers the /pipeline view.
 */
export async function listPipelineNba(
  status: PipelineStatusFilter = 'open',
): Promise<PipelineNbaRow[]> {
  try {
    const rows = await apiGet<PipelineNbaRow[]>(`/clv/nba?status=${status}`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listClientNba(
  clientId: string,
  onlyOpen = true,
): Promise<NbaRecommendation[]> {
  try {
    const rows = await apiGet<NbaRecommendation[]>(
      `/clv/clients/${encodeURIComponent(clientId)}/nba?open=${onlyOpen}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function generateNba(
  clientId: string,
  params: Partial<LtvAssumptions> & { asOfDate?: string; topN?: number } = {},
): Promise<NbaRecommendation[]> {
  try {
    const rows = await apiPost<NbaRecommendation[]>(
      `/clv/clients/${encodeURIComponent(clientId)}/nba/generate`,
      params,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function consumeNba(id: string): Promise<NbaRecommendation | null> {
  try {
    return await apiPatch<NbaRecommendation>(`/clv/nba/${encodeURIComponent(id)}/consume`, {});
  } catch {
    return null;
  }
}

// ---------- Marginal LTV impact ----------

export interface PreviewLtvImpactResponse {
  before: Pick<LtvComputation, 'clvPointEur' | 'clvP5Eur' | 'clvP95Eur'>;
  impact: MarginalLtvImpact;
  assumptions: LtvAssumptions;
}

export async function previewLtvImpact(
  clientId: string,
  candidate: DealCandidate,
  assumptions: Partial<LtvAssumptions> = {},
  asOfDate?: string,
): Promise<PreviewLtvImpactResponse | null> {
  try {
    return await apiPost<PreviewLtvImpactResponse>(
      '/clv/preview-ltv-impact',
      { clientId, candidate, assumptions, asOfDate },
    );
  } catch {
    return null;
  }
}
