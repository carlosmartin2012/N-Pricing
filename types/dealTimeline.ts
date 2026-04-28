/**
 * Deal Timeline — Ola 7 Bloque A.
 *
 * Aggregated view of every relevant event for a single deal: pricing
 * snapshots, approval escalations, signed dossiers and (future) audit
 * events. Replaces the cross-view click-trail (Escalations + Dossiers +
 * Audit + Blotter) with a single chronological vista.
 *
 * The shape is read-only — there is no write path. Mutations happen on
 * the source tables (pricing_snapshots, approval_escalations,
 * signed_committee_dossiers) and the timeline re-aggregates on demand.
 */

export type DealTimelineEventKind =
  | 'deal_created'
  | 'deal_repriced'
  | 'escalation_opened'
  | 'escalation_resolved'
  | 'escalation_expired'
  | 'dossier_signed';

export interface DealTimelineActor {
  email: string | null;
  name: string | null;
  role: string | null;
}

export interface DealTimelineEvent {
  /** Stable id derived from source-table + row id. Useful for `?focus=…`. */
  id: string;
  dealId: string;
  occurredAt: string;          // ISO-8601
  kind: DealTimelineEventKind;
  actor: DealTimelineActor;
  /** Per-kind payload. See DealTimelinePayload union below. */
  payload: DealTimelinePayload;
  /** Link to a pricing_snapshots row when the event relates to a pricing run. */
  snapshotId?: string;
}

export type DealTimelinePayload =
  | { kind: 'deal_created'; status: string }
  | { kind: 'deal_repriced'; ftpPct: number; finalClientRatePct: number; rarocPct: number; engineVersion: string }
  | { kind: 'escalation_opened'; level: 'L1' | 'L2' | 'Committee'; dueAt: string }
  | { kind: 'escalation_resolved'; level: 'L1' | 'L2' | 'Committee'; resolvedAt: string }
  | { kind: 'escalation_expired'; level: 'L1' | 'L2' | 'Committee'; expiredAt: string }
  | { kind: 'dossier_signed'; payloadHash: string; signatureHex: string };

export interface DealTimelineLineageEntry {
  stage: 'created' | 'L1' | 'L2' | 'Committee' | 'approved' | 'rejected';
  actor: string | null;        // email
  at: string;                  // ISO-8601
}

export interface DealTimeline {
  dealId: string;
  entityId: string;
  /** Latest known status of the deal (from `deals.status`). */
  currentStatus: string;
  /** ASC by occurredAt — earliest first. */
  events: DealTimelineEvent[];
  /** Decision lineage extracted from event sequence. */
  decisionLineage: DealTimelineLineageEntry[];
  /** Aggregate counts useful for the UI header KPIs. */
  counts: {
    repricings: number;
    escalations: number;
    dossiers: number;
  };
}

// ----- Source row shapes (snake_case from Postgres) -----
//
// These are the exact shapes the aggregator consumes. Server fetches them
// with raw SQL; the aggregator is pure and re-usable from tests.

export interface DealRow {
  id: string;
  entity_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PricingSnapshotRow {
  id: string;
  deal_id: string;
  entity_id: string;
  total_ftp: number | null;
  final_client_rate: number | null;
  raroc: number | null;
  engine_version: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface EscalationRow {
  id: string;
  deal_id: string | null;
  entity_id: string;
  level: 'L1' | 'L2' | 'Committee';
  status: 'open' | 'resolved' | 'escalated' | 'expired';
  due_at: string;
  notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DossierRow {
  id: string;
  deal_id: string | null;
  entity_id: string;
  pricing_snapshot_id: string | null;
  payload_hash: string;
  signature_hex: string;
  signed_by_email: string;
  signed_at: string;
}
