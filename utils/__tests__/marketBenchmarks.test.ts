import { describe, it, expect } from 'vitest';
import { findBenchmark, compareToMarket, type MarketBenchmark } from '../marketBenchmarks';

const benchmarks: MarketBenchmark[] = [
  { productType: 'LOAN_COMM', tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 4.22, source: 'BBG', asOfDate: '2026-04-01' },
  { productType: 'LOAN_COMM', tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 4.15, source: 'BBG', asOfDate: '2026-03-01' },
  { productType: 'MORTGAGE', tenorBucket: 'LT', clientType: 'Retail', currency: 'EUR', rate: 3.85, source: 'BdE', asOfDate: '2026-04-01' },
];

describe('findBenchmark', () => {
  it('returns the most recent matching benchmark', () => {
    const out = findBenchmark(benchmarks, {
      productType: 'LOAN_COMM',
      clientType: 'Corporate',
      currency: 'EUR',
      durationMonths: 36,
    });
    expect(out?.rate).toBe(4.22);
    expect(out?.asOfDate).toBe('2026-04-01');
  });
  it('returns null when no match exists', () => {
    const out = findBenchmark(benchmarks, {
      productType: 'NONEXISTENT',
      clientType: 'X',
      currency: 'USD',
      durationMonths: 12,
    });
    expect(out).toBeNull();
  });
  it('uses tenor bucketing (MT = 13-60 months)', () => {
    // 36m → MT
    expect(findBenchmark(benchmarks, { productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 60 })?.rate).toBe(4.22);
    // 120m → LT (no matching LT Corporate LOAN_COMM)
    expect(findBenchmark(benchmarks, { productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 120 })).toBeNull();
  });
});

describe('compareToMarket', () => {
  it('returns BELOW when rate is below market by >10bp', () => {
    const out = compareToMarket(4.00, benchmarks, {
      productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 36,
    });
    expect(out?.relative).toBe('BELOW');
    expect(out?.deltaBp).toBe(-22);
  });
  it('returns ABOVE when rate is above market by >10bp', () => {
    const out = compareToMarket(4.50, benchmarks, {
      productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 36,
    });
    expect(out?.relative).toBe('ABOVE');
    expect(out?.deltaBp).toBe(28);
  });
  it('returns ON_MARKET within ±10bp band', () => {
    expect(compareToMarket(4.30, benchmarks, {
      productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 36,
    })?.relative).toBe('ON_MARKET');
    expect(compareToMarket(4.14, benchmarks, {
      productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 36,
    })?.relative).toBe('ON_MARKET');
  });
  it('returns null when no benchmark matches', () => {
    expect(compareToMarket(5, benchmarks, {
      productType: 'NONE', clientType: 'X', currency: 'USD', durationMonths: 12,
    })).toBeNull();
  });
});
