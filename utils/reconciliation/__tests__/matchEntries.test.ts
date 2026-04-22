import { describe, it, expect } from 'vitest';
import type { LedgerSide } from '../../../types/reconciliation';
import { classifyPair, matchEntries, summariseEntries } from '../matchEntries';

/**
 * Unit tests for the FTP reconciliation engine. Covers the 7 MatchStatus
 * paths + tolerance boundaries + aggregate summary.
 */

function side(overrides: Partial<LedgerSide> = {}): LedgerSide {
  return {
    dealId: 'D-1',
    amountEur: 1_000_000,
    currency: 'EUR',
    ratePct: 4.25,
    postedAt: '2026-04-15',
    ...overrides,
  };
}

describe('classifyPair', () => {
  it('returns unknown when both sides missing', () => {
    expect(classifyPair(null, null).status).toBe('unknown');
  });

  it('returns bu_only when only BU posted', () => {
    expect(classifyPair(side(), null).status).toBe('bu_only');
  });

  it('returns treasury_only when only Treasury posted', () => {
    expect(classifyPair(null, side()).status).toBe('treasury_only');
  });

  it('returns currency_mismatch when currencies differ (hard error)', () => {
    const r = classifyPair(side({ currency: 'EUR' }), side({ currency: 'USD' }));
    expect(r.status).toBe('currency_mismatch');
    expect(r.hint).toContain('EUR');
    expect(r.hint).toContain('USD');
  });

  it('returns amount_mismatch when delta > tolerance', () => {
    const r = classifyPair(side({ amountEur: 1_000_000 }), side({ amountEur: 1_000_500 }));
    expect(r.status).toBe('amount_mismatch');
    expect(r.amountDeltaEur).toBe(500);
  });

  it('matches when amount delta within 1 EUR default tolerance', () => {
    const r = classifyPair(side({ amountEur: 1_000_000 }), side({ amountEur: 1_000_000.5 }));
    expect(r.status).toBe('matched');
  });

  it('returns rate_mismatch when rate delta > tolerance', () => {
    const r = classifyPair(side({ ratePct: 4.25 }), side({ ratePct: 4.40 }));
    expect(r.status).toBe('rate_mismatch');
    expect(r.rateDeltaPct).toBeGreaterThan(0);
  });

  it('matches when rate delta within 0.01pp tolerance', () => {
    const r = classifyPair(side({ ratePct: 4.250 }), side({ ratePct: 4.255 }));
    expect(r.status).toBe('matched');
  });

  it('matches when both sides identical', () => {
    expect(classifyPair(side(), side()).status).toBe('matched');
  });

  it('respects custom tolerances', () => {
    const r = classifyPair(
      side({ amountEur: 1_000_000 }),
      side({ amountEur: 1_000_050 }),
      { amountToleranceEur: 100 },
    );
    expect(r.status).toBe('matched');
  });
});

describe('matchEntries', () => {
  it('drops rows without dealId', () => {
    const pairs = matchEntries([
      { dealId: '', businessUnit: 'BU_A', productType: 'Loan', bu: side(), treasury: side() },
      { dealId: 'D-2', businessUnit: 'BU_A', productType: 'Loan', bu: side({ dealId: 'D-2' }), treasury: side({ dealId: 'D-2' }) },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].dealId).toBe('D-2');
  });

  it('passes through client name and business unit', () => {
    const [pair] = matchEntries([
      { dealId: 'D-1', clientId: 'C-1', clientName: 'Acme', businessUnit: 'BU_A', productType: 'Loan', bu: side(), treasury: side() },
    ]);
    expect(pair.clientName).toBe('Acme');
    expect(pair.businessUnit).toBe('BU_A');
  });
});

describe('summariseEntries', () => {
  it('produces zero counts for empty input', () => {
    const s = summariseEntries([], '2026-04');
    expect(s.totalEntries).toBe(0);
    expect(s.matched).toBe(0);
    expect(s.unmatched).toBe(0);
  });

  it('counts each status and accumulates amount mismatches', () => {
    const pairs = matchEntries([
      { dealId: 'D-1', businessUnit: 'BU_A', productType: 'Loan', bu: side({ dealId: 'D-1' }), treasury: side({ dealId: 'D-1' }) },
      { dealId: 'D-2', businessUnit: 'BU_A', productType: 'Loan', bu: side({ dealId: 'D-2', amountEur: 2_000_000 }), treasury: side({ dealId: 'D-2', amountEur: 2_001_500 }) },
      { dealId: 'D-3', businessUnit: 'BU_A', productType: 'Loan', bu: side({ dealId: 'D-3' }), treasury: null },
      { dealId: 'D-4', businessUnit: 'BU_A', productType: 'Loan', bu: null, treasury: side({ dealId: 'D-4' }) },
    ]);
    const s = summariseEntries(pairs, '2026-04');
    expect(s.matched).toBe(1);
    expect(s.byStatus.amount_mismatch).toBe(1);
    expect(s.byStatus.bu_only).toBe(1);
    expect(s.byStatus.treasury_only).toBe(1);
    expect(s.unmatched).toBe(3);
    expect(s.amountMismatchEur).toBe(1500);
    expect(s.maxSingleDeltaEur).toBe(1500);
  });

  it('rounds amount and max delta to 2 decimals', () => {
    const pairs = matchEntries([
      { dealId: 'D-1', businessUnit: 'BU_A', productType: 'Loan', bu: side({ amountEur: 1_000_000 }), treasury: side({ amountEur: 1_000_123.4567 }) },
    ]);
    const s = summariseEntries(pairs, '2026-04');
    expect(s.amountMismatchEur).toBe(123.46);
    expect(s.maxSingleDeltaEur).toBe(123.46);
  });
});
