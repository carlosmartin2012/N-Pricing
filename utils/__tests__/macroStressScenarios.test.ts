import { describe, it, expect } from 'vitest';
import {
  MACRO_SCENARIOS,
  stressedPd,
  stressedLgd,
  stressedCollateralValue,
  toPricingShocks,
  type MacroScenario,
} from '../pricing/macroStressScenarios';

describe('MACRO_SCENARIOS registry', () => {
  const expectedIds = [
    'BASELINE',
    'ADVERSE_MILD',
    'ADVERSE_SEVERE',
    'LIQUIDITY_STRESS',
    'RATE_SHOCK_UP',
    'RATE_SHOCK_DOWN',
  ];

  it.each(expectedIds)('contains scenario %s with consistent id', (id) => {
    const scenario = MACRO_SCENARIOS[id];
    expect(scenario).toBeDefined();
    expect(scenario.id).toBe(id);
    expect(typeof scenario.label).toBe('string');
    expect(typeof scenario.description).toBe('string');
    expect(typeof scenario.interestRateShift).toBe('number');
    expect(typeof scenario.liquiditySpreadShock).toBe('number');
    expect(typeof scenario.pdMultiplier).toBe('number');
    expect(typeof scenario.lgdMultiplier).toBe('number');
    expect(typeof scenario.hpiShock).toBe('number');
    expect(typeof scenario.gdpShock).toBe('number');
    expect(typeof scenario.unemploymentShock).toBe('number');
  });

  it('BASELINE applies no stress at all', () => {
    const s = MACRO_SCENARIOS.BASELINE;
    expect(s.interestRateShift).toBe(0);
    expect(s.liquiditySpreadShock).toBe(0);
    expect(s.pdMultiplier).toBe(1);
    expect(s.lgdMultiplier).toBe(1);
    expect(s.hpiShock).toBe(0);
    expect(s.gdpShock).toBe(0);
    expect(s.unemploymentShock).toBe(0);
  });

  it('ADVERSE_SEVERE matches EBA severe template (+200bp, HPI -20%, PD x2.5)', () => {
    const s = MACRO_SCENARIOS.ADVERSE_SEVERE;
    expect(s.interestRateShift).toBe(200);
    expect(s.hpiShock).toBeCloseTo(-0.2, 6);
    expect(s.pdMultiplier).toBe(2.5);
  });
});

describe('stressedPd', () => {
  const severe: MacroScenario = MACRO_SCENARIOS.ADVERSE_SEVERE;

  it('multiplies PD by the scenario multiplier', () => {
    expect(stressedPd(0.02, severe)).toBeCloseTo(0.05, 6);
  });

  it('clamps at 99.9% for extreme inputs', () => {
    expect(stressedPd(0.9, severe)).toBe(0.999);
    expect(stressedPd(1.5, severe)).toBe(0.999);
  });

  it('is a no-op under BASELINE', () => {
    expect(stressedPd(0.03, MACRO_SCENARIOS.BASELINE)).toBe(0.03);
  });
});

describe('stressedLgd', () => {
  it('multiplies LGD by the scenario multiplier', () => {
    expect(stressedLgd(0.4, MACRO_SCENARIOS.ADVERSE_MILD)).toBeCloseTo(0.44, 6);
  });

  it('clamps at 100%', () => {
    expect(stressedLgd(0.95, MACRO_SCENARIOS.ADVERSE_SEVERE)).toBe(1);
    expect(stressedLgd(2.0, MACRO_SCENARIOS.ADVERSE_SEVERE)).toBe(1);
  });
});

describe('stressedCollateralValue', () => {
  it('applies -20% HPI shock for ADVERSE_SEVERE', () => {
    const stressed = stressedCollateralValue(1_000_000, MACRO_SCENARIOS.ADVERSE_SEVERE);
    expect(stressed).toBeCloseTo(800_000, 6);
  });

  it('is a no-op under BASELINE', () => {
    expect(stressedCollateralValue(500_000, MACRO_SCENARIOS.BASELINE)).toBe(500_000);
  });

  it('floors negative values at 0', () => {
    const degenerate: MacroScenario = { ...MACRO_SCENARIOS.BASELINE, hpiShock: -2 };
    expect(stressedCollateralValue(100_000, degenerate)).toBe(0);
  });
});

describe('toPricingShocks', () => {
  it('round-trips rate/liquidity fields from the scenario', () => {
    const shocks = toPricingShocks(MACRO_SCENARIOS.ADVERSE_SEVERE);
    expect(shocks.interestRate).toBe(200);
    expect(shocks.liquiditySpread).toBe(100);
  });

  it('returns zeros for BASELINE', () => {
    const shocks = toPricingShocks(MACRO_SCENARIOS.BASELINE);
    expect(shocks.interestRate).toBe(0);
    expect(shocks.liquiditySpread).toBe(0);
  });
});
