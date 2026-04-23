import { describe, it, expect } from 'vitest';
import { InMemoryMarketData } from '../inMemory';
import { BloombergMarketDataAdapter } from '../marketData/bloomberg';
import type { MarketYieldCurveSnapshot } from '../types';

const BASE_EUR: MarketYieldCurveSnapshot = {
  currency: 'EUR',
  asOfDate: '2026-04-23',
  source: 'ecb-survey',
  points: [
    { tenor: '1M',  rate: 3.00 },
    { tenor: '3M',  rate: 3.05 },
    { tenor: '6M',  rate: 3.15 },
    { tenor: '1Y',  rate: 3.30 },
    { tenor: '2Y',  rate: 3.45 },
    { tenor: '5Y',  rate: 3.70 },
    { tenor: '10Y', rate: 3.95 },
    { tenor: '20Y', rate: 4.10 },
  ],
};

describe('InMemoryMarketData.fetchShockedCurve', () => {
  it('returns not_found when no base curve exists', async () => {
    const adapter = new InMemoryMarketData();
    const r = await adapter.fetchShockedCurve('parallel_up_200', 'EUR');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not_found');
  });

  it('applies +200 bp uniformly under parallel_up_200', async () => {
    const adapter = new InMemoryMarketData();
    adapter.seedCurve(BASE_EUR);
    const r = await adapter.fetchShockedCurve('parallel_up_200', 'EUR');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Every point shifted up by exactly 2.00% (200 bp → 2 percentage points).
    for (let i = 0; i < BASE_EUR.points.length; i++) {
      expect(r.value.points[i].rate).toBeCloseTo(BASE_EUR.points[i].rate + 2.0, 6);
    }
    expect(r.value.source).toContain('eba:parallel_up_200');
    // Original points untouched (immutability guard).
    expect(BASE_EUR.points[0].rate).toBe(3.00);
  });

  it('applies decaying short shock (larger at 1M than at 20Y)', async () => {
    const adapter = new InMemoryMarketData();
    adapter.seedCurve(BASE_EUR);
    const r = await adapter.fetchShockedCurve('short_up_250', 'EUR');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const shift1M  = r.value.points[0].rate - BASE_EUR.points[0].rate;
    const shift20Y = r.value.points[7].rate - BASE_EUR.points[7].rate;
    expect(shift1M).toBeGreaterThan(shift20Y);
    // 1M shift approaches 250 bp (2.5 percentage points) minus the tiny decay.
    expect(shift1M).toBeGreaterThan(2.4);
    // 20Y shift almost vanishes (exp(-5) × 250 ≈ 1.7 bp ≈ 0.017 pp).
    expect(shift20Y).toBeLessThan(0.05);
  });

  it('steepener produces negative short-end shift and positive long-end shift', async () => {
    const adapter = new InMemoryMarketData();
    adapter.seedCurve(BASE_EUR);
    const r = await adapter.fetchShockedCurve('steepener', 'EUR');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const shift1M  = r.value.points[0].rate - BASE_EUR.points[0].rate;
    const shift20Y = r.value.points[7].rate - BASE_EUR.points[7].rate;
    expect(shift1M).toBeLessThan(0);
    expect(shift20Y).toBeGreaterThan(0);
  });

  it('preserves the original asOfDate and currency', async () => {
    const adapter = new InMemoryMarketData();
    adapter.seedCurve(BASE_EUR);
    const r = await adapter.fetchShockedCurve('flattener', 'EUR');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.currency).toBe('EUR');
    expect(r.value.asOfDate).toBe('2026-04-23');
  });
});

describe('BloombergMarketDataAdapter.fetchShockedCurve', () => {
  it('returns unreachable (stub adapter)', async () => {
    const adapter = new BloombergMarketDataAdapter({
      appName: 'test', curveTickers: { EUR: ['EUSWE Curncy'] },
    });
    const r = await adapter.fetchShockedCurve('parallel_up_200', 'EUR');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unreachable');
      expect(r.error.message).toMatch(/stub/);
    }
  });
});
