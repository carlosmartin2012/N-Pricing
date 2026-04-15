import { apiGet } from '../utils/apiFetch';
import type {
  ClientPosition,
  ClientMetricsSnapshot,
  PricingTarget,
  ClientRelationship,
} from '../types/customer360';

/**
 * Customer 360 read-only client. Sprint 1 — list and aggregate. Mutating
 * endpoints (upserting positions, computing metrics, authoring targets) land
 * in Sprint 2 once the UI is ready to drive them.
 */

export async function getClientRelationship(clientId: string): Promise<ClientRelationship | null> {
  try {
    return await apiGet<ClientRelationship>(
      `/customer360/clients/${encodeURIComponent(clientId)}`,
    );
  } catch {
    return null;
  }
}

export async function listClientPositions(clientId: string): Promise<ClientPosition[]> {
  try {
    const rows = await apiGet<ClientPosition[]>(
      `/customer360/clients/${encodeURIComponent(clientId)}/positions`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listClientMetrics(clientId: string, limit = 12): Promise<ClientMetricsSnapshot[]> {
  try {
    const rows = await apiGet<ClientMetricsSnapshot[]>(
      `/customer360/clients/${encodeURIComponent(clientId)}/metrics?limit=${limit}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listPricingTargets(params: { period?: string; segment?: string } = {}): Promise<PricingTarget[]> {
  const qs = new URLSearchParams();
  if (params.period)  qs.set('period', params.period);
  if (params.segment) qs.set('segment', params.segment);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
  try {
    const rows = await apiGet<PricingTarget[]>(`/customer360/pricing-targets${suffix}`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
