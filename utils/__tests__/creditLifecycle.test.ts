import { describe, it, expect } from 'vitest';
import {
  detectSICR,
  buildPdTermStructure,
  calculateLifetimeEL,
  assessCreditLifecycle,
} from '../pricing/creditLifecycle';

// ── SICR detection ───────────────────────────────────────────────────────────

describe('detectSICR', () => {
  it('returns stage 1 with no triggers (healthy deal)', () => {
    const result = detectSICR({
      pdMultiplier: 1.2,
      daysPastDue: 5,
      isRefinanced: false,
      isWatchlist: false,
      isForborne: false,
    });
    expect(result.triggered).toBe(false);
    expect(result.stage).toBe(1);
    expect(result.reasons).toHaveLength(0);
  });

  it('returns stage 1 for empty inputs', () => {
    const result = detectSICR({});
    expect(result.stage).toBe(1);
    expect(result.triggered).toBe(false);
  });

  it('triggers stage 2 on PD multiplier ≥ 2.0', () => {
    const result = detectSICR({ pdMultiplier: 2.5 });
    expect(result.triggered).toBe(true);
    expect(result.stage).toBe(2);
    expect(result.reasons[0]).toContain('PD multiplier');
  });

  it('triggers stage 2 on DPD > 30', () => {
    const result = detectSICR({ daysPastDue: 45 });
    expect(result.stage).toBe(2);
    expect(result.reasons).toContain('DPD > 30');
  });

  it('triggers stage 2 on refinanced flag', () => {
    const result = detectSICR({ isRefinanced: true });
    expect(result.stage).toBe(2);
    expect(result.reasons[0]).toContain('Refinanced');
  });

  it('triggers stage 2 on watchlist flag', () => {
    const result = detectSICR({ isWatchlist: true });
    expect(result.stage).toBe(2);
    expect(result.reasons).toContain('Watchlist');
  });

  it('triggers stage 2 on forborne flag', () => {
    const result = detectSICR({ isForborne: true });
    expect(result.stage).toBe(2);
    expect(result.reasons).toContain('Forborne exposure');
  });

  it('triggers stage 3 on DPD > 90 (default)', () => {
    const result = detectSICR({ daysPastDue: 120, pdMultiplier: 5, isForborne: true });
    expect(result.stage).toBe(3);
    expect(result.reasons[0]).toContain('Default');
    // Stage 3 short-circuits: only default reason
    expect(result.reasons).toHaveLength(1);
  });

  it('accumulates multiple stage 2 reasons', () => {
    const result = detectSICR({
      pdMultiplier: 3,
      daysPastDue: 60,
      isWatchlist: true,
    });
    expect(result.stage).toBe(2);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

// ── PD term structure ───────────────────────────────────────────────────────

describe('buildPdTermStructure', () => {
  it('produces a monotonically increasing curve for 1% PD over 5 years', () => {
    const curve = buildPdTermStructure(0.01, 60);
    expect(curve).toHaveLength(5);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    }
    // 5-year cumulative should be approximately 1 - (1 - 0.01)^5 ≈ 0.049
    expect(curve[4]).toBeCloseTo(0.0490, 3);
  });

  it('handles PD = 0 edge case', () => {
    const curve = buildPdTermStructure(0, 36);
    expect(curve).toHaveLength(3);
    expect(curve.every(v => v === 0)).toBe(true);
  });

  it('handles near-1 PD edge case', () => {
    const curve = buildPdTermStructure(0.999, 24);
    expect(curve).toHaveLength(2);
    expect(curve[0]).toBeGreaterThan(0.99);
  });

  it('handles very short duration (< 12 months) with at least 1 year', () => {
    const curve = buildPdTermStructure(0.02, 6);
    expect(curve).toHaveLength(1);
    expect(curve[0]).toBeCloseTo(0.02, 3);
  });
});

// ── Lifetime EL ─────────────────────────────────────────────────────────────

describe('calculateLifetimeEL', () => {
  it('stage 1: provisionEL equals el12m = PD × LGD × EAD', () => {
    const result = calculateLifetimeEL({
      pd12m: 0.01,
      lgd: 0.45,
      ead: 100_000,
      durationMonths: 60,
      stage: 1,
    });
    expect(result.stage).toBe(1);
    expect(result.el12m).toBeCloseTo(450, 2); // 0.01 × 0.45 × 100k
    expect(result.provisionEL).toBeCloseTo(result.el12m, 2);
  });

  it('stage 2: provisionEL equals elLifetime and exceeds el12m', () => {
    const result = calculateLifetimeEL({
      pd12m: 0.01,
      lgd: 0.45,
      ead: 100_000,
      durationMonths: 60,
      stage: 2,
    });
    expect(result.stage).toBe(2);
    expect(result.provisionEL).toBeCloseTo(result.elLifetime, 2);
    expect(result.elLifetime).toBeGreaterThan(result.el12m);
    // Should be roughly ~2000 (5Y cum PD ≈ 5% × 45% × 100k = 2250, minus discount)
    expect(result.elLifetime).toBeGreaterThan(1500);
    expect(result.elLifetime).toBeLessThan(2500);
  });

  it('stage 3: provisionEL = LGD × EAD (full defaulted loss)', () => {
    const result = calculateLifetimeEL({
      pd12m: 0.01,
      lgd: 0.45,
      ead: 100_000,
      durationMonths: 60,
      stage: 3,
    });
    expect(result.stage).toBe(3);
    expect(result.provisionEL).toBeCloseTo(45_000, 2);
  });

  it('produces sensible annualCostPct for a 5Y mortgage example', () => {
    // 5Y mortgage: PD 50bps, LGD 20% (secured by real estate), 250k EAD
    const result = calculateLifetimeEL({
      pd12m: 0.005,
      lgd: 0.20,
      ead: 250_000,
      durationMonths: 60,
      stage: 2,
    });
    // Annual cost should be small (~10-15 bps)
    expect(result.annualCostPct).toBeGreaterThan(0.05);
    expect(result.annualCostPct).toBeLessThan(0.30);
  });

  it('annualCostPct for stage 1 is PD × LGD / years', () => {
    const result = calculateLifetimeEL({
      pd12m: 0.01,
      lgd: 0.45,
      ead: 100_000,
      durationMonths: 60, // 5 years
      stage: 1,
    });
    // annualCostPct = (450 / 100k / 5) × 100 = 0.09
    expect(result.annualCostPct).toBeCloseTo(0.09, 3);
  });
});

// ── Integration: assessCreditLifecycle ──────────────────────────────────────

describe('assessCreditLifecycle', () => {
  it('integrates SICR + EL: healthy deal → stage 1 + el12m provision', () => {
    const result = assessCreditLifecycle(0.01, 0.45, 100_000, 60, {});
    expect(result.sicrResult.stage).toBe(1);
    expect(result.stage).toBe(1);
    expect(result.provisionEL).toBeCloseTo(result.el12m, 2);
  });

  it('integrates SICR + EL: watchlist → stage 2 + lifetime provision', () => {
    const result = assessCreditLifecycle(0.01, 0.45, 100_000, 60, {
      isWatchlist: true,
    });
    expect(result.sicrResult.stage).toBe(2);
    expect(result.stage).toBe(2);
    expect(result.provisionEL).toBe(result.elLifetime);
    expect(result.elLifetime).toBeGreaterThan(result.el12m);
  });

  it('integrates SICR + EL: DPD 120 → stage 3 + full LGD×EAD', () => {
    const result = assessCreditLifecycle(0.01, 0.45, 100_000, 60, {
      daysPastDue: 120,
    });
    expect(result.stage).toBe(3);
    expect(result.provisionEL).toBeCloseTo(45_000, 2);
  });

  it('explicit stage overrides SICR-detected stage', () => {
    // SICR would say stage 2 (watchlist), but caller forces stage 1
    const result = assessCreditLifecycle(
      0.01,
      0.45,
      100_000,
      60,
      { isWatchlist: true },
      1,
    );
    expect(result.sicrResult.stage).toBe(2); // SICR still reports its own finding
    expect(result.stage).toBe(1); // but EL uses override
    expect(result.provisionEL).toBeCloseTo(result.el12m, 2);
  });
});
