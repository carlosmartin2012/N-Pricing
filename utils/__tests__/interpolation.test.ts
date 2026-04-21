import { describe, it, expect } from 'vitest';
import {
  linearInterpolate,
  prepareYieldCurvePoints,
  prepareLiquidityCurvePoints,
} from '../pricing/interpolation';

/**
 * Direct coverage for the three interpolation primitives. Every other
 * curve module uses linearInterpolate at the bottom of the stack, so
 * boundary-safety here prevents hard-to-debug curve corruption bugs.
 */

const TENOR_MAP = {
  'ON': 0, '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60, '10Y': 120,
};

describe('linearInterpolate', () => {
  const pts = [
    { x: 0, y: 10 },
    { x: 10, y: 20 },
    { x: 20, y: 40 },
  ];

  it('returns 0 for empty points', () => {
    expect(linearInterpolate([], 5)).toBe(0);
  });

  it('returns 0 for non-finite targetX', () => {
    expect(linearInterpolate(pts, NaN)).toBe(0);
    expect(linearInterpolate(pts, Infinity)).toBe(0);
  });

  it('clamps to first point when targetX below range', () => {
    expect(linearInterpolate(pts, -5)).toBe(10);
  });

  it('clamps to last point when targetX above range', () => {
    expect(linearInterpolate(pts, 100)).toBe(40);
  });

  it('returns exact y on a known point', () => {
    expect(linearInterpolate(pts, 10)).toBe(20);
  });

  it('interpolates linearly within the bracket', () => {
    expect(linearInterpolate(pts, 5)).toBe(15);
    expect(linearInterpolate(pts, 15)).toBe(30);
  });

  it('handles duplicate x (denom=0) without NaN', () => {
    const dup = [{ x: 0, y: 10 }, { x: 5, y: 15 }, { x: 5, y: 25 }, { x: 10, y: 30 }];
    const out = linearInterpolate(dup, 5);
    expect(Number.isFinite(out)).toBe(true);
  });

  it('handles non-finite y by falling back to 0', () => {
    const bad = [{ x: 0, y: NaN }, { x: 10, y: 20 }];
    expect(linearInterpolate(bad, -1)).toBe(0);
  });
});

describe('prepareYieldCurvePoints', () => {
  it('drops unknown tenors rather than mapping to 0', () => {
    const pts = prepareYieldCurvePoints(
      [{ tenor: '1Y', rate: 3.5 }, { tenor: 'WHAT', rate: 999 }, { tenor: '5Y', rate: 4.0 }],
      TENOR_MAP,
    );
    expect(pts).toHaveLength(2);
    expect(pts.map((p) => p.x)).toEqual([12, 60]);
  });

  it('sorts by x', () => {
    const pts = prepareYieldCurvePoints(
      [{ tenor: '5Y', rate: 4 }, { tenor: '1M', rate: 2 }, { tenor: '1Y', rate: 3 }],
      TENOR_MAP,
    );
    expect(pts.map((p) => p.x)).toEqual([1, 12, 60]);
  });

  it('preserves y values', () => {
    const pts = prepareYieldCurvePoints(
      [{ tenor: '1M', rate: 2.5 }, { tenor: '5Y', rate: 4.25 }],
      TENOR_MAP,
    );
    expect(pts).toEqual([{ x: 1, y: 2.5 }, { x: 60, y: 4.25 }]);
  });
});

describe('prepareLiquidityCurvePoints', () => {
  it('maps termLP to y', () => {
    const pts = prepareLiquidityCurvePoints(
      [{ tenor: '1Y', termLP: 50 }, { tenor: '5Y', termLP: 80 }],
      TENOR_MAP,
    );
    expect(pts).toEqual([{ x: 12, y: 50 }, { x: 60, y: 80 }]);
  });

  it('drops unknown tenors', () => {
    const pts = prepareLiquidityCurvePoints(
      [{ tenor: 'XY', termLP: 0 }, { tenor: '1M', termLP: 25 }],
      TENOR_MAP,
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({ x: 1, y: 25 });
  });
});
