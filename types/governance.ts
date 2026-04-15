/**
 * Phase 3 governance types — model inventory, signed dossiers,
 * approval escalations.
 *
 * Migrations: supabase/migrations/20260605000001_governance_phase_3.sql
 */

export type ModelKind =
  | 'engine' | 'ruleset' | 'elasticity' | 'shock_pack'
  | 'behavioural' | 'rate_card' | 'other';

export type ModelStatus = 'candidate' | 'active' | 'retired' | 'rejected';

export interface ModelInventoryEntry {
  id: string;
  entityId: string | null;
  kind: ModelKind;
  name: string;
  version: string;
  status: ModelStatus;
  ownerEmail: string | null;
  validationDocUrl: string | null;
  validatedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignedDossier {
  id: string;
  entityId: string;
  dealId: string | null;
  pricingSnapshotId: string | null;
  dossierPayload: Record<string, unknown>;
  payloadHash: string;
  signatureHex: string;
  signedByEmail: string;
  signedAt: string;
}

export interface DossierSignatureVerification {
  payloadHashMatches: boolean;
  signatureMatches: boolean;
  verifiedAt: string;
}

export type EscalationLevel = 'L1' | 'L2' | 'Committee';
export type EscalationStatus = 'open' | 'resolved' | 'escalated' | 'expired';

export interface ApprovalEscalation {
  id: string;
  entityId: string;
  dealId: string | null;
  exceptionId: string | null;
  level: EscalationLevel;
  dueAt: string;
  status: EscalationStatus;
  notifiedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  openedBy: string | null;
  currentNotes: string | null;
  escalatedFromId: string | null;
}

/**
 * Per-entity configuration for the escalation workflow. One row per level,
 * Admin-only writes via RLS. `notifyBeforeHours` drives a pre-expiry warning:
 * e.g. L1 with timeout=24 and notify=4 pings the desk at 20h, escalates at 24h.
 */
export interface ApprovalEscalationConfig {
  id: string;
  entityId: string;
  level: EscalationLevel;
  timeoutHours: number;
  notifyBeforeHours: number;
  channelType: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'opsgenie';
  channelConfig: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EscalationAction =
  | { kind: 'none' }
  | { kind: 'notify'; reason: 'approaching_due' }
  | { kind: 'escalate'; fromLevel: EscalationLevel; toLevel: EscalationLevel; newDueAt: string }
  | { kind: 'expire'; reason: 'no_next_level' };
