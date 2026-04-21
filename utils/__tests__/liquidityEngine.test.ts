import { describe, it, expect } from 'vitest';
import type { Transaction, SDRConfig, DualLiquidityCurve } from '../../types';
import {
  interpolateLiquidityCurve,
  applySDRModulation,
  classifyDepositStability,
  calculateLCRCharge,
} from '../pricing/liquidityEngine';

/**
 * Coverage booster for the liquidity bounded context (Ola C-4 preview).
 * Exercises the four pure entry points — curve interpolation, SDR
 * modulation, deposit stability classification, LCR charge — with
 * boundary conditions (zero, fallback paths, invalid inputs).
 */

function deal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'd-1',
    status: 'Draft',
    productType: 'LOAN_COMM',
    currency: 'EUR',
    amount: 1_000_000,
    businessUnit: 'BU_01',
    clientId: 'C-1',
    clientType: 'Corporate',
    startDate: '2026-01-01',
    durationMonths: 60,
    marginTarget: 0.5,
    capitalRatio: 8,
    riskWeight: 100,
    ...overrides,
  } as Transaction;
}

describe('interpolateLiquidityCurve', () => {
  const makeCurve = (currency: string, curveType: 'unsecured' | 'secured', points: Array<{ tenor: string; termLP: number }>): DualLiquidityCurve => ({
    currency,
    curveType,
    lastUpdate: '2026-01-01',
    points: points as DualLiquidityCurve['points'],
  });

  it('returns 0 for empty curve collection', () => {
    expect(interpolateLiquidityCurve([], 'EUR', 12)).toBe(0);
  });

  it('interpolates within bracket', () => {
    const curves = [makeCurve('EUR', 'unsecured', [
      { tenor: '1M', termLP: 20 },
      { tenor: '1Y', termLP: 60 },
    ])];
    const mid = interpolateLiquidityCurve(curves, 'EUR', 6);
    // Between 20 and 60 → should be strictly within
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(60);
  });

  it('falls back to same currency when curveType not found', () => {
    const curves = [
      makeCurve('EUR', 'secured', [{ tenor: '1Y', termLP: 45 }]),
    ];
    const val = interpolateLiquidityCurve(curves, 'EUR', 12, 'unsecured');
    expect(val).toBeGreaterThan(0);
  });

  it('falls back to first curve when currency not found', () => {
    const curves = [
      makeCurve('USD', 'unsecured', [{ tenor: '1Y', termLP: 30 }]),
    ];
    const val = interpolateLiquidityCurve(curves, 'EUR', 12);
    expect(val).toBe(30);
  });

  it('ignores unknown tenors rather than collapsing them', () => {
    const curves = [makeCurve('EUR', 'unsecured', [
      { tenor: '1M', termLP: 20 },
      { tenor: 'WHAT', termLP: 999 } as DualLiquidityCurve['points'][number],
      { tenor: '1Y', termLP: 60 },
    ])];
    const val = interpolateLiquidityCurve(curves, 'EUR', 6);
    expect(val).toBeLessThan(70);
  });
});

describe('applySDRModulation', () => {
  const cfg = (overrides: Partial<SDRConfig> = {}): SDRConfig => ({
    stableDepositRatio: 0.75,
    sdrFloor: 0.60,
    sdrImpactMultiplier: 1.5,
    externalFundingPct: 0.20,
    ...overrides,
  });

  it('returns lp unchanged when no config provided', () => {
    expect(applySDRModulation(42, undefined)).toBe(42);
  });

  it('reduces lp when stable ratio exceeds floor', () => {
    const out = applySDRModulation(100, cfg({ stableDepositRatio: 0.80, sdrFloor: 0.60 }));
    expect(out).toBeLessThan(100);
  });

  it('clamps modulator at 0.5 (so lp never halves more than that)', () => {
    const out = applySDRModulation(100, cfg({ stableDepositRatio: 1, sdrFloor: 0, sdrImpactMultiplier: 100 }));
    expect(out).toBe(50);
  });

  it('does not modulate when ratio below floor', () => {
    const out = applySDRModulation(50, cfg({ stableDepositRatio: 0.20, sdrFloor: 0.60 }));
    expect(out).toBe(50);
  });
});

describe('classifyDepositStability', () => {
  it('respects explicit deal.depositStability', () => {
    expect(classifyDepositStability(deal({ depositStability: 'Stable' }))).toBe('Stable');
  });

  it('Operational segment → Stable', () => {
    expect(classifyDepositStability(deal({ isOperationalSegment: true }))).toBe('Stable');
  });

  it('Retail / SME → Semi_Stable', () => {
    expect(classifyDepositStability(deal({ clientType: 'Retail' }))).toBe('Semi_Stable');
    expect(classifyDepositStability(deal({ clientType: 'SME' }))).toBe('Semi_Stable');
  });

  it('Institutional / Corporate default → Non_Stable', () => {
    expect(classifyDepositStability(deal({ clientType: 'Corporate' }))).toBe('Non_Stable');
    expect(classifyDepositStability(deal({ clientType: 'Institution' }))).toBe('Non_Stable');
  });
});

describe('calculateLCRCharge — fallbacks', () => {
  it('returns 0 for a loan with no applicable LCR fields', () => {
    expect(calculateLCRCharge(deal({ productType: 'LOAN_COMM' }))).toBe(0);
  });

  it('uses deal.lcrOutflowPct as last resort', () => {
    const charge = calculateLCRCharge(deal({
      productType: 'DEPOSIT_UNKNOWN',
      lcrOutflowPct: 20,
    }));
    expect(charge).toBeGreaterThan(0);
  });
});
