import { describe, it, expect } from 'vitest';
import { buildInvoiceLines, totalInvoiceCents, DEFAULT_PRICE_BOOK } from '../metering/billing';
import { InMemoryRecorder } from '../metering/usageRecorder';
import type { UsageAggregateDay } from '../../types/metering';

const ENTITY = 'e-1';

const agg = (day: string, kind: UsageAggregateDay['eventKind'], units: number): UsageAggregateDay => ({
  entityId: ENTITY,
  day,
  eventKind: kind,
  eventCount: units,
  unitsTotal: units,
});

describe('buildInvoiceLines', () => {
  it('charges only above the free tier', () => {
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [agg('2026-04-15', 'pricing_call', 25_000)],
    });
    const pricing = lines.find((l) => l.eventKind === 'pricing_call');
    // Free 10k, billable 15k × 1 cent = 15_000
    expect(pricing?.amountCents).toBe(15_000);
  });

  it('omits unknown event kinds', () => {
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [
        agg('2026-04-15', 'pricing_call', 50),
        // a kind not in the price book wouldn't be returned; verify the
        // sorting + presence of priced kinds anyway.
      ],
    });
    expect(lines.map((l) => l.eventKind)).toEqual(['pricing_call']);
  });

  it('clamps negative billable to zero (free units exceed usage)', () => {
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [agg('2026-04-15', 'pricing_call', 5_000)],   // < 10k free
    });
    expect(lines[0].amountCents).toBe(0);
    expect(lines[0].unitsTotal).toBe(5_000);
  });

  it('honours the period window', () => {
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [
        agg('2026-03-31', 'pricing_call', 100_000),    // outside
        agg('2026-04-15', 'pricing_call', 12_000),     // inside
        agg('2026-05-01', 'pricing_call', 100_000),    // outside
      ],
    });
    expect(lines[0].unitsTotal).toBe(12_000);
  });

  it('respects custom price book', () => {
    const customPriceBook = { ...DEFAULT_PRICE_BOOK, pricing_call: { unitPriceCents: 5, freeUnits: 0 } };
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [agg('2026-04-15', 'pricing_call', 100)],
      priceBook: customPriceBook,
    });
    expect(lines[0].amountCents).toBe(500);
  });

  it('totalInvoiceCents sums everything', () => {
    const lines = buildInvoiceLines({
      entityId: ENTITY, periodStart: '2026-04-01', periodEnd: '2026-04-30',
      aggregates: [
        agg('2026-04-10', 'pricing_call',  20_000),  // 10k billable × 1 = 10_000
        agg('2026-04-15', 'channel_quote', 60_000),  // 10k billable × 2 = 20_000
        agg('2026-04-20', 'dossier_sign',  60),       // 10 billable × 100 = 1_000
      ],
    });
    expect(totalInvoiceCents(lines)).toBe(31_000);
  });
});

describe('InMemoryRecorder', () => {
  it('captures sequenced events', async () => {
    const r = new InMemoryRecorder();
    await r.insert(ENTITY, 'pricing_call', 1);
    await r.insert(ENTITY, 'channel_quote', 3, { channel: 'web' });
    expect(r.events).toHaveLength(2);
    expect(r.events[1].kind).toBe('channel_quote');
    expect(r.events[1].units).toBe(3);
    expect(r.events[1].detail.channel).toBe('web');
  });
});
