import { describe, it, expect } from 'vitest';
import type { EntryPair } from '../../../types/reconciliation';
import { reconciliationPairsToCsv, reconciliationCsvFilename } from '../reconciliationCsv';

function pair(overrides: Partial<EntryPair> = {}): EntryPair {
  return {
    dealId: 'D-1',
    clientId: 'C-1',
    clientName: 'Acme',
    businessUnit: 'BU_CORP',
    productType: 'Loan',
    bu:       { dealId: 'D-1', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    treasury: { dealId: 'D-1', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    matchStatus: 'matched',
    amountDeltaEur: 0,
    rateDeltaPct: 0,
    hint: null,
    ...overrides,
  };
}

describe('reconciliationPairsToCsv', () => {
  it('emits header only on empty input', () => {
    const csv = reconciliationPairsToCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toMatch(/^dealId,clientId,/);
  });

  it('emits one data row per pair', () => {
    const csv = reconciliationPairsToCsv([pair(), pair({ dealId: 'D-2' })]);
    expect(csv.split('\n')).toHaveLength(3);
  });

  it('renders null bu/treasury cells as empty', () => {
    const csv = reconciliationPairsToCsv([pair({ treasury: null, matchStatus: 'bu_only' })]);
    const [, line] = csv.split('\n');
    // The 4 last treasury* cells should be empty before the hint column.
    expect(line).toContain(',,,,');
  });

  it('escapes commas + quotes per RFC 4180', () => {
    const csv = reconciliationPairsToCsv([pair({
      hint: 'Bank, "top-tier", investigate',
    })]);
    expect(csv).toContain('"Bank, ""top-tier"", investigate"');
  });
});

describe('reconciliationCsvFilename', () => {
  it('embeds period + status + UTC date', () => {
    const fake = new Date('2026-04-23T10:30:00Z');
    expect(reconciliationCsvFilename('2026-04', 'unmatched', fake))
      .toBe('reconciliation-2026-04-unmatched-20260423.csv');
  });
});
