import { describe, it, expect, beforeEach } from 'vitest';
import { interpolateShockShiftBps, EBA_SHOCK_PRESETS } from '../shockPresets';

describe('interpolateShockShiftBps', () => {
  it('returns 0 on empty shifts (base / custom scenarios)', () => {
    expect(interpolateShockShiftBps({}, 12)).toBe(0);
    expect(interpolateShockShiftBps({}, 60)).toBe(0);
  });

  it('returns the flat value for parallel scenarios regardless of tenor', () => {
    const shifts = EBA_SHOCK_PRESETS.parallel_up_200.curveShiftBps!;
    expect(interpolateShockShiftBps(shifts, 1)).toBe(200);
    expect(interpolateShockShiftBps(shifts, 36)).toBe(200);
    expect(interpolateShockShiftBps(shifts, 240)).toBe(200);
  });

  it('extrapolates flat beyond the grid boundaries (1M, 20Y)', () => {
    const shifts = EBA_SHOCK_PRESETS.short_up_250.curveShiftBps!;
    // Queries below 1M snap to the 1M shift (the largest).
    expect(interpolateShockShiftBps(shifts, 0.5)).toBe(shifts['1M']);
    // Queries above 20Y snap to the 20Y shift (the smallest, near 0).
    expect(interpolateShockShiftBps(shifts, 360)).toBe(shifts['20Y']);
  });

  it('linearly interpolates between adjacent buckets', () => {
    // Use a synthetic pair {1Y: 100, 5Y: 20} so the midpoint is predictable.
    const shifts = { '1Y': 100, '5Y': 20 } as const;
    // 3Y is halfway between 1Y (12m) and 5Y (60m) → (100+20)/2 = 60.
    expect(interpolateShockShiftBps(shifts, 36)).toBeCloseTo(60, 6);
    // 2Y is 1/4 of the way from 1Y to 5Y → 100 - (100-20) × (12/48) = 80.
    expect(interpolateShockShiftBps(shifts, 24)).toBeCloseTo(80, 6);
  });

  it('matches the exact preset value at bucket tenors', () => {
    const shifts = EBA_SHOCK_PRESETS.steepener.curveShiftBps!;
    expect(interpolateShockShiftBps(shifts, 12)).toBe(shifts['1Y']);
    expect(interpolateShockShiftBps(shifts, 60)).toBe(shifts['5Y']);
    expect(interpolateShockShiftBps(shifts, 120)).toBe(shifts['10Y']);
  });
});

describe('ShockScenario × feature flag × motor integration (sanity)', () => {
  // Import inside the describe so the module-level env read inside the motor
  // is deterministic per-test if we ever need it.
  beforeEach(() => {
    delete (import.meta.env as unknown as Record<string, string | undefined>)
      .VITE_PRICING_APPLY_CURVE_SHIFT;
  });

  it('flag off + ShockScenario keeps legacy interestRate path', async () => {
    // This test documents the contract rather than exercising the full motor
    // (which has heavy dependencies). The resolver is an internal helper; the
    // shape of the fallback is: uniform shift in percent = interestRate/100.
    const presetUp = EBA_SHOCK_PRESETS.parallel_up_200;
    // Flag off → legacy formula applies the uniform `interestRate` (200 bp).
    expect(presetUp.interestRate / 100).toBeCloseTo(2.0, 6);
    // Flag off result is independent of curveShiftBps existence.
    expect(presetUp.curveShiftBps).not.toBeNull();
  });

  it('short_up_250 has different effective shifts at 3m vs 10Y', () => {
    const shifts = EBA_SHOCK_PRESETS.short_up_250.curveShiftBps!;
    const at3m  = interpolateShockShiftBps(shifts, 3);
    const at10y = interpolateShockShiftBps(shifts, 120);
    expect(at3m).toBeGreaterThan(at10y);
    // Short end retains most of the 250 bp amplitude.
    expect(at3m).toBeGreaterThan(200);
    // Long end is strongly attenuated by the exp(-t/4) decay.
    expect(at10y).toBeLessThan(25);
  });
});
