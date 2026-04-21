/**
 * Next-Best-Action ranker (Phase 6).
 *
 * Takes a ClientRelationship + LtvComputation + a catalogue of candidate
 * products and returns top-N recommendations ranked by expected ΔCLV.
 *
 * Hybrid approach:
 *   - Rules produce the *candidate* list and the reason codes (the "why")
 *   - Marginal ΔCLV ranks the list (the "how much")
 *
 * That way a client never sees an ML-ranked suggestion without a human-
 * readable justification, which is what MRM / auditors ask for.
 */

import type { ClientRelationship } from '../../types/customer360';
import type {
  DealCandidate,
  LtvAssumptions,
  LtvComputation,
  NbaRecommendation,
  NbaReasonCode,
} from '../../types/clv';
import { computeMarginalLtvImpact } from './marginalLtvImpact';

export interface NbaProductCatalogueEntry {
  productType: string;
  defaultTenorYears: number;
  defaultRateBps: number;
  defaultMarginBps: number;
  capitalPct: number;                  // fraction of notional → capital
  typicalTicketEur: number;
  /** Products considered "core" for this segment — drive product_gap_core reason */
  isCore?: boolean;
  rarocAnnual?: number;
}

export interface NbaInput {
  relationship: ClientRelationship;
  ltv: LtvComputation;
  assumptions: LtvAssumptions;
  catalogue: NbaProductCatalogueEntry[];
  topN?: number;
  /** Optional override — otherwise derived from positions + metrics */
  openSignals?: {
    renewalWindowOpen?: boolean;
    churnSignalDetected?: boolean;
    nimBelowTarget?: boolean;
  };
}

/**
 * Detects business signals from the relationship alone. Deterministic; no ML.
 */
function detectSignals(rel: ClientRelationship) {
  const latest = rel.metrics.latest;
  const renewalWindowOpen = rel.positions.some((p) => {
    if (p.status !== 'Active' || !p.maturityDate) return false;
    const days = (Date.parse(`${p.maturityDate}T00:00:00Z`) - Date.now()) / 86_400_000;
    return days > 0 && days <= 180;    // matures within 6 months
  });
  const nimBelowTarget = (latest?.nimBps ?? 0) > 0
    && rel.applicableTargets.some((t) =>
      t.targetMarginBps != null
      && latest?.nimBps != null
      && latest.nimBps < t.targetMarginBps,
    );
  const shareLow = (latest?.shareOfWalletPct ?? 0.5) < 0.4;
  return { renewalWindowOpen, nimBelowTarget, shareLow };
}

function buildReasonCodes(
  rel: ClientRelationship,
  candidate: NbaProductCatalogueEntry,
  signals: ReturnType<typeof detectSignals>,
): NbaReasonCode[] {
  const codes: NbaReasonCode[] = [];
  if (!rel.derived.productTypesHeld.includes(candidate.productType)) {
    if (candidate.isCore) codes.push('product_gap_core');
    else codes.push('cross_sell_cohort_signal');
  }
  if (signals.renewalWindowOpen) codes.push('renewal_window_open');
  if (signals.nimBelowTarget) codes.push('nim_below_target');
  if (signals.shareLow) codes.push('share_of_wallet_low');
  return codes;
}

function buildCandidate(entry: NbaProductCatalogueEntry): DealCandidate {
  return {
    productType: entry.productType,
    currency: 'EUR',
    amountEur: entry.typicalTicketEur,
    tenorYears: entry.defaultTenorYears,
    rateBps: entry.defaultRateBps,
    marginBps: entry.defaultMarginBps,
    capitalEur: entry.typicalTicketEur * entry.capitalPct,
    rarocAnnual: entry.rarocAnnual,
  };
}

function confidenceFrom(impactDeltaPct: number, reasonCount: number): number {
  // Confidence scales with magnitude of ΔCLV% and number of reason codes.
  // Bounded 0..1 with plateau so an absurd ΔCLV doesn't dominate.
  const magnitude = Math.min(1, Math.abs(impactDeltaPct) * 4);
  const reasonBoost = Math.min(1, reasonCount * 0.15);
  return Math.min(1, 0.4 + magnitude * 0.4 + reasonBoost * 0.2);
}

export function rankNextBestActions(
  input: NbaInput,
): Array<Pick<NbaRecommendation,
  'recommendedProduct' | 'recommendedRateBps' | 'recommendedVolumeEur' |
  'recommendedCurrency' | 'expectedClvDeltaEur' | 'confidence' |
  'reasonCodes' | 'rationale' | 'source'
>> {
  const { relationship: rel, ltv, assumptions, catalogue, topN = 3 } = input;
  const signals = { ...detectSignals(rel), ...(input.openSignals ?? {}) };

  const scored = catalogue.map((entry) => {
    const candidate = buildCandidate(entry);
    const impact = computeMarginalLtvImpact(rel, candidate, ltv, assumptions);
    const reasonCodes = buildReasonCodes(rel, entry, signals);
    const rationale = rationaleFor(entry, impact, reasonCodes);
    return {
      recommendedProduct: entry.productType,
      recommendedRateBps: entry.defaultRateBps,
      recommendedVolumeEur: entry.typicalTicketEur,
      recommendedCurrency: 'EUR',
      expectedClvDeltaEur: impact.deltaClvEur,
      confidence: confidenceFrom(impact.deltaClvPct, reasonCodes.length),
      reasonCodes,
      rationale,
      source: 'engine' as const,
    };
  });

  return scored
    .filter((s) => s.expectedClvDeltaEur > 0)
    .sort((a, b) => b.expectedClvDeltaEur - a.expectedClvDeltaEur)
    .slice(0, topN);
}

function rationaleFor(
  entry: NbaProductCatalogueEntry,
  impact: ReturnType<typeof computeMarginalLtvImpact>,
  reasons: NbaReasonCode[],
): string {
  const drivers: string[] = [];
  const pct = (impact.deltaClvPct * 100).toFixed(1);
  drivers.push(`${entry.productType} ticket €${formatK(entry.typicalTicketEur)} → ΔCLV ${pct}%`);
  if (reasons.includes('renewal_window_open')) drivers.push('renewal window open');
  if (reasons.includes('nim_below_target')) drivers.push('lifts NIM toward target');
  if (reasons.includes('product_gap_core')) drivers.push('core product gap');
  if (reasons.includes('share_of_wallet_low')) drivers.push('share-of-wallet expansion');
  return drivers.join(' · ');
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

/**
 * Reference catalogue for demos / tests. Real deployments swap this with
 * a tenant-specific product master.
 */
export const REFERENCE_CATALOGUE: NbaProductCatalogueEntry[] = [
  { productType: 'Mortgage',          defaultTenorYears: 25, defaultRateBps: 310, defaultMarginBps: 150, capitalPct: 0.035, typicalTicketEur: 250_000,  isCore: true,  rarocAnnual: 0.14 },
  { productType: 'Corporate_Loan',    defaultTenorYears: 5,  defaultRateBps: 420, defaultMarginBps: 220, capitalPct: 0.08,  typicalTicketEur: 2_000_000, isCore: true,  rarocAnnual: 0.16 },
  { productType: 'Cash_Management',   defaultTenorYears: 1,  defaultRateBps: 80,  defaultMarginBps: 60,  capitalPct: 0.005, typicalTicketEur: 500_000,                  rarocAnnual: 0.22 },
  { productType: 'FX_Hedging',        defaultTenorYears: 2,  defaultRateBps: 0,   defaultMarginBps: 40,  capitalPct: 0.01,  typicalTicketEur: 1_500_000,                rarocAnnual: 0.25 },
  { productType: 'Leasing',           defaultTenorYears: 5,  defaultRateBps: 390, defaultMarginBps: 180, capitalPct: 0.06,  typicalTicketEur: 400_000,                  rarocAnnual: 0.13 },
  { productType: 'Trade_Finance',     defaultTenorYears: 1,  defaultRateBps: 300, defaultMarginBps: 160, capitalPct: 0.04,  typicalTicketEur: 800_000,                  rarocAnnual: 0.18 },
  { productType: 'ESG_Green_Loan',    defaultTenorYears: 7,  defaultRateBps: 360, defaultMarginBps: 200, capitalPct: 0.07,  typicalTicketEur: 3_000_000,                rarocAnnual: 0.15 },
];
