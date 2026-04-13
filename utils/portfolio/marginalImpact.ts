/**
 * Marginal portfolio impact — pivot §Bloque I.
 *
 * For a proposed deal, computes how the portfolio's aggregate metrics
 * would change if the deal were booked:
 *   - ΔRWA (risk-weighted assets)
 *   - ΔLCR outflow contribution
 *   - ΔNSFR floor contribution
 *   - ΔHerfindahl concentration (client / sector proxy)
 *
 * Pure function — no external data fetching. Caller provides the current
 * portfolio deals list.
 */

import type { Transaction } from '../../types';

export interface PortfolioSnapshot {
  totalRwa: number;
  totalLcrOutflow: number;
  totalNsfrFloor: number;
  herfindahlByClient: number;        // sum of squared client-exposure shares, 0-1
}

export interface MarginalImpact {
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
  delta: {
    rwa: number;
    lcrOutflow: number;
    nsfrFloor: number;
    herfindahlByClient: number;       // positive = concentration worsens
  };
  isConcentrationIncreasing: boolean;
  isRwaIncreasing: boolean;
}

const dealRwa = (deal: Transaction): number => deal.amount * (deal.riskWeight ?? 0);

const dealLcrOutflow = (deal: Transaction): number => {
  const pct = deal.lcrOutflowPct ?? 0;
  return deal.amount * (pct / 100);
};

// Rough NSFR floor: RSF = asset amount × factor. Factor proxy from tenor.
const dealNsfrFloor = (deal: Transaction): number => {
  const factor = deal.durationMonths >= 12 ? 0.65 : deal.durationMonths >= 6 ? 0.5 : 0.15;
  return deal.amount * factor;
};

const buildSnapshot = (deals: Transaction[]): PortfolioSnapshot => {
  let totalRwa = 0;
  let totalLcrOutflow = 0;
  let totalNsfrFloor = 0;

  const byClient = new Map<string, number>();
  let totalExposure = 0;

  for (const deal of deals) {
    totalRwa += dealRwa(deal);
    totalLcrOutflow += dealLcrOutflow(deal);
    totalNsfrFloor += dealNsfrFloor(deal);

    const current = byClient.get(deal.clientId) ?? 0;
    byClient.set(deal.clientId, current + deal.amount);
    totalExposure += deal.amount;
  }

  let herf = 0;
  if (totalExposure > 0) {
    for (const exposure of byClient.values()) {
      const share = exposure / totalExposure;
      herf += share * share;
    }
  }

  return {
    totalRwa,
    totalLcrOutflow,
    totalNsfrFloor,
    herfindahlByClient: herf,
  };
};

/**
 * Compute the marginal effect of booking `candidate` on top of `currentDeals`.
 */
export const computeMarginalImpact = (
  candidate: Transaction,
  currentDeals: Transaction[],
): MarginalImpact => {
  // Semantics:
  //  - before = portfolio as it exists today (including the candidate when
  //    the candidate is an edit of an existing deal — same id).
  //  - after  = portfolio with the candidate replaced (edit) or appended (new).
  // Delta therefore reflects the "what changes if I apply this edit/booking".
  const before = buildSnapshot(currentDeals);
  const withoutCurrent = candidate.id
    ? currentDeals.filter((d) => d.id !== candidate.id)
    : currentDeals;
  const after = buildSnapshot([...withoutCurrent, candidate]);

  const delta = {
    rwa: after.totalRwa - before.totalRwa,
    lcrOutflow: after.totalLcrOutflow - before.totalLcrOutflow,
    nsfrFloor: after.totalNsfrFloor - before.totalNsfrFloor,
    herfindahlByClient: after.herfindahlByClient - before.herfindahlByClient,
  };

  return {
    before,
    after,
    delta,
    isConcentrationIncreasing: delta.herfindahlByClient > 0,
    isRwaIncreasing: delta.rwa > 0,
  };
};
