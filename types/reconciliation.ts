/**
 * FTP Reconciliation types (Phase 6.9).
 *
 * Formalises the controller-grade view that replaces the old Accounting
 * Ledger. The FTP machinery double-entries every booked deal: a Business
 * Unit posts a BU-side journal (client loan ⇄ FTP funding) and Treasury
 * posts a mirror (fund BU loan ⇄ wholesale market). Both halves must
 * reconcile in amount, currency and rate per deal — if they don't, the
 * bank's FTP economic model has drifted from its book of record.
 *
 * The domain model here is deliberately *pair-based*: one `EntryPair` per
 * deal, with a discriminated `matchStatus` capturing the four canonical
 * outcomes. Consumers (aggregators, UI, CSV export) never handle a raw
 * BU or Treasury row — they always work with the pair and the status.
 */

export type MatchStatus =
  | 'matched'              // BU and Treasury agree on amount + rate + currency
  | 'amount_mismatch'      // currency ok, rate close, but amounts differ
  | 'rate_mismatch'        // amount ok, currency ok, rates differ > tolerance
  | 'currency_mismatch'    // currencies differ — hard error, treasury NFU
  | 'bu_only'              // BU posted, no Treasury mirror found
  | 'treasury_only'        // Treasury mirror exists, BU didn't post
  | 'unknown';             // reconciliation not yet computed

export interface LedgerSide {
  /** Deal ID the journal entry refers to. */
  dealId: string;
  amountEur: number;
  currency: string;
  /** FTP rate (%), treasury side, or client rate for BU side — whichever
   *  the caller is comparing. The engine treats them symmetrically. */
  ratePct: number;
  /** YYYY-MM-DD of the journal post date. */
  postedAt: string;
}

export interface EntryPair {
  dealId: string;
  clientId: string | null;
  clientName: string | null;
  businessUnit: string;
  productType: string;
  bu: LedgerSide | null;
  treasury: LedgerSide | null;
  matchStatus: MatchStatus;
  /** Absolute amount delta (EUR) when status is amount_mismatch; else 0. */
  amountDeltaEur: number;
  /** Absolute rate delta (percentage points) when status is rate_mismatch; else 0. */
  rateDeltaPct: number;
  /** Optional free-text hint produced by the engine to guide the controller. */
  hint: string | null;
}

export interface ReconciliationSummary {
  asOfPeriod: string;                    // e.g. '2026-04'
  computedAt: string;                    // ISO timestamp
  totalEntries: number;
  matched: number;
  unmatched: number;                     // sum of the 5 non-matched statuses
  unknown: number;
  amountMismatchEur: number;             // sum |amountDeltaEur| across mismatches
  maxSingleDeltaEur: number;             // biggest single delta for triage
  byStatus: Record<MatchStatus, number>; // count per status
}

export interface ReconciliationFilters {
  asOfPeriod?: string;
  status?: MatchStatus | 'all' | 'unmatched';
  businessUnit?: string;
  productType?: string;
  /** Minimum |amountDelta| in EUR — useful to hide the noise in a big book. */
  minAmountDeltaEur?: number;
}
