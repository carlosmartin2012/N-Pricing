import { describe, it, expect } from 'vitest';
import {
  reconcileBookedVsPricing,
  summarizeReconciliation,
  type PricingSnapshotPair,
} from '../coreBanking/hostReconciliationMatcher';
import type { CoreBankingBookedRow } from '../../integrations/types';

const booked = (over: Partial<CoreBankingBookedRow>): CoreBankingBookedRow => ({
  dealId:         'd1',
  externalDealId: null,
  clientId:       'c1',
  productType:    'loan',
  bookedRateBps:  485,
  amountEur:      100_000,
  currency:       'EUR',
  bookedAt:       '2026-04-30T10:00:00Z',
  status:         'booked',
  ...over,
});

const pair = (over: Partial<PricingSnapshotPair>): PricingSnapshotPair => ({
  dealId:              'd1',
  pricingSnapshotHash: 'h1',
  finalClientRateBps:  485,
  lastSnapshotAt:      '2026-04-30T09:00:00Z',
  ...over,
});

describe('hostReconciliationMatcher · reconcileBookedVsPricing', () => {
  it('matched: rates iguales dentro de tolerancia', () => {
    const out = reconcileBookedVsPricing([booked({})], [pair({})]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('matched');
    expect(out[0].diffBps).toBe(0);
  });

  it('matched: rates dentro de tolerancia (default 0.5 bps)', () => {
    const out = reconcileBookedVsPricing(
      [booked({ bookedRateBps: 485.3 })],
      [pair({ finalClientRateBps: 485 })],
    );
    expect(out[0].status).toBe('matched');
  });

  it('mismatch_rate: diff > tolerancia', () => {
    const out = reconcileBookedVsPricing(
      [booked({ bookedRateBps: 490 })],
      [pair({ finalClientRateBps: 485 })],
    );
    expect(out[0].status).toBe('mismatch_rate');
    expect(out[0].diffBps).toBe(5);
  });

  it('mismatch_missing: pricing tiene snapshot, HOST no tiene fila', () => {
    const out = reconcileBookedVsPricing([], [pair({ dealId: 'd-missing' })]);
    expect(out[0].status).toBe('mismatch_missing');
    expect(out[0].bookedRateBps).toBeNull();
    expect(out[0].diffBps).toBeNull();
  });

  it('unknown_in_pricing: HOST tiene fila, pricing no tiene snapshot', () => {
    const out = reconcileBookedVsPricing(
      [booked({ dealId: 'd-orphan' })],
      [],
    );
    expect(out[0].status).toBe('unknown_in_pricing');
    expect(out[0].ourRateBps).toBeNull();
  });

  it('mix: matched + mismatch_rate + mismatch_missing + unknown_in_pricing', () => {
    const bookedRows = [
      booked({ dealId: 'm1', bookedRateBps: 485 }),
      booked({ dealId: 'm2', bookedRateBps: 490 }),
      booked({ dealId: 'orphan', bookedRateBps: 470 }),
    ];
    const pairs = [
      pair({ dealId: 'm1', finalClientRateBps: 485 }),
      pair({ dealId: 'm2', finalClientRateBps: 485 }),
      pair({ dealId: 'missing', finalClientRateBps: 480 }),
    ];
    const out = reconcileBookedVsPricing(bookedRows, pairs);
    const byStatus = out.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus.matched).toBe(1);
    expect(byStatus.mismatch_rate).toBe(1);
    expect(byStatus.mismatch_missing).toBe(1);
    expect(byStatus.unknown_in_pricing).toBe(1);
  });

  it('respeta toleranceBps custom', () => {
    const out = reconcileBookedVsPricing(
      [booked({ bookedRateBps: 487 })],
      [pair({ finalClientRateBps: 485 })],
      { toleranceBps: 3 },
    );
    expect(out[0].status).toBe('matched');
  });
});

describe('hostReconciliationMatcher · summarizeReconciliation', () => {
  it('cuenta correctamente y calcula maxAbs/meanAbs sólo sobre matched+mismatch_rate', () => {
    const out = reconcileBookedVsPricing(
      [
        booked({ dealId: 'a', bookedRateBps: 485 }),
        booked({ dealId: 'b', bookedRateBps: 490 }),
        booked({ dealId: 'c', bookedRateBps: 470 }),
      ],
      [
        pair({ dealId: 'a', finalClientRateBps: 485 }),
        pair({ dealId: 'b', finalClientRateBps: 485 }),
        pair({ dealId: 'd', finalClientRateBps: 480 }),
      ],
    );
    const summary = summarizeReconciliation(out);
    expect(summary.total).toBe(4);
    expect(summary.matched).toBe(1);
    expect(summary.mismatchRate).toBe(1);
    expect(summary.mismatchMissing).toBe(1);
    expect(summary.unknownInPricing).toBe(1);
    expect(summary.maxAbsDiffBps).toBe(5);
    expect(summary.meanAbsDiffBps).toBeCloseTo(2.5, 4);  // (0 + 5) / 2
  });

  it('lista vacía → todo 0', () => {
    const s = summarizeReconciliation([]);
    expect(s.total).toBe(0);
    expect(s.maxAbsDiffBps).toBe(0);
    expect(s.meanAbsDiffBps).toBe(0);
  });
});
