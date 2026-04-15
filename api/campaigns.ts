import { apiGet, apiPost, apiPatch } from '../utils/apiFetch';
import type { PricingCampaign, CampaignStatus, ChannelType } from '../types/channels';

/**
 * Pricing campaigns client. Reads from /api/customer360/pricing-targets is
 * a different concept (top-down floors); campaigns live under their own
 * endpoint which we add to the server in this sprint.
 */

interface CampaignRow {
  id: string; entity_id: string; code: string; name: string;
  segment: string; product_type: string; currency: string;
  channel: ChannelType | null;
  rate_delta_bps: number; max_volume_eur: number | null; consumed_volume_eur: number;
  active_from: string; active_to: string; status: CampaignStatus;
  version: number; parent_version_id: string | null;
  created_by: string | null; approved_by: string | null; approved_at: string | null;
  created_at: string; updated_at: string;
}

function map(r: CampaignRow): PricingCampaign {
  return {
    id: r.id, entityId: r.entity_id, code: r.code, name: r.name,
    segment: r.segment, productType: r.product_type, currency: r.currency,
    channel: r.channel,
    rateDeltaBps: Number(r.rate_delta_bps),
    maxVolumeEur: r.max_volume_eur != null ? Number(r.max_volume_eur) : null,
    consumedVolumeEur: Number(r.consumed_volume_eur),
    activeFrom: r.active_from, activeTo: r.active_to, status: r.status,
    version: r.version, parentVersionId: r.parent_version_id,
    createdBy: r.created_by, approvedBy: r.approved_by, approvedAt: r.approved_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function listCampaigns(): Promise<PricingCampaign[]> {
  try {
    const rows = await apiGet<CampaignRow[]>('/campaigns');
    return Array.isArray(rows) ? rows.map(map) : [];
  } catch {
    return [];
  }
}

export async function createCampaign(input: {
  code: string; name: string; segment: string; productType: string;
  currency?: string; channel?: ChannelType | null;
  rateDeltaBps: number; maxVolumeEur?: number | null;
  activeFrom: string; activeTo: string;
}): Promise<PricingCampaign | null> {
  const row = await apiPost<CampaignRow | null>('/campaigns', {
    code: input.code, name: input.name,
    segment: input.segment, product_type: input.productType,
    currency: input.currency ?? 'EUR',
    channel: input.channel ?? null,
    rate_delta_bps: input.rateDeltaBps,
    max_volume_eur: input.maxVolumeEur ?? null,
    active_from: input.activeFrom,
    active_to: input.activeTo,
  });
  return row ? map(row) : null;
}

export async function transitionCampaign(id: string, status: CampaignStatus): Promise<PricingCampaign | null> {
  const row = await apiPatch<CampaignRow | null>(`/campaigns/${encodeURIComponent(id)}/status`, { status });
  return row ? map(row) : null;
}
