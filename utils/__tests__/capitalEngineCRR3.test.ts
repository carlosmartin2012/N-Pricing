import { describe, it, expect } from 'vitest';
import {
  getOutputFloorFactor,
  calculateCapitalWithOutputFloor,
  calculateBufferedCapitalCharge,
  CRR3_OUTPUT_FLOOR_SCHEDULE,
} from '../pricing/capitalEngineCRR3';

// ── Output floor phase-in schedule ───────────────────────────────────────────

describe('getOutputFloorFactor', () => {
  it('returns 0 for years before 2025', () => {
    expect(getOutputFloorFactor(2024)).toBe(0);
    expect(getOutputFloorFactor(2000)).toBe(0);
  });

  it('returns the exact scheduled factor for each phase-in year', () => {
    expect(getOutputFloorFactor(2025)).toBeCloseTo(0.500, 3);
    expect(getOutputFloorFactor(2026)).toBeCloseTo(0.550, 3);
    expect(getOutputFloorFactor(2027)).toBeCloseTo(0.600, 3);
    expect(getOutputFloorFactor(2028)).toBeCloseTo(0.650, 3);
    expect(getOutputFloorFactor(2029)).toBeCloseTo(0.700, 3);
    expect(getOutputFloorFactor(2030)).toBeCloseTo(0.725, 3);
  });

  it('returns the steady-state 72.5% for years beyond 2030', () => {
    expect(getOutputFloorFactor(2031)).toBeCloseTo(0.725, 3);
    expect(getOutputFloorFactor(2035)).toBeCloseTo(0.725, 3);
    expect(getOutputFloorFactor(2050)).toBeCloseTo(0.725, 3);
  });

  it('exposes the full schedule as a constant', () => {
    expect(CRR3_OUTPUT_FLOOR_SCHEDULE[2025]).toBe(0.500);
    expect(CRR3_OUTPUT_FLOOR_SCHEDULE[2030]).toBe(0.725);
  });
});

// ── Output floor binding logic ───────────────────────────────────────────────

describe('calculateCapitalWithOutputFloor — output floor binding', () => {
  it('binds the output floor when factor × SA > IRB', () => {
    // 2030 steady state: 72.5% × 100 = 72.5 > IRB 50 → floor binds
    const result = calculateCapitalWithOutputFloor({
      ead: 100,
      rwaStandardized: 100,
      rwaIrb: 50,
      year: 2030,
    });
    expect(result.outputFloorBinding).toBe(true);
    expect(result.effectiveRwa).toBeCloseTo(72.5, 2);
    expect(result.outputFloorFactor).toBeCloseTo(0.725, 3);
  });

  it('does NOT bind the floor when IRB > factor × SA', () => {
    // 2025: 50% × 100 = 50 < IRB 80 → IRB wins
    const result = calculateCapitalWithOutputFloor({
      ead: 100,
      rwaStandardized: 100,
      rwaIrb: 80,
      year: 2025,
    });
    expect(result.outputFloorBinding).toBe(false);
    expect(result.effectiveRwa).toBeCloseTo(80, 2);
  });

  it('does NOT apply flooring when bank is not IRB (rwaIrb undefined)', () => {
    const result = calculateCapitalWithOutputFloor({
      ead: 100,
      rwaStandardized: 100,
      year: 2030,
    });
    expect(result.outputFloorBinding).toBe(false);
    expect(result.effectiveRwa).toBeCloseTo(100, 2);
  });

  it('does NOT apply flooring when rwaIrb is zero', () => {
    const result = calculateCapitalWithOutputFloor({
      ead: 100,
      rwaStandardized: 100,
      rwaIrb: 0,
      year: 2030,
    });
    expect(result.outputFloorBinding).toBe(false);
    expect(result.effectiveRwa).toBeCloseTo(100, 2);
  });
});

// ── Buffer stack summation ───────────────────────────────────────────────────

describe('calculateCapitalWithOutputFloor — buffer stack', () => {
  it('sums the full buffer stack with defaults', () => {
    // Defaults: P1 8 + P2R 2 + CCB 2.5 + CCyB 1 + SIFI 0 + mgmt 1.5 = 15%
    const result = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      year: 2025,
    });
    expect(result.totalCapitalRatio).toBeCloseTo(15.0, 2);
    // 500.000 × 15% = 75.000
    expect(result.totalCapitalRequired).toBeCloseTo(75_000, 2);
  });

  it('applies SIFI buffer as max(G-SII, O-SII, SyB)', () => {
    const result = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 100_000,
      year: 2025,
      buffers: {
        gSIIBuffer: 2.0,
        oSIIBuffer: 1.5,
        systemicRiskBuffer: 1.0,
      },
    });
    // max(1.0, 2.0, 1.5) = 2.0
    expect(result.buffersBreakdown.sifiBuffer).toBeCloseTo(2.0, 2);
    // Total = 8 + 2 + 2.5 + 1 + 2 + 1.5 = 17%
    expect(result.totalCapitalRatio).toBeCloseTo(17.0, 2);
  });

  it('applies custom Pillar 2 and management buffers', () => {
    const result = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 200_000,
      year: 2025,
      buffers: {
        pillar2Requirement: 3.5,
        managementBuffer: 2.0,
      },
    });
    // 8 + 3.5 + 2.5 + 1 + 0 + 2 = 17%
    expect(result.totalCapitalRatio).toBeCloseTo(17.0, 2);
    expect(result.buffersBreakdown.pillar2Requirement).toBeCloseTo(3.5, 2);
    expect(result.buffersBreakdown.managementBuffer).toBeCloseTo(2.0, 2);
  });

  it('breaks down each buffer component correctly', () => {
    const result = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 100_000,
      year: 2026,
    });
    expect(result.buffersBreakdown.pillar1).toBeCloseTo(8.0, 2);
    expect(result.buffersBreakdown.pillar2Requirement).toBeCloseTo(2.0, 2);
    expect(result.buffersBreakdown.conservationBuffer).toBeCloseTo(2.5, 2);
    expect(result.buffersBreakdown.countercyclicalBuffer).toBeCloseTo(1.0, 2);
    expect(result.buffersBreakdown.managementBuffer).toBeCloseTo(1.5, 2);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('calculateCapitalWithOutputFloor — edge cases', () => {
  it('handles zero EAD without dividing by zero', () => {
    const capital = calculateCapitalWithOutputFloor({
      ead: 0,
      rwaStandardized: 0,
      year: 2025,
    });
    expect(capital.effectiveRwa).toBe(0);
    expect(capital.totalCapitalRequired).toBe(0);
  });
});

// ── Capital charge conversion ────────────────────────────────────────────────

describe('calculateBufferedCapitalCharge', () => {
  it('computes positive charge when targetROE > riskFreeRate', () => {
    const capital = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      year: 2025,
    });
    // capital = 500k × 15% = 75k; per unit EAD = 0.075; spread = 0.10 - 0.03 = 0.07
    // charge = 0.075 × 0.07 = 0.00525 (0.525%)
    const charge = calculateBufferedCapitalCharge(capital, 1_000_000, 0.10, 0.03);
    expect(charge).toBeCloseTo(0.00525, 5);
  });

  it('returns 0 when targetROE equals riskFreeRate', () => {
    const capital = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      year: 2025,
    });
    expect(calculateBufferedCapitalCharge(capital, 1_000_000, 0.05, 0.05)).toBe(0);
  });

  it('returns 0 when targetROE is below riskFreeRate (floored at 0)', () => {
    const capital = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      year: 2025,
    });
    expect(calculateBufferedCapitalCharge(capital, 1_000_000, 0.02, 0.05)).toBe(0);
  });

  it('returns 0 for zero EAD', () => {
    const capital = calculateCapitalWithOutputFloor({
      ead: 0,
      rwaStandardized: 0,
      year: 2025,
    });
    expect(calculateBufferedCapitalCharge(capital, 0, 0.10, 0.03)).toBe(0);
  });

  it('scales charge with effective RWA when output floor binds', () => {
    // Without IRB — SA applies directly
    const capitalSA = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      year: 2030,
    });
    // With IRB low enough for floor to bind (72.5% × 500k = 362.5k > 200k IRB)
    const capitalFloored = calculateCapitalWithOutputFloor({
      ead: 1_000_000,
      rwaStandardized: 500_000,
      rwaIrb: 200_000,
      year: 2030,
    });
    expect(capitalFloored.outputFloorBinding).toBe(true);
    expect(capitalFloored.effectiveRwa).toBeCloseTo(362_500, 2);
    const chargeSA = calculateBufferedCapitalCharge(capitalSA, 1_000_000, 0.10, 0.03);
    const chargeFloored = calculateBufferedCapitalCharge(capitalFloored, 1_000_000, 0.10, 0.03);
    // Floored charge should be less than SA charge but more than pure IRB
    expect(chargeFloored).toBeLessThan(chargeSA);
    expect(chargeFloored).toBeGreaterThan(0);
  });
});
