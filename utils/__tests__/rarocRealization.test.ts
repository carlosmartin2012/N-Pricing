import { describe, it, expect } from 'vitest';
import {
  computeMapeRaroc,
  buildEstimates,
  deserializeRealization,
} from '../pricing/rarocRealization';

describe('computeMapeRaroc', () => {
  it('returns NaN on empty', () => {
    expect(computeMapeRaroc([])).toBeNaN();
  });
  it('returns 0 when realized = expected', () => {
    expect(computeMapeRaroc([{ expected: 10, realized: 10 }])).toBe(0);
  });
  it('returns percentage error', () => {
    const mape = computeMapeRaroc([
      { expected: 10, realized: 11 },   // 10% err
      { expected: 20, realized: 18 },   // 10% err
    ]);
    expect(mape).toBeCloseTo(10, 1);
  });
  it('skips entries with expected=0 or non-finite', () => {
    const mape = computeMapeRaroc([
      { expected: 10, realized: 11 },
      { expected: 0, realized: 5 },
      { expected: NaN, realized: 10 },
    ]);
    expect(mape).toBeCloseTo(10, 1);
  });
});

describe('buildEstimates', () => {
  it('computes delta in percent and bp', () => {
    const e = buildEstimates(12, 14.5);
    expect(e.delta).toBe(2.5);
    expect(e.deltaBp).toBe(250);
  });
  it('handles negative deltas', () => {
    const e = buildEstimates(15, 13);
    expect(e.delta).toBe(-2);
    expect(e.deltaBp).toBe(-200);
  });
});

describe('deserializeRealization', () => {
  it('coerces numeric fields from strings', () => {
    const out = deserializeRealization({
      deal_id: 'd-1',
      snapshot_date: '2026-04-13',
      realized_ftp_rate: '1.25',
      realized_margin: '0.5',
      realized_ecl: '0.003',
      realized_raroc: '14.2',
      recompute_method: 'SPOT_CURVE',
    });
    expect(out.realizedRaroc).toBe(14.2);
    expect(out.recomputeMethod).toBe('SPOT_CURVE');
  });
  it('defaults unknown method to SPOT_CURVE', () => {
    const out = deserializeRealization({
      deal_id: 'd-1', snapshot_date: '2026-04-13', recompute_method: 'GARBAGE',
    });
    expect(out.recomputeMethod).toBe('SPOT_CURVE');
  });
  it('handles null numerics', () => {
    const out = deserializeRealization({
      deal_id: 'd-1', snapshot_date: '2026-04-13',
      realized_ftp_rate: null, realized_margin: null,
      realized_ecl: null, realized_raroc: null,
      recompute_method: 'CORE_FEED',
    });
    expect(out.realizedRaroc).toBe(0);
    expect(out.recomputeMethod).toBe('CORE_FEED');
  });
});
