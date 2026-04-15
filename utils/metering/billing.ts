import type {
  UsageAggregateDay,
  UsageEventKind,
  UsageInvoiceLine,
} from '../../types/metering';

/**
 * Pure billing utilities. Given a price book (units → cents) and the
 * per-day usage aggregates for a period, produce the invoice lines.
 *
 * Decisions:
 *   - Currency-agnostic: amounts in integer cents; UI formats to entity currency.
 *   - Free tier expressed as `freeUnits` per kind; usage above is charged.
 *   - Bundles (e.g. first 10k pricing calls free, next 90k at €0.001) are
 *     out of scope for Sprint 1; the linear price model covers MVP.
 */

export interface PriceBookEntry {
  unitPriceCents: number;
  freeUnits?: number;
}

export type PriceBook = Partial<Record<UsageEventKind, PriceBookEntry>>;

export const DEFAULT_PRICE_BOOK: PriceBook = {
  pricing_call:           { unitPriceCents: 1,    freeUnits: 10_000 },
  snapshot_write:         { unitPriceCents: 0,    freeUnits: 0 },        // free, audit baseline
  channel_quote:          { unitPriceCents: 2,    freeUnits: 50_000 },
  dossier_sign:           { unitPriceCents: 100,  freeUnits: 50 },
  batch_reprice:          { unitPriceCents: 1,    freeUnits: 100_000 },
  elasticity_recalibrate: { unitPriceCents: 0,    freeUnits: 0 },        // included
  raroc_realize:          { unitPriceCents: 0,    freeUnits: 0 },        // included
};

interface BuildInvoiceParams {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  aggregates: UsageAggregateDay[];
  priceBook?: PriceBook;
}

export function buildInvoiceLines({
  entityId, periodStart, periodEnd, aggregates, priceBook = DEFAULT_PRICE_BOOK,
}: BuildInvoiceParams): UsageInvoiceLine[] {
  // Group totals by event_kind for the period.
  const totals = new Map<UsageEventKind, number>();
  for (const a of aggregates) {
    if (a.entityId !== entityId) continue;
    if (a.day < periodStart || a.day > periodEnd) continue;
    totals.set(a.eventKind, (totals.get(a.eventKind) ?? 0) + a.unitsTotal);
  }

  const lines: UsageInvoiceLine[] = [];
  for (const [kind, units] of totals.entries()) {
    const entry = priceBook[kind];
    if (!entry) continue;
    const billable = Math.max(0, units - (entry.freeUnits ?? 0));
    lines.push({
      entityId,
      periodStart,
      periodEnd,
      eventKind: kind,
      unitsTotal: units,
      unitPriceCents: entry.unitPriceCents,
      amountCents: billable * entry.unitPriceCents,
    });
  }
  return lines.sort((a, b) => a.eventKind.localeCompare(b.eventKind));
}

export function totalInvoiceCents(lines: UsageInvoiceLine[]): number {
  return lines.reduce((s, l) => s + l.amountCents, 0);
}
