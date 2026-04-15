import type {
  ClientEntity,
} from '../../types';
import type {
  ClientPosition,
  ClientMetricsSnapshot,
  PricingTarget,
  PricingTargetLookup,
  ClientRelationship,
  ClientRelationshipMetrics,
} from '../../types/customer360';

/**
 * Pure aggregation + lookup helpers for Customer 360.
 *
 * No I/O. Given the raw rows already loaded (positions, metrics snapshots,
 * pricing targets) these functions assemble the ClientRelationship lens and
 * resolve which targets apply at a given moment.
 */

// ---------------------------------------------------------------------------
// Target matching
// ---------------------------------------------------------------------------

/**
 * A target matches a lookup when:
 *   - same entity, segment, productType, currency
 *   - active_from <= asOfDate <= (active_to ?? +∞)
 *   - is_active = true
 *
 * If multiple targets match, callers should prefer the most specific (e.g.
 * exact productType > 'Any'). For Sprint 1 the rows already encode their
 * specificity, so this returns every match — caller decides ordering.
 */
export function findApplicableTargets(
  targets: PricingTarget[],
  lookup: PricingTargetLookup,
): PricingTarget[] {
  return targets.filter((t) =>
    t.isActive
    && t.entityId === lookup.entityId
    && t.segment === lookup.segment
    && t.productType === lookup.productType
    && t.currency === lookup.currency
    && t.activeFrom <= lookup.asOfDate
    && (t.activeTo === null || lookup.asOfDate <= t.activeTo),
  );
}

/**
 * For matching during pricing engine runs: pick the target with the latest
 * activeFrom (most recent commitment wins). Returns null when nothing applies.
 */
export function pickActiveTarget(
  targets: PricingTarget[],
  lookup: PricingTargetLookup,
): PricingTarget | null {
  const matches = findApplicableTargets(targets, lookup);
  if (matches.length === 0) return null;
  return matches.reduce((best, t) =>
    t.activeFrom > best.activeFrom ? t : best,
  );
}

// ---------------------------------------------------------------------------
// Relationship aggregator
// ---------------------------------------------------------------------------

interface BuildRelationshipParams {
  client: ClientEntity;
  positions: ClientPosition[];
  metricsHistory: ClientMetricsSnapshot[];
  targets: PricingTarget[];
  asOfDate: string;          // YYYY-MM-DD
}

export function buildClientRelationship(params: BuildRelationshipParams): ClientRelationship {
  const { client, positions, metricsHistory, targets, asOfDate } = params;

  const activePositions = positions.filter((p) => p.status === 'Active');
  const totalExposureEur = activePositions.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const productTypesHeld = Array.from(new Set(activePositions.map((p) => p.productType))).sort();

  const sortedMetrics = [...metricsHistory].sort((a, b) =>
    a.computedAt < b.computedAt ? 1 : a.computedAt > b.computedAt ? -1 : 0,
  );
  const latest = sortedMetrics[0] ?? null;
  const metrics: ClientRelationshipMetrics = { latest, history: sortedMetrics };

  // For Sprint 1 we just slice the targets that are still in window for
  // the client's segment + held product types. No specificity ranking yet.
  const applicableTargets = targets.filter((t) =>
    t.isActive
    && t.segment === client.segment
    && (productTypesHeld.length === 0 || productTypesHeld.includes(t.productType))
    && t.activeFrom <= asOfDate
    && (t.activeTo === null || asOfDate <= t.activeTo),
  );

  const relationshipAgeYears = latest?.relationshipAgeYears ?? null;

  return {
    client,
    positions,
    metrics,
    applicableTargets,
    derived: {
      activePositionCount: activePositions.length,
      totalExposureEur,
      productTypesHeld,
      relationshipAgeYears,
      isMultiProduct: productTypesHeld.length > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers used by API mappers — keep DB → domain conversion in one place
// ---------------------------------------------------------------------------

interface ClientPositionRow {
  id: string;
  entity_id: string;
  client_id: string;
  product_id: string | null;
  product_type: string;
  category: ClientPosition['category'];
  deal_id: string | null;
  amount: string | number;
  currency: string;
  margin_bps: string | number | null;
  start_date: string;
  maturity_date: string | null;
  status: ClientPosition['status'];
  created_at: string;
  updated_at: string;
}

export function mapClientPositionRow(row: ClientPositionRow): ClientPosition {
  return {
    id:           row.id,
    entityId:     row.entity_id,
    clientId:     row.client_id,
    productId:    row.product_id,
    productType:  row.product_type,
    category:     row.category,
    dealId:       row.deal_id,
    amount:       Number(row.amount),
    currency:     row.currency,
    marginBps:    row.margin_bps != null ? Number(row.margin_bps) : null,
    startDate:    row.start_date,
    maturityDate: row.maturity_date,
    status:       row.status,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

interface ClientMetricsSnapshotRow {
  id: string;
  entity_id: string;
  client_id: string;
  period: string;
  computed_at: string;
  nim_bps: string | number | null;
  fees_eur: string | number | null;
  eva_eur: string | number | null;
  share_of_wallet_pct: string | number | null;
  relationship_age_years: string | number | null;
  nps_score: number | null;
  active_position_count: number;
  total_exposure_eur: string | number;
  source: ClientMetricsSnapshot['source'];
  detail: Record<string, unknown> | null;
}

export function mapClientMetricsSnapshotRow(row: ClientMetricsSnapshotRow): ClientMetricsSnapshot {
  return {
    id:                   row.id,
    entityId:             row.entity_id,
    clientId:             row.client_id,
    period:               row.period,
    computedAt:           row.computed_at,
    nimBps:               row.nim_bps != null ? Number(row.nim_bps) : null,
    feesEur:              row.fees_eur != null ? Number(row.fees_eur) : null,
    evaEur:               row.eva_eur != null ? Number(row.eva_eur) : null,
    shareOfWalletPct:     row.share_of_wallet_pct != null ? Number(row.share_of_wallet_pct) : null,
    relationshipAgeYears: row.relationship_age_years != null ? Number(row.relationship_age_years) : null,
    npsScore:             row.nps_score,
    activePositionCount:  Number(row.active_position_count ?? 0),
    totalExposureEur:     Number(row.total_exposure_eur ?? 0),
    source:               row.source,
    detail:               row.detail ?? {},
  };
}

interface PricingTargetRow {
  id: string;
  entity_id: string;
  segment: string;
  product_type: string;
  currency: string;
  period: string;
  target_margin_bps: string | number | null;
  target_raroc_pct: string | number | null;
  target_volume_eur: string | number | null;
  pre_approved_rate_bps: string | number | null;
  hard_floor_rate_bps: string | number | null;
  active_from: string;
  active_to: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapPricingTargetRow(row: PricingTargetRow): PricingTarget {
  return {
    id:                   row.id,
    entityId:             row.entity_id,
    segment:              row.segment,
    productType:          row.product_type,
    currency:             row.currency,
    period:               row.period,
    targetMarginBps:      row.target_margin_bps      != null ? Number(row.target_margin_bps) : null,
    targetRarocPct:       row.target_raroc_pct       != null ? Number(row.target_raroc_pct) : null,
    targetVolumeEur:      row.target_volume_eur      != null ? Number(row.target_volume_eur) : null,
    preApprovedRateBps:   row.pre_approved_rate_bps  != null ? Number(row.pre_approved_rate_bps) : null,
    hardFloorRateBps:     row.hard_floor_rate_bps    != null ? Number(row.hard_floor_rate_bps) : null,
    activeFrom:           row.active_from,
    activeTo:             row.active_to,
    isActive:             row.is_active,
    createdBy:            row.created_by,
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  };
}
