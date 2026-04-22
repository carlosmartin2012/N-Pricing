/**
 * Pure FTP reconciliation engine.
 *
 * Given two keyed lists — one per ledger side — produce a list of
 * EntryPair with the appropriate MatchStatus. No I/O, no DB, no
 * randomness; same inputs → same output (tests pin exact bytes).
 *
 * Matching algorithm:
 *   1. Key by dealId. Rows without a deal id are dropped (they can't
 *      be reconciled anyway — FTP requires a deal identity).
 *   2. If both sides present → compare.
 *      - currency differs → 'currency_mismatch' (hard; never auto-OK).
 *      - |amount delta| > tolerance → 'amount_mismatch'.
 *      - |rate delta| > tolerance → 'rate_mismatch'.
 *      - otherwise → 'matched'.
 *   3. If only one side present → 'bu_only' or 'treasury_only'.
 *
 * Tolerances are intentionally strict (1 EUR on amount, 1 bp on rate).
 * A controller wants to see *every* drift; the UI can filter loose
 * matches out of view but the engine should not silently hide them.
 */

import type {
  EntryPair,
  LedgerSide,
  MatchStatus,
  ReconciliationSummary,
} from '../../types/reconciliation';

export interface MatchOptions {
  amountToleranceEur?: number;   // default 1
  ratePctTolerance?: number;     // default 0.01 (≈ 1 bp)
}

export interface UnmatchedInput {
  dealId: string;
  clientId?: string | null;
  clientName?: string | null;
  businessUnit: string;
  productType: string;
  bu?: LedgerSide | null;
  treasury?: LedgerSide | null;
}

const DEFAULTS: Required<MatchOptions> = {
  amountToleranceEur: 1,
  ratePctTolerance: 0.01,
};

/**
 * Classify a single (bu, treasury) pair. Extracted so tests can drive
 * boundary cases without building the full aggregate list.
 */
export function classifyPair(
  bu: LedgerSide | null,
  treasury: LedgerSide | null,
  opts: MatchOptions = {},
): { status: MatchStatus; amountDeltaEur: number; rateDeltaPct: number; hint: string | null } {
  const { amountToleranceEur, ratePctTolerance } = { ...DEFAULTS, ...opts };

  if (!bu && !treasury) {
    return { status: 'unknown', amountDeltaEur: 0, rateDeltaPct: 0, hint: 'No entries posted' };
  }
  if (bu && !treasury) {
    return {
      status: 'bu_only',
      amountDeltaEur: 0,
      rateDeltaPct: 0,
      hint: 'Treasury mirror missing — open Treasury Ops',
    };
  }
  if (!bu && treasury) {
    return {
      status: 'treasury_only',
      amountDeltaEur: 0,
      rateDeltaPct: 0,
      hint: 'BU did not post — check booking workflow',
    };
  }

  // Both present (TS still widens — narrow via non-null assertion).
  const b = bu!;
  const tr = treasury!;

  if (b.currency !== tr.currency) {
    return {
      status: 'currency_mismatch',
      amountDeltaEur: 0,
      rateDeltaPct: 0,
      hint: `Currencies differ: BU=${b.currency}, Treasury=${tr.currency}`,
    };
  }

  const amountDelta = Math.abs(b.amountEur - tr.amountEur);
  if (amountDelta > amountToleranceEur) {
    return {
      status: 'amount_mismatch',
      amountDeltaEur: amountDelta,
      rateDeltaPct: 0,
      hint: `Amount delta €${amountDelta.toFixed(2)} — expected tolerance €${amountToleranceEur}`,
    };
  }

  const rateDelta = Math.abs(b.ratePct - tr.ratePct);
  if (rateDelta > ratePctTolerance) {
    return {
      status: 'rate_mismatch',
      amountDeltaEur: 0,
      rateDeltaPct: rateDelta,
      hint: `Rate delta ${rateDelta.toFixed(3)}pp — expected tolerance ${ratePctTolerance}pp`,
    };
  }

  return { status: 'matched', amountDeltaEur: 0, rateDeltaPct: 0, hint: null };
}

/**
 * Build EntryPair list from a single flattened input list. The caller is
 * responsible for bringing bu/treasury LedgerSides already attached to
 * each deal record — typically done via a SQL JOIN at the API layer.
 */
export function matchEntries(
  inputs: UnmatchedInput[],
  opts: MatchOptions = {},
): EntryPair[] {
  return inputs
    .filter((r) => Boolean(r.dealId))
    .map((r) => {
      const bu = r.bu ?? null;
      const treasury = r.treasury ?? null;
      const { status, amountDeltaEur, rateDeltaPct, hint } = classifyPair(bu, treasury, opts);
      return {
        dealId: r.dealId,
        clientId: r.clientId ?? null,
        clientName: r.clientName ?? null,
        businessUnit: r.businessUnit,
        productType: r.productType,
        bu,
        treasury,
        matchStatus: status,
        amountDeltaEur,
        rateDeltaPct,
        hint,
      };
    });
}

/**
 * Aggregate a list of EntryPair into a summary. Emits the counts the
 * /reconciliation headline KPIs consume.
 */
export function summariseEntries(
  pairs: EntryPair[],
  asOfPeriod: string,
  computedAt: string = new Date().toISOString(),
): ReconciliationSummary {
  const byStatus: Record<MatchStatus, number> = {
    matched: 0, amount_mismatch: 0, rate_mismatch: 0, currency_mismatch: 0,
    bu_only: 0, treasury_only: 0, unknown: 0,
  };
  let amountMismatchEur = 0;
  let maxSingleDeltaEur = 0;
  for (const p of pairs) {
    byStatus[p.matchStatus] += 1;
    if (p.matchStatus === 'amount_mismatch') {
      amountMismatchEur += p.amountDeltaEur;
      if (p.amountDeltaEur > maxSingleDeltaEur) {
        maxSingleDeltaEur = p.amountDeltaEur;
      }
    }
  }
  const matched = byStatus.matched;
  const unknown = byStatus.unknown;
  const unmatched = pairs.length - matched - unknown;
  return {
    asOfPeriod,
    computedAt,
    totalEntries: pairs.length,
    matched,
    unmatched,
    unknown,
    amountMismatchEur: Number(amountMismatchEur.toFixed(2)),
    maxSingleDeltaEur: Number(maxSingleDeltaEur.toFixed(2)),
    byStatus,
  };
}
