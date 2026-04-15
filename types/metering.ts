/**
 * Phase 5 — metering & feature flag types.
 * Migrations: supabase/migrations/20260606000001_metering_phase_5.sql
 */

export type UsageEventKind =
  | 'pricing_call'
  | 'snapshot_write'
  | 'channel_quote'
  | 'dossier_sign'
  | 'batch_reprice'
  | 'elasticity_recalibrate'
  | 'raroc_realize'
  | 'escalation_opened';

export interface UsageEvent {
  id: number;
  occurredAt: string;
  entityId: string;
  eventKind: UsageEventKind;
  units: number;
  detail: Record<string, unknown>;
}

export interface UsageAggregateDay {
  entityId: string;
  day: string;            // YYYY-MM-DD
  eventKind: UsageEventKind;
  eventCount: number;
  unitsTotal: number;
}

export interface TenantFeatureFlag {
  entityId: string;
  flag: string;
  enabled: boolean;
  setBy: string | null;
  setAt: string;
  notes: string | null;
}
