/**
 * Ola 9 Bloque B — HOST mainframe reconciliation matcher (puro).
 *
 * Cruza:
 *   - Las filas booked del core (CoreBankingBookedRow[] del HOST)
 *   - Lo que N-Pricing precia (PricingSnapshotPair[] del caller —
 *     {dealId, finalClientRateBps, snapshotHash, lastSnapshotAt})
 *
 * Devuelve para cada deal:
 *   - matched           — booked rate === pricing rate (dentro de tolerancia)
 *   - mismatch_rate     — booked rate ≠ pricing rate
 *   - mismatch_missing  — N-Pricing tiene snapshot, HOST no tiene fila
 *   - unknown_in_pricing — HOST tiene fila, N-Pricing no tiene snapshot
 *
 * Sin I/O, sin DB. El server adapter combina queries y delega aquí.
 */

import type { CoreBankingBookedRow } from '../../integrations/types';

export interface PricingSnapshotPair {
  dealId: string;
  pricingSnapshotHash: string;
  finalClientRateBps: number;
  lastSnapshotAt: string;
}

export interface ReconciliationOutcome {
  dealId: string;
  pricingSnapshotHash: string | null;
  ourRateBps: number | null;
  bookedRateBps: number | null;
  diffBps: number | null;
  bookedAt: string | null;
  status: 'matched' | 'mismatch_rate' | 'mismatch_missing' | 'unknown_in_pricing';
}

export interface ReconciliationSummary {
  total: number;
  matched: number;
  mismatchRate: number;
  mismatchMissing: number;
  unknownInPricing: number;
  maxAbsDiffBps: number;
  meanAbsDiffBps: number;
}

export interface MatcherOptions {
  /** Tolerancia en bps para considerar un match exacto. Default 0.5 bps
   *  (cubre rounding 1/2 punto base). */
  toleranceBps?: number;
}

const DEFAULT_TOLERANCE_BPS = 0.5;

/**
 * Genera la lista de outcomes cruzando los dos sets. Idempotente —
 * llamar varias veces con los mismos inputs produce los mismos outputs.
 */
export function reconcileBookedVsPricing(
  bookedRows: CoreBankingBookedRow[],
  pricingPairs: PricingSnapshotPair[],
  options: MatcherOptions = {},
): ReconciliationOutcome[] {
  const tolerance = options.toleranceBps ?? DEFAULT_TOLERANCE_BPS;

  const bookedById  = new Map(bookedRows.map((row) => [row.dealId, row]));

  const outcomes: ReconciliationOutcome[] = [];
  const seenDeals = new Set<string>();

  // Pricing → booked: matched / mismatch_rate / mismatch_missing
  for (const pair of pricingPairs) {
    seenDeals.add(pair.dealId);
    const booked = bookedById.get(pair.dealId);
    if (!booked) {
      outcomes.push({
        dealId:              pair.dealId,
        pricingSnapshotHash: pair.pricingSnapshotHash,
        ourRateBps:          pair.finalClientRateBps,
        bookedRateBps:       null,
        diffBps:             null,
        bookedAt:            null,
        status:              'mismatch_missing',
      });
      continue;
    }
    const diff = booked.bookedRateBps - pair.finalClientRateBps;
    const matched = Math.abs(diff) <= tolerance;
    outcomes.push({
      dealId:              pair.dealId,
      pricingSnapshotHash: pair.pricingSnapshotHash,
      ourRateBps:          pair.finalClientRateBps,
      bookedRateBps:       booked.bookedRateBps,
      diffBps:             diff,
      bookedAt:            booked.bookedAt,
      status:              matched ? 'matched' : 'mismatch_rate',
    });
  }

  // Booked → pricing: unknown_in_pricing (booked en HOST sin snapshot)
  for (const booked of bookedRows) {
    if (seenDeals.has(booked.dealId)) continue;
    outcomes.push({
      dealId:              booked.dealId,
      pricingSnapshotHash: null,
      ourRateBps:          null,
      bookedRateBps:       booked.bookedRateBps,
      diffBps:             null,
      bookedAt:            booked.bookedAt,
      status:              'unknown_in_pricing',
    });
  }
  return outcomes;
}

/**
 * Resumen agregado para dashboards. `maxAbsDiffBps` y `meanAbsDiffBps`
 * sólo cuentan outcomes con diffBps definido (matched + mismatch_rate).
 */
export function summarizeReconciliation(outcomes: ReconciliationOutcome[]): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    total:            outcomes.length,
    matched:          0,
    mismatchRate:     0,
    mismatchMissing:  0,
    unknownInPricing: 0,
    maxAbsDiffBps:    0,
    meanAbsDiffBps:   0,
  };
  let absDiffSum = 0;
  let absDiffCount = 0;
  for (const o of outcomes) {
    switch (o.status) {
      case 'matched':            summary.matched++;          break;
      case 'mismatch_rate':      summary.mismatchRate++;     break;
      case 'mismatch_missing':   summary.mismatchMissing++;  break;
      case 'unknown_in_pricing': summary.unknownInPricing++; break;
    }
    if (o.diffBps !== null) {
      const abs = Math.abs(o.diffBps);
      summary.maxAbsDiffBps = Math.max(summary.maxAbsDiffBps, abs);
      absDiffSum += abs;
      absDiffCount++;
    }
  }
  summary.meanAbsDiffBps = absDiffCount > 0 ? absDiffSum / absDiffCount : 0;
  return summary;
}
