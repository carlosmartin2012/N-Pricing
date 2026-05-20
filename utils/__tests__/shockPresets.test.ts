import { describe, expect, it } from 'vitest';
import {
  EBA_SHOCK_PRESETS,
  EBA_STRESS_PRESETS,
  computeEbaCurveShift,
  ebaLongScaling,
  ebaShortScaling,
  interpolateShockShiftBps,
} from '../pricing/shockPresets';
import type { ShockTenor } from '../../types/pricingShocks';

/**
 * EBA GL 2018/02 Annex III §§ 113-115 regression suite.
 *
 * The repo carried no end-to-end validation of the 6 mandated interest-rate
 * scenarios (parallel ±200, short ±250, steepener, flattener) — `shockPresets.ts`
 * defined them but no test asserted EBA §115 properties on the output.
 *
 * These tests anchor the math directly against EBA's closed-form weightings:
 *
 *   S_short(t) = α_s × exp(−t/4)
 *   S_long(t)  = α_l × (1 − exp(−t/4))
 *   Steepener  = −0.65 × S_short + 0.90 × S_long
 *   Flattener  = +0.80 × S_short − 0.60 × S_long
 *
 * They do NOT compare against a customer-provided Excel benchmark (we have
 * none yet); when one arrives from the bank, anchor the expected values in
 * place of (or alongside) the property-based assertions below.
 */

const ALL_TENORS: ShockTenor[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '20Y'];

// EBA Table 1 EUR magnitudes (kept as expectations independent of the
// implementation constants — if the bank stresses at custom levels, those
// are covered by the parametrised tests further down).
const PARALLEL_BPS = 200;
const SHORT_BPS = 250;
const LONG_BPS = Math.round(0.6 * PARALLEL_BPS); // EBA: long magnitude = 60% of parallel

describe('EBA shock presets — §115 calibration', () => {
  describe('parallel_up_200', () => {
    it('shifts every tenor by exactly +200 bps', () => {
      const curve = computeEbaCurveShift('parallel_up_200');
      for (const tenor of ALL_TENORS) {
        expect(curve[tenor]).toBe(+PARALLEL_BPS);
      }
    });
  });

  describe('parallel_down_200', () => {
    it('shifts every tenor by exactly −200 bps', () => {
      const curve = computeEbaCurveShift('parallel_down_200');
      for (const tenor of ALL_TENORS) {
        expect(curve[tenor]).toBe(-PARALLEL_BPS);
      }
    });

    it('is the antisymmetric of parallel_up_200', () => {
      const up = computeEbaCurveShift('parallel_up_200');
      const down = computeEbaCurveShift('parallel_down_200');
      for (const tenor of ALL_TENORS) {
        expect(up[tenor]! + down[tenor]!).toBe(0);
      }
    });
  });

  describe('short_up_250', () => {
    it('matches α_s × exp(−t/4) per EBA §115 within rounding (±1 bp)', () => {
      const curve = computeEbaCurveShift('short_up_250');
      const yearsByTenor: Record<ShockTenor, number> = {
        '1M': 1 / 12, '3M': 0.25, '6M': 0.5, '1Y': 1,
        '2Y': 2, '5Y': 5, '10Y': 10, '20Y': 20,
      };
      for (const tenor of ALL_TENORS) {
        const expected = SHORT_BPS * Math.exp(-yearsByTenor[tenor] / 4);
        expect(Math.abs(curve[tenor]! - Math.round(expected))).toBeLessThanOrEqual(1);
      }
    });

    it('decays monotonically with tenor (longer = smaller shift)', () => {
      const curve = computeEbaCurveShift('short_up_250');
      for (let i = 1; i < ALL_TENORS.length; i++) {
        expect(curve[ALL_TENORS[i]!]!).toBeLessThanOrEqual(curve[ALL_TENORS[i - 1]!]!);
      }
    });

    it('1M ≈ full magnitude (within 5%), 20Y ≈ zero (within 5 bps)', () => {
      const curve = computeEbaCurveShift('short_up_250');
      expect(curve['1M']!).toBeGreaterThan(0.95 * SHORT_BPS);
      expect(Math.abs(curve['20Y']!)).toBeLessThan(5);
    });
  });

  describe('short_down_250', () => {
    it('is the antisymmetric of short_up_250 across all tenors', () => {
      const up = computeEbaCurveShift('short_up_250');
      const down = computeEbaCurveShift('short_down_250');
      for (const tenor of ALL_TENORS) {
        expect(up[tenor]! + down[tenor]!).toBe(0);
      }
    });
  });

  describe('steepener', () => {
    it('shifts short tenors negative and long tenors positive', () => {
      const curve = computeEbaCurveShift('steepener');
      expect(curve['1M']!).toBeLessThan(0);
      expect(curve['3M']!).toBeLessThan(0);
      expect(curve['20Y']!).toBeGreaterThan(0);
      expect(curve['10Y']!).toBeGreaterThan(0);
    });

    it('matches −0.65 × short + 0.90 × long within rounding', () => {
      const curve = computeEbaCurveShift('steepener');
      const yearsByTenor: Record<ShockTenor, number> = {
        '1M': 1 / 12, '3M': 0.25, '6M': 0.5, '1Y': 1,
        '2Y': 2, '5Y': 5, '10Y': 10, '20Y': 20,
      };
      for (const tenor of ALL_TENORS) {
        const t = yearsByTenor[tenor];
        const expected =
          -0.65 * SHORT_BPS * Math.exp(-t / 4) +
          0.90 * LONG_BPS * (1 - Math.exp(-t / 4));
        expect(Math.abs(curve[tenor]! - Math.round(expected))).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('flattener', () => {
    it('shifts short tenors positive and long tenors negative', () => {
      const curve = computeEbaCurveShift('flattener');
      expect(curve['1M']!).toBeGreaterThan(0);
      expect(curve['3M']!).toBeGreaterThan(0);
      expect(curve['20Y']!).toBeLessThan(0);
      expect(curve['10Y']!).toBeLessThan(0);
    });

    it('is the antisymmetric of steepener at the short and long extremes', () => {
      // Sign-mirror only — magnitudes differ because EBA uses asymmetric
      // weights (steepener: 0.65/0.90 · flattener: 0.80/0.60).
      const steep = computeEbaCurveShift('steepener');
      const flat = computeEbaCurveShift('flattener');
      expect(Math.sign(steep['1M']!)).toBe(-Math.sign(flat['1M']!));
      expect(Math.sign(steep['20Y']!)).toBe(-Math.sign(flat['20Y']!));
    });
  });

  describe('base and custom (no curve)', () => {
    it('return an empty curve shift map', () => {
      expect(computeEbaCurveShift('base')).toEqual({});
      expect(computeEbaCurveShift('custom')).toEqual({});
    });
  });

  describe('parametrised magnitudes', () => {
    it('honours a custom parallel magnitude (bank stresses at ±300 bp)', () => {
      const curve = computeEbaCurveShift('parallel_up_200', { parallelBps: 300 });
      for (const tenor of ALL_TENORS) {
        expect(curve[tenor]).toBe(+300);
      }
    });

    it('honours a custom short magnitude (bank stresses at ±400 bp)', () => {
      const curve = computeEbaCurveShift('short_up_250', { shortBps: 400 });
      expect(curve['1M']!).toBeGreaterThan(0.95 * 400);
      expect(curve['1M']!).toBeLessThanOrEqual(400);
    });
  });
});

describe('EBA scaling functions — §115 invariants', () => {
  it('short(0) = 1 exactly', () => {
    expect(ebaShortScaling(0)).toBe(1);
  });

  it('long(0) = 0 exactly', () => {
    expect(ebaLongScaling(0)).toBe(0);
  });

  it('short + long = 1 for every tenor (partition identity)', () => {
    for (const t of [0.083, 0.25, 0.5, 1, 2, 5, 10, 20, 30]) {
      expect(ebaShortScaling(t) + ebaLongScaling(t)).toBeCloseTo(1, 12);
    }
  });

  it('short is strictly decreasing in tenor', () => {
    const samples = [0.5, 1, 2, 5, 10, 20].map(ebaShortScaling);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeLessThan(samples[i - 1]!);
    }
  });

  it('long is strictly increasing in tenor', () => {
    const samples = [0.5, 1, 2, 5, 10, 20].map(ebaLongScaling);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThan(samples[i - 1]!);
    }
  });

  it('short asymptotes to 0 and long asymptotes to 1 at very long tenors', () => {
    expect(ebaShortScaling(100)).toBeLessThan(0.001);
    expect(ebaLongScaling(100)).toBeGreaterThan(0.999);
  });
});

describe('EBA presets registry', () => {
  it('exposes all 6 stress scenarios in the iteration helper', () => {
    expect(EBA_STRESS_PRESETS).toHaveLength(6);
    const ids = EBA_STRESS_PRESETS.map((s) => s.id);
    expect(ids).toEqual([
      'parallel_up_200', 'parallel_down_200',
      'short_up_250', 'short_down_250',
      'steepener', 'flattener',
    ]);
  });

  it('every stress preset is sourced as preset_eba_2018_02 (audit trail)', () => {
    for (const preset of EBA_STRESS_PRESETS) {
      expect(preset.source).toBe('preset_eba_2018_02');
    }
  });

  it('base scenario carries a null curve shift (no stress applied)', () => {
    expect(EBA_SHOCK_PRESETS.base.curveShiftBps).toBeNull();
    expect(EBA_SHOCK_PRESETS.base.interestRate).toBe(0);
  });
});

describe('interpolateShockShiftBps', () => {
  const shifts = computeEbaCurveShift('short_up_250');

  it('returns 0 when the shifts map is empty (base / custom)', () => {
    expect(interpolateShockShiftBps({}, 24)).toBe(0);
  });

  it('returns the exact bucket value when months matches a bucket', () => {
    expect(interpolateShockShiftBps(shifts, 24)).toBe(shifts['2Y']);
    expect(interpolateShockShiftBps(shifts, 12)).toBe(shifts['1Y']);
  });

  it('flat-extrapolates below the shortest tenor', () => {
    expect(interpolateShockShiftBps(shifts, 0)).toBe(shifts['1M']);
  });

  it('flat-extrapolates above the longest tenor', () => {
    expect(interpolateShockShiftBps(shifts, 600)).toBe(shifts['20Y']);
  });

  it('linearly interpolates between adjacent buckets', () => {
    // Half-way between 1Y (12mo) and 2Y (24mo) → mean of the two
    const expected = (shifts['1Y']! + shifts['2Y']!) / 2;
    expect(interpolateShockShiftBps(shifts, 18)).toBeCloseTo(expected, 6);
  });
});
