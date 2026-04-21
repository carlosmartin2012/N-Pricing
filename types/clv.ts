/**
 * CLV + 360º temporal types (Phase 6).
 *
 * Migrations: supabase/migrations/20260608000001_clv_360.sql
 *
 * Extends Customer 360 with the forward-looking and temporal layers:
 *   - ClientEvent            → unified timeline
 *   - ClientLtvSnapshot      → projected CLV (point + band + hazard)
 *   - NbaRecommendation      → next-best-action ranked by expected ΔCLV
 *
 * The CLV engine (utils/clv/) consumes ClientRelationship (Phase 1) plus a
 * LtvAssumptions bundle and emits a snapshot. All functions are pure.
 */

// ---------------------------------------------------------------------------
// client_events
// ---------------------------------------------------------------------------

export type ClientEventType =
  | 'onboarding'
  | 'deal_booked'
  | 'deal_cancelled'
  | 'crosssell_attempt'
  | 'crosssell_won'
  | 'claim'
  | 'churn_signal'
  | 'contact'
  | 'price_review'
  | 'committee_review'
  | 'nba_generated'
  | 'nba_consumed';

export type ClientEventSource = 'manual' | 'pricing' | 'crm' | 'ops' | 'ml' | 'adapter';

export interface ClientEvent {
  id: string;
  entityId: string;
  clientId: string;

  eventType: ClientEventType;
  eventTs: string;                // ISO
  source: ClientEventSource;

  dealId: string | null;
  positionId: string | null;

  amountEur: number | null;
  payload: Record<string, unknown>;

  createdBy: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// client_ltv_snapshots
// ---------------------------------------------------------------------------

export interface LtvBreakdown {
  niiEur: number;
  crosssellEur: number;
  feesEur: number;
  churnCostEur: number;
  perPosition: Array<{
    positionId: string;
    productType: string;
    contributionEur: number;
  }>;
}

export interface LtvAssumptions {
  asOfDate: string;                 // YYYY-MM-DD
  horizonYears: number;             // default 10
  discountRate: number;             // e.g. 0.08
  churnHazardAnnual: number;        // λ
  renewalProb: number;              // 0..1
  crosssellProbPerYear: number;     // 0..1
  capitalAllocationRate: number;    // fraction of exposure requiring capital
  rarocByProduct: Record<string, number>;  // expected RAROC per product, annual
  shareOfWalletEst: number;         // 0..1
  churnCostPerEur: number;          // cost of losing 1€ of exposure
}

export interface ClientLtvSnapshot {
  id: string;
  entityId: string;
  clientId: string;

  asOfDate: string;
  horizonYears: number;
  discountRate: number;

  clvPointEur: number;
  clvP5Eur: number | null;
  clvP95Eur: number | null;

  churnHazardAnnual: number | null;
  renewalProb: number | null;
  shareOfWalletEst: number | null;
  shareOfWalletGap: number | null;

  breakdown: LtvBreakdown;
  assumptions: LtvAssumptions;
  assumptionsHash: string;
  engineVersion: string;

  computedAt: string;
  computedBy: string | null;
}

// ---------------------------------------------------------------------------
// client_nba_recommendations
// ---------------------------------------------------------------------------

export type NbaSource = 'engine' | 'ml' | 'manual' | 'crm';

export type NbaReasonCode =
  | 'share_of_wallet_low'
  | 'renewal_window_open'
  | 'nim_below_target'
  | 'product_gap_core'
  | 'cross_sell_cohort_signal'
  | 'churn_signal_detected'
  | 'price_above_market'
  | 'capacity_underused'
  | 'regulatory_incentive_available';

export interface NbaRecommendation {
  id: string;
  entityId: string;
  clientId: string;

  recommendedProduct: string;
  recommendedRateBps: number | null;
  recommendedVolumeEur: number | null;
  recommendedCurrency: string;

  expectedClvDeltaEur: number;
  confidence: number;               // 0..1

  reasonCodes: NbaReasonCode[];
  rationale: string | null;
  source: NbaSource;

  generatedAt: string;
  consumedAt: string | null;
  consumedBy: string | null;
}

/**
 * Firmwide Pipeline row — a NbaRecommendation enriched with the client's
 * name / segment / rating (server-side JOIN). Shape expected by the
 * `/pipeline` view; not persisted anywhere (derived projection).
 */
export interface PipelineNbaRow extends NbaRecommendation {
  clientName: string;
  clientSegment: string | null;
  clientRating: string | null;
}

export type PipelineStatusFilter = 'open' | 'consumed' | 'all';

// ---------------------------------------------------------------------------
// Engine inputs / outputs — no I/O
// ---------------------------------------------------------------------------

/**
 * Output of the pure CLV engine. Same shape persisted as
 * ClientLtvSnapshot (plus id / computedAt once written).
 */
export interface LtvComputation {
  asOfDate: string;
  horizonYears: number;
  discountRate: number;

  clvPointEur: number;
  clvP5Eur: number;
  clvP95Eur: number;

  churnHazardAnnual: number;
  renewalProb: number;
  shareOfWalletEst: number;
  shareOfWalletGap: number;

  breakdown: LtvBreakdown;
  assumptions: LtvAssumptions;
  assumptionsHash: string;
}

/**
 * The deal candidate consumed by marginalLtvImpact. Minimal shape on purpose:
 * the pricer can reason about a target price *before* the pricing engine has
 * produced a full RAROC — we just need margin and capital to project cashflows.
 */
export interface DealCandidate {
  productType: string;
  currency: string;
  amountEur: number;
  tenorYears: number;
  rateBps: number;                  // client rate in bps
  marginBps: number;                // margin over FTP (expected NII proxy)
  capitalEur: number;               // capital allocated to this deal
  rarocAnnual?: number;             // if pricing engine already computed it
}

export interface MarginalLtvImpact {
  clvBeforeEur: number;
  clvAfterEur: number;
  deltaClvEur: number;
  deltaClvPct: number;
  breakdown: {
    directNiiEur: number;
    crosssellUpliftEur: number;
    churnReductionEur: number;
    capitalOpportunityEur: number;
  };
}
