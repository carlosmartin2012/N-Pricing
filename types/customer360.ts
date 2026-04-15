/**
 * Customer 360 — Phase 1 Sprint 1 types.
 *
 * Migrations: supabase/migrations/20260603000001_customer_360.sql
 *
 * The `ClientRelationship` aggregate is the new lens for pricing decisions:
 * positions, periodic metrics and applicable top-down targets in one shape.
 * Cross-bonus, pre-approved rates and customer-level analytics will all
 * consume this aggregate (Sprint 2).
 */

import type { ClientEntity } from '../types';

// ---------------------------------------------------------------------------
// client_positions
// ---------------------------------------------------------------------------

export type PositionCategory = 'Asset' | 'Liability' | 'Off-Balance' | 'Service';
export type PositionStatus = 'Active' | 'Matured' | 'Cancelled';

export interface ClientPosition {
  id: string;
  entityId: string;
  clientId: string;
  productId: string | null;
  productType: string;
  category: PositionCategory;
  dealId: string | null;

  amount: number;
  currency: string;
  marginBps: number | null;

  startDate: string;        // YYYY-MM-DD
  maturityDate: string | null;

  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// client_metrics_snapshots
// ---------------------------------------------------------------------------

export type ClientMetricsSource = 'computed' | 'imported' | 'manual';

export interface ClientMetricsSnapshot {
  id: string;
  entityId: string;
  clientId: string;
  period: string;          // '2026-Q2', '2026-04', etc.
  computedAt: string;

  nimBps: number | null;
  feesEur: number | null;
  evaEur: number | null;
  shareOfWalletPct: number | null;     // 0..1
  relationshipAgeYears: number | null;
  npsScore: number | null;             // -100..100

  activePositionCount: number;
  totalExposureEur: number;

  source: ClientMetricsSource;
  detail: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// pricing_targets
// ---------------------------------------------------------------------------

export interface PricingTarget {
  id: string;
  entityId: string;
  segment: string;
  productType: string;
  currency: string;
  period: string;

  targetMarginBps: number | null;
  targetRarocPct: number | null;
  targetVolumeEur: number | null;
  preApprovedRateBps: number | null;
  hardFloorRateBps: number | null;

  activeFrom: string;
  activeTo: string | null;
  isActive: boolean;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lookup key used when pricing a deal: matches by entity + segment + product
 * + currency on the active period. Multiple targets may match (e.g. a more
 * specific product overrides a generic one); the engine picks the most
 * specific.
 */
export interface PricingTargetLookup {
  entityId: string;
  segment: string;
  productType: string;
  currency: string;
  asOfDate: string;     // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Aggregate — the lens cross-bonus and pre-approved pricing will consume
// ---------------------------------------------------------------------------

export interface ClientRelationshipMetrics {
  latest: ClientMetricsSnapshot | null;
  history: ClientMetricsSnapshot[];
}

export interface ClientRelationship {
  client: ClientEntity;
  positions: ClientPosition[];
  metrics: ClientRelationshipMetrics;
  applicableTargets: PricingTarget[];

  /** Convenience derived fields — kept on the wire so clients don't recompute. */
  derived: {
    activePositionCount: number;
    totalExposureEur: number;
    productTypesHeld: string[];
    relationshipAgeYears: number | null;
    isMultiProduct: boolean;
  };
}
