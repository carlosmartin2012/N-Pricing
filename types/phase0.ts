/**
 * Types for Phase 0 hardening — tenancy, reproducibility snapshots, SLO metrics.
 *
 * See docs/phase-0-design.md and docs/phase-0-technical-specs.md for the full
 * specification. Migrations: 20260602000001 .. 20260602000007.
 */

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export type EntityRole = 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';

export type TenancyErrorCode =
  | 'tenancy_missing_header'
  | 'tenancy_invalid_uuid'
  | 'tenancy_denied'
  | 'tenancy_jwt_invalid'
  | 'tenancy_role_missing';

/**
 * Request-scoped tenancy context set by the server tenancy middleware.
 * Available as `req.tenancy` after the middleware has run.
 */
export interface TenancyContext {
  entityId: string;
  userEmail: string;
  role: EntityRole;
  requestId: string;
}

/**
 * Row in the `tenancy_violations` append-only log.
 */
export interface TenancyViolation {
  id: string;
  occurredAt: string;
  requestId: string | null;
  userEmail: string | null;
  endpoint: string | null;
  claimedEntity: string | null;
  actualEntities: string[] | null;
  errorCode: TenancyErrorCode;
  detail: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pricing reproducibility snapshots
// ---------------------------------------------------------------------------

/**
 * Row in `pricing_snapshots`. Immutable by RLS (no UPDATE/DELETE policy).
 * Written by the pricing Edge Function on every /pricing invocation.
 */
export interface PricingSnapshotRow {
  id: string;
  entityId: string;
  dealId: string | null;
  pricingResultId: string | null;

  requestId: string;
  engineVersion: string;
  asOfDate: string; // 'YYYY-MM-DD'
  usedMockFor: string[];

  input: PricingSnapshotInput;
  context: PricingSnapshotContext;
  output: PricingSnapshotOutput;

  inputHash: string; // 64-char lowercase hex (sha256)
  outputHash: string;

  createdAt: string;
}

/**
 * The pricing input as received by the engine. Kept deliberately loose —
 * the full Transaction/Shock/ApprovalMatrix shapes live elsewhere and evolve
 * independently of the snapshot contract.
 */
export interface PricingSnapshotInput {
  deal: Record<string, unknown>;
  approvalMatrix?: Record<string, unknown>;
  shocks?: { interestRate?: number; liquiditySpread?: number };
}

/**
 * The resolved context at call time. Recording everything needed for byte-for-byte
 * replay, even if the underlying reference tables are later mutated.
 */
export interface PricingSnapshotContext {
  curves: {
    yield: unknown[];
    liquidity: unknown[];
  };
  rules: unknown[];
  rateCards: unknown[];
  transitionGrid: Record<string, unknown>;
  physicalGrid: Record<string, unknown>;
  greeniumRateCards: unknown[];
  behaviouralModels: unknown[];
  sdrConfig: Record<string, unknown>;
  lrConfig: Record<string, unknown>;
  clients: unknown[];
  products: unknown[];
  businessUnits: unknown[];
}

export type PricingSnapshotOutput = Record<string, unknown>;

/**
 * Result of replaying a snapshot with the current engine version.
 * `matches` is true iff the output hash recomputed now equals the stored one.
 */
export interface SnapshotReplayResult {
  snapshotId: string;
  matches: boolean;
  engineVersionOriginal: string;
  engineVersionNow: string;
  diff: SnapshotReplayDiffEntry[];
}

export interface SnapshotReplayDiffEntry {
  field: string;
  original: unknown;
  current: unknown;
  deltaAbs?: number;
  deltaBps?: number;
}

// ---------------------------------------------------------------------------
// SLO / SLI
// ---------------------------------------------------------------------------

export type SLIName =
  | 'pricing_single_latency_ms'
  | 'pricing_batch_latency_ms_per_deal'
  | 'pricing_error_rate'
  | 'tenancy_violations_total'
  | 'mock_fallback_rate'
  | 'snapshot_write_failures_total'
  | 'auth_failures_total'
  | 'cold_start_duration_ms'
  | 'attribution_route_latency_ms'
  | 'attribution_decision_time_ms'
  | 'attribution_drift_signals_total';

export type AlertSeverity = 'info' | 'warning' | 'page' | 'critical';

export type AlertChannelType =
  | 'email'
  | 'slack'
  | 'pagerduty'
  | 'webhook'
  | 'opsgenie';

export interface SLODefinition {
  name: SLIName;
  target: number;
  comparator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  windowSeconds: number;
  severity: AlertSeverity;
  description: string;
}

// Channel configs — discriminated unions keyed by the parent AlertRule.channelType.
export interface EmailChannelConfig {
  recipients: string[];
}
export interface SlackChannelConfig {
  webhookUrl: string;
  channel?: string;
}
export interface PagerDutyChannelConfig {
  routingKey: string;
  severity?: string;
}
export interface WebhookChannelConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;
}
export interface OpsgenieChannelConfig {
  apiKey: string;
  team?: string;
}

export type AlertChannelConfig =
  | EmailChannelConfig
  | SlackChannelConfig
  | PagerDutyChannelConfig
  | WebhookChannelConfig
  | OpsgenieChannelConfig;

/**
 * Extended AlertRule. Back-compatible with `types/alertRule.ts` — the legacy
 * fields (id, entityId, metricName, operator, threshold, recipients, isActive,
 * lastTriggeredAt) are preserved; new fields are optional until migration
 * 20260602000006_alert_channels backfills them.
 */
export interface AlertRuleV2 {
  id: string;
  entityId: string;
  name: string;
  metricName: SLIName | string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;

  severity: AlertSeverity;
  windowSeconds: number;
  cooldownSeconds: number;
  channelType: AlertChannelType;
  channelConfig: AlertChannelConfig;

  isActive: boolean;
  lastTriggeredAt: string | null;
  lastEvaluatedAt: string | null;
}

export interface AlertInvocation {
  id: string;
  alertRuleId: string;
  entityId: string;
  triggeredAt: string;
  metricValue: number;
  threshold: number;
  payloadSent: unknown;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'deduped';
  deliveryError: string | null;
}

export interface SLOStatus {
  name: SLIName;
  target: number;
  current: number;
  status: 'ok' | 'warning' | 'breached';
  errorBudget?: { total: number; used: number; pct: number };
}

// ---------------------------------------------------------------------------
// Initial SLO catalog (seed values — to be calibrated after 2 weeks of data).
// ---------------------------------------------------------------------------

export const PRICING_SLOS: readonly SLODefinition[] = [
  {
    name: 'pricing_single_latency_ms',
    target: 300,
    comparator: 'lt',
    windowSeconds: 3600,
    severity: 'warning',
    description: '/pricing p95 under 300 ms (rolling 1h)',
  },
  {
    name: 'pricing_single_latency_ms',
    target: 800,
    comparator: 'lt',
    windowSeconds: 3600,
    severity: 'warning',
    description: '/pricing p99 under 800 ms (rolling 1h)',
  },
  {
    name: 'pricing_batch_latency_ms_per_deal',
    target: 50,
    comparator: 'lt',
    windowSeconds: 3600,
    severity: 'warning',
    description: '/pricing/batch per-deal p95 under 50 ms',
  },
  {
    name: 'pricing_error_rate',
    target: 0.005,
    comparator: 'lt',
    windowSeconds: 300,
    severity: 'page',
    description: 'Error rate under 0.5% (rolling 5 min)',
  },
  {
    name: 'tenancy_violations_total',
    target: 0,
    comparator: 'eq',
    windowSeconds: 60,
    severity: 'critical',
    description: 'Any tenancy violation in 1 minute pages immediately',
  },
  {
    name: 'mock_fallback_rate',
    target: 0.05,
    comparator: 'lt',
    windowSeconds: 3600,
    severity: 'warning',
    description: 'Under 5% of calls fall back to mock data',
  },
  {
    name: 'snapshot_write_failures_total',
    target: 0,
    comparator: 'eq',
    windowSeconds: 300,
    severity: 'page',
    description: 'Snapshot write must never fail',
  },
  // ── Ola 8 Bloque C — Atribuciones jerárquicas
  {
    name: 'attribution_route_latency_ms',
    target: 50,
    comparator: 'lt',
    windowSeconds: 3600,
    severity: 'warning',
    description: 'POST /api/attributions/route p95 under 50 ms',
  },
  {
    name: 'attribution_decision_time_ms',
    target: 4 * 3600 * 1000,
    comparator: 'lt',
    windowSeconds: 24 * 3600,
    severity: 'warning',
    description: 'p95 time-to-decision (open → resolved) under 4h',
  },
  {
    name: 'attribution_drift_signals_total',
    target: 0,
    comparator: 'eq',
    windowSeconds: 24 * 3600,
    severity: 'warning',
    description: 'Any breached drift signal in 24h needs investigation',
  },
] as const;
