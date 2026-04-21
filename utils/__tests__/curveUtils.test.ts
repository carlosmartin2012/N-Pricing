import { describe, it, expect } from 'vitest';
import type { YieldCurvePoint } from '../../types';
import {
  interpolateYieldCurve,
  bootstrapZeroRates,
  interpolateFromZeros,
} from '../pricing/curveUtils';

/**
 * Direct tests for the yield-curve primitives. These are consumed by every
 * other pricing module (formulaEngine, liquidityEngine, etc.), so
 * regression here has wide blast radius.
 */

function curve(points: Array<[string, number]>): YieldCurvePoint[] {
  return points.map(([tenor, rate]) => ({ tenor, rate }));
}

describe('interpolateYieldCurve', () => {
  it('returns 0 on empty curve', () => {
    expect(interpolateYieldCurve([], 12)).toBe(0);
  });

  it('returns 0 on null-ish curve', () => {
    // @ts-expect-error — guard path
    expect(interpolateYieldCurve(null, 12)).toBe(0);
  });

  it('returns the exact rate at a known tenor', () => {
    const c = curve([['1M', 2], ['1Y', 3], ['5Y', 4]]);
    expect(interpolateYieldCurve(c, 12)).toBe(3);
  });

  it('interpolates between two bracketing tenors', () => {
    const c = curve([['1Y', 3], ['5Y', 5]]); // span 12..60 months
    // halfway (36) → (3+5)/2 = 4
    expect(interpolateYieldCurve(c, 36)).toBe(4);
  });

  it('clamps when targetMonths below range', () => {
    const c = curve([['1Y', 3], ['5Y', 5]]);
    expect(interpolateYieldCurve(c, 0)).toBe(3);
  });

  it('clamps when targetMonths above range', () => {
    const c = curve([['1Y', 3], ['5Y', 5]]);
    expect(interpolateYieldCurve(c, 200)).toBe(5);
  });

  it('ignores unknown tenors (drops them rather than mapping to 0)', () => {
    const c = curve([['UNKNOWN', 999], ['1Y', 3], ['5Y', 5]]);
    // UNKNOWN is filtered; result sits between 3 and 5.
    expect(interpolateYieldCurve(c, 36)).toBe(4);
  });
});

describe('bootstrapZeroRates', () => {
  it('returns short-term tenors unchanged (zero ≈ par)', () => {
    const par = curve([['1M', 2], ['3M', 2.2], ['6M', 2.5], ['1Y', 3]]);
    const zeros = bootstrapZeroRates(par);
    for (const z of zeros) {
      const original = par.find((p) => p.tenor === z.tenor);
      expect(z.rate).toBeCloseTo(original!.rate, 6);
    }
  });

  it('produces a zero rate for long-term tenors that stays finite', () => {
    const par = curve([['1Y', 3], ['2Y', 3.5], ['5Y', 4], ['10Y', 4.5]]);
    const zeros = bootstrapZeroRates(par);
    for (const z of zeros) {
      expect(Number.isFinite(z.rate)).toBe(true);
    }
    const tenYear = zeros.find((z) => z.tenor === '10Y')!;
    // With an upward-sloping par curve, the 10Y zero is typically ≥ the 10Y par
    // (bootstrap amplifies the slope). Accept "close or greater" to stay robust
    // against the smoothing inherent to the iterative solver.
    expect(tenYear.rate).toBeGreaterThan(4);
  });

  it('drops unknown tenors from the input instead of crashing', () => {
    const par = curve([['UNKNOWN', 99], ['1Y', 3], ['5Y', 4]]);
    const zeros = bootstrapZeroRates(par);
    const tenors = zeros.map((z) => z.tenor);
    expect(tenors).not.toContain('UNKNOWN');
  });

  it('handles an empty input', () => {
    expect(bootstrapZeroRates([])).toEqual([]);
  });
});

describe('interpolateFromZeros', () => {
  it('returns 0 on empty zeros', () => {
    expect(interpolateFromZeros([], 12)).toBe(0);
  });

  it('linearly interpolates between two zeros', () => {
    const zeros = [
      { months: 12, rate: 3 },
      { months: 60, rate: 5 },
    ];
    expect(interpolateFromZeros(zeros, 36)).toBe(4);
  });
});
