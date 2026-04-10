import { describe, it, expect } from 'vitest';
import {
  nssYield,
  nssForwardRate,
  fitNSSLinear,
  interpolateNSS,
  type NSSParameters,
  type NSSObservation,
} from '../pricing/nelsonSiegelSvensson';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const normalParams: NSSParameters = {
  beta0: 3.5,
  beta1: -1.5,
  beta2: 2.0,
  beta3: 1.0,
  tau1: 2.0,
  tau2: 5.0,
};

// A realistic EUR swap curve (rates in %), upward sloping with slight hump.
const eurCurve: NSSObservation[] = [
  { t: 0.25, rate: 3.10 },
  { t: 0.5, rate: 3.15 },
  { t: 1, rate: 3.20 },
  { t: 2, rate: 3.10 },
  { t: 3, rate: 3.05 },
  { t: 5, rate: 3.00 },
  { t: 7, rate: 3.05 },
  { t: 10, rate: 3.15 },
  { t: 15, rate: 3.25 },
  { t: 20, rate: 3.30 },
];

// ---------------------------------------------------------------------------
// nssYield
// ---------------------------------------------------------------------------

describe('nssYield', () => {
  it('returns beta0 + beta1 at t = 0', () => {
    expect(nssYield(normalParams, 0)).toBeCloseTo(
      normalParams.beta0 + normalParams.beta1,
      6,
    );
  });

  it('approaches beta0 as t → infinity', () => {
    const longRun = nssYield(normalParams, 1e6);
    expect(longRun).toBeCloseTo(normalParams.beta0, 4);
  });

  it('produces a flat curve when beta1, beta2, beta3 are all zero', () => {
    const flat: NSSParameters = {
      beta0: 2.75,
      beta1: 0,
      beta2: 0,
      beta3: 0,
      tau1: 2,
      tau2: 5,
    };
    expect(nssYield(flat, 0.5)).toBeCloseTo(2.75, 6);
    expect(nssYield(flat, 5)).toBeCloseTo(2.75, 6);
    expect(nssYield(flat, 30)).toBeCloseTo(2.75, 6);
  });

  it('handles negative t by returning the t=0 limit', () => {
    expect(nssYield(normalParams, -1)).toBeCloseTo(
      normalParams.beta0 + normalParams.beta1,
      6,
    );
  });
});

// ---------------------------------------------------------------------------
// nssForwardRate
// ---------------------------------------------------------------------------

describe('nssForwardRate', () => {
  it('returns beta0 + beta1 at t = 0', () => {
    expect(nssForwardRate(normalParams, 0)).toBeCloseTo(
      normalParams.beta0 + normalParams.beta1,
      6,
    );
  });

  it('approaches beta0 as t → infinity', () => {
    const longRun = nssForwardRate(normalParams, 1e6);
    expect(longRun).toBeCloseTo(normalParams.beta0, 4);
  });

  it('stays finite for typical maturities', () => {
    for (const t of [0.5, 1, 5, 10, 30]) {
      const f = nssForwardRate(normalParams, t);
      expect(Number.isFinite(f)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// fitNSSLinear
// ---------------------------------------------------------------------------

describe('fitNSSLinear', () => {
  it('returns finite params when given a well-formed curve', () => {
    const result = fitNSSLinear(eurCurve);
    expect(result.converged).toBe(true);
    expect(Number.isFinite(result.params.beta0)).toBe(true);
    expect(Number.isFinite(result.params.beta1)).toBe(true);
    expect(Number.isFinite(result.params.beta2)).toBe(true);
    expect(Number.isFinite(result.params.beta3)).toBe(true);
  });

  it('achieves small RMSE on a realistic EUR curve', () => {
    const result = fitNSSLinear(eurCurve);
    // Realistic EUR curves should fit very well with NSS (few bps RMSE).
    expect(result.rmse).toBeLessThan(0.1);
  });

  it('returns a flat curve when given fewer than 4 points', () => {
    const sparse: NSSObservation[] = [
      { t: 1, rate: 2.5 },
      { t: 5, rate: 3.0 },
      { t: 10, rate: 3.2 },
    ];
    const result = fitNSSLinear(sparse);
    const expectedAvg = (2.5 + 3.0 + 3.2) / 3;
    expect(result.params.beta0).toBeCloseTo(expectedAvg, 6);
    expect(result.params.beta1).toBe(0);
    expect(result.params.beta2).toBe(0);
    expect(result.params.beta3).toBe(0);
  });

  it('fits a flat curve with beta1, beta2, beta3 ≈ 0', () => {
    const flatObs: NSSObservation[] = [
      { t: 0.5, rate: 2.5 },
      { t: 1, rate: 2.5 },
      { t: 2, rate: 2.5 },
      { t: 5, rate: 2.5 },
      { t: 10, rate: 2.5 },
      { t: 20, rate: 2.5 },
    ];
    const result = fitNSSLinear(flatObs);
    expect(result.params.beta0).toBeCloseTo(2.5, 2);
    expect(result.params.beta1).toBeCloseTo(0, 2);
    expect(result.params.beta2).toBeCloseTo(0, 2);
    expect(result.params.beta3).toBeCloseTo(0, 2);
    expect(result.rmse).toBeLessThan(1e-6);
  });

  it('recovers a known NSS curve when fitted on its own samples', () => {
    // Generate samples from normalParams, fit, expect a near-perfect recovery.
    const samples: NSSObservation[] = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30].map(
      (t) => ({ t, rate: nssYield(normalParams, t) }),
    );
    const result = fitNSSLinear(samples, normalParams.tau1, normalParams.tau2);
    expect(result.rmse).toBeLessThan(1e-6);
    expect(result.params.beta0).toBeCloseTo(normalParams.beta0, 4);
    expect(result.params.beta1).toBeCloseTo(normalParams.beta1, 4);
    expect(result.params.beta2).toBeCloseTo(normalParams.beta2, 4);
    expect(result.params.beta3).toBeCloseTo(normalParams.beta3, 4);
  });
});

// ---------------------------------------------------------------------------
// interpolateNSS
// ---------------------------------------------------------------------------

describe('interpolateNSS', () => {
  it('matches observed points within tolerance', () => {
    // NSS with fixed tau is a 4-parameter fit over 10 points, so we cannot
    // expect exact matches. Allow ~10 bps tolerance (|pred - obs| < 0.1).
    for (const obs of eurCurve) {
      const interpolated = interpolateNSS(eurCurve, obs.t);
      expect(Math.abs(interpolated - obs.rate)).toBeLessThan(0.1);
    }
  });

  it('extrapolates sensibly beyond the last observed point', () => {
    // 30Y should be near 20Y, not wildly different.
    const last = eurCurve[eurCurve.length - 1].rate;
    const extrapolated = interpolateNSS(eurCurve, 30);
    expect(Math.abs(extrapolated - last)).toBeLessThan(0.5);
  });

  it('handles an inverted curve (short > long)', () => {
    const inverted: NSSObservation[] = [
      { t: 0.25, rate: 4.5 },
      { t: 0.5, rate: 4.4 },
      { t: 1, rate: 4.2 },
      { t: 2, rate: 3.9 },
      { t: 3, rate: 3.7 },
      { t: 5, rate: 3.5 },
      { t: 7, rate: 3.4 },
      { t: 10, rate: 3.3 },
    ];
    const short = interpolateNSS(inverted, 0.25);
    const long = interpolateNSS(inverted, 10);
    // Short should remain above long.
    expect(short).toBeGreaterThan(long);
    // And the fit should remain close to observations.
    expect(interpolateNSS(inverted, 1)).toBeCloseTo(4.2, 1);
  });

  it('returns 0 when given an empty observation set', () => {
    expect(interpolateNSS([], 5)).toBe(0);
  });

  it('integration: fits a realistic EUR curve and interpolates at 30Y', () => {
    const rate30 = interpolateNSS(eurCurve, 30);
    // Plausible 30Y rate around 3.2-3.5% for this curve.
    expect(rate30).toBeGreaterThan(2.5);
    expect(rate30).toBeLessThan(4.0);
    // Also check an interior point (e.g. 4Y) is between 3Y and 5Y observations.
    const rate4 = interpolateNSS(eurCurve, 4);
    expect(rate4).toBeGreaterThan(2.8);
    expect(rate4).toBeLessThan(3.3);
  });
});
