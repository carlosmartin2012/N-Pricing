import { describe, it, expect } from 'vitest';
import {
  computeEbaCurveShift,
  ebaShortScaling,
  ebaLongScaling,
  EBA_SHOCK_PRESETS,
  EBA_STRESS_PRESETS,
} from '../shockPresets';
import type { ShockTenor } from '../../../types/pricingShocks';

const ALL_TENORS: ShockTenor[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '20Y'];

describe('EBA decay factors', () => {
  it('short scaling is 1 at t=0 and decays monotonically', () => {
    expect(ebaShortScaling(0)).toBeCloseTo(1, 6);
    expect(ebaShortScaling(1)).toBeCloseTo(Math.exp(-0.25), 6);
    // Monotonic decreasing
    const values = [0, 0.5, 1, 2, 5, 10, 20].map(ebaShortScaling);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it('long scaling is 0 at t=0 and grows monotonically towards 1', () => {
    expect(ebaLongScaling(0)).toBeCloseTo(0, 6);
    expect(ebaLongScaling(1)).toBeCloseTo(1 - Math.exp(-0.25), 6);
    expect(ebaLongScaling(100)).toBeCloseTo(1, 3);
    const values = [0, 0.5, 1, 2, 5, 10, 20].map(ebaLongScaling);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('computeEbaCurveShift — parallel scenarios', () => {
  it('parallel_up_200 applies +200 bp uniformly across all tenors', () => {
    const shifts = computeEbaCurveShift('parallel_up_200');
    for (const t of ALL_TENORS) {
      expect(shifts[t]).toBe(200);
    }
  });

  it('parallel_down_200 applies -200 bp uniformly across all tenors', () => {
    const shifts = computeEbaCurveShift('parallel_down_200');
    for (const t of ALL_TENORS) {
      expect(shifts[t]).toBe(-200);
    }
  });

  it('accepts a custom parallel magnitude parameter', () => {
    const shifts = computeEbaCurveShift('parallel_up_200', { parallelBps: 300 });
    expect(shifts['1M']).toBe(300);
    expect(shifts['20Y']).toBe(300);
  });
});

describe('computeEbaCurveShift — short-rate scenarios', () => {
  it('short_up_250 is max at the short end and decays to near zero at 20Y', () => {
    const shifts = computeEbaCurveShift('short_up_250');
    // At 1M: 250 × exp(-1/(12×4)) ≈ 250 × 0.979 ≈ 245
    expect(shifts['1M']).toBeGreaterThan(240);
    expect(shifts['1M']).toBeLessThanOrEqual(250);
    // At 20Y: 250 × exp(-5) ≈ 1.7 bp
    expect(Math.abs(shifts['20Y']!)).toBeLessThan(5);
    // Monotonically decreasing in magnitude
    const ordered = ALL_TENORS.map((t) => shifts[t]!);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeLessThanOrEqual(ordered[i - 1]);
    }
  });

  it('short_down_250 mirrors short_up_250 with opposite sign', () => {
    const up = computeEbaCurveShift('short_up_250');
    const down = computeEbaCurveShift('short_down_250');
    for (const t of ALL_TENORS) {
      expect(down[t]).toBe(-up[t]!);
    }
  });
});

describe('computeEbaCurveShift — slope scenarios', () => {
  it('steepener is negative at the short end and positive at the long end', () => {
    const shifts = computeEbaCurveShift('steepener');
    expect(shifts['1M']).toBeLessThan(0);     // short end pushed down
    expect(shifts['3M']).toBeLessThan(0);
    expect(shifts['10Y']).toBeGreaterThan(0); // long end pushed up
    expect(shifts['20Y']).toBeGreaterThan(0);
  });

  it('flattener is positive at the short end and negative at the long end', () => {
    const shifts = computeEbaCurveShift('flattener');
    expect(shifts['1M']).toBeGreaterThan(0);   // short end pushed up
    expect(shifts['3M']).toBeGreaterThan(0);
    expect(shifts['10Y']).toBeLessThan(0);     // long end pushed down
    expect(shifts['20Y']).toBeLessThan(0);
  });

  it('steepener and flattener are not symmetric (different EBA weights)', () => {
    const st = computeEbaCurveShift('steepener');
    const fl = computeEbaCurveShift('flattener');
    // Short ends have different absolute magnitudes
    expect(Math.abs(st['1M']!)).not.toBe(Math.abs(fl['1M']!));
  });
});

describe('computeEbaCurveShift — base + custom', () => {
  it('base returns an empty shifts object', () => {
    expect(computeEbaCurveShift('base')).toEqual({});
  });
  it('custom returns an empty shifts object (caller supplies its own)', () => {
    expect(computeEbaCurveShift('custom')).toEqual({});
  });
});

describe('EBA_SHOCK_PRESETS catalogue', () => {
  it('exposes exactly 7 scenarios (base + 6 regulatory)', () => {
    expect(Object.keys(EBA_SHOCK_PRESETS).sort()).toEqual([
      'base',
      'flattener',
      'parallel_down_200',
      'parallel_up_200',
      'short_down_250',
      'short_up_250',
      'steepener',
    ]);
  });

  it('all presets carry preset_eba_2018_02 source metadata', () => {
    for (const preset of Object.values(EBA_SHOCK_PRESETS)) {
      expect(preset.source).toBe('preset_eba_2018_02');
    }
  });

  it('all non-base presets have a non-null curveShiftBps', () => {
    for (const preset of EBA_STRESS_PRESETS) {
      expect(preset.curveShiftBps).not.toBeNull();
    }
  });

  it('base preset leaves curveShiftBps null and rate 0 (retrocompatible)', () => {
    expect(EBA_SHOCK_PRESETS.base.curveShiftBps).toBeNull();
    expect(EBA_SHOCK_PRESETS.base.interestRate).toBe(0);
    expect(EBA_SHOCK_PRESETS.base.liquiditySpread).toBe(0);
  });

  it('legacy interestRate field is set coherently with the curve shift', () => {
    // Parallel presets: interestRate = ±200
    expect(EBA_SHOCK_PRESETS.parallel_up_200.interestRate).toBe(200);
    expect(EBA_SHOCK_PRESETS.parallel_down_200.interestRate).toBe(-200);
    // Short presets: interestRate ≈ 2Y shift (representative midpoint)
    expect(EBA_SHOCK_PRESETS.short_up_250.interestRate).toBe(
      EBA_SHOCK_PRESETS.short_up_250.curveShiftBps!['2Y'],
    );
  });

  it('EBA_STRESS_PRESETS lists the 6 regulatory scenarios in grid order', () => {
    expect(EBA_STRESS_PRESETS.map((p) => p.id)).toEqual([
      'parallel_up_200',
      'parallel_down_200',
      'short_up_250',
      'short_down_250',
      'steepener',
      'flattener',
    ]);
  });
});

describe('ShockScenario satisfies the legacy PricingShocks shape', () => {
  it('every preset has numeric interestRate + liquiditySpread usable by the current motor', () => {
    for (const preset of Object.values(EBA_SHOCK_PRESETS)) {
      expect(typeof preset.interestRate).toBe('number');
      expect(typeof preset.liquiditySpread).toBe('number');
      expect(Number.isFinite(preset.interestRate)).toBe(true);
      expect(Number.isFinite(preset.liquiditySpread)).toBe(true);
    }
  });
});
