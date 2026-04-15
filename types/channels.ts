/**
 * Phase 2 — Channels & Bulk Ops types.
 *
 * Migrations: supabase/migrations/20260604000001_channels_and_campaigns.sql
 */

export type ChannelType = 'branch' | 'web' | 'mobile' | 'call_center' | 'partner';

export interface ChannelApiKey {
  id: string;
  entityId: string;
  channel: ChannelType;
  label: string;
  keyHash: string;
  rateLimitRpm: number;
  rateLimitBurst: number;
  dailyQuota: number | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export type CampaignStatus =
  | 'draft' | 'approved' | 'active' | 'exhausted' | 'expired' | 'cancelled';

export interface PricingCampaign {
  id: string;
  entityId: string;
  code: string;
  name: string;
  segment: string;
  productType: string;
  currency: string;
  channel: ChannelType | null;

  rateDeltaBps: number;
  maxVolumeEur: number | null;
  consumedVolumeEur: number;

  activeFrom: string;
  activeTo: string;
  status: CampaignStatus;
  version: number;
  parentVersionId: string | null;

  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignLookup {
  entityId: string;
  segment: string;
  productType: string;
  currency: string;
  channel?: ChannelType;
  asOfDate: string;
}

export interface ChannelRequestLogEntry {
  id: number;
  occurredAt: string;
  entityId: string;
  apiKeyId: string | null;
  channel: ChannelType;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  requestId: string | null;
}
