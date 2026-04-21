import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types';
import {
  inferFormulaFromProduct,
  calculateCreditCost,
  getClientRating,
} from '../pricing/formulaEngine';

/**
 * Coverage for the pure branches of formulaEngine:
 *   - inferFormulaFromProduct (product-type → formula dispatcher)
 *   - calculateCreditCost (rating → bps via CREDIT_PARAMS)
 *   - getClientRating (client lookup with fallback)
 *
 * The bigger applyProductFormula is exercised indirectly via the
 * pricingEngine integration tests.
 */

function deal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'd-1', status: 'Draft',
    productType: 'LOAN_COMM', currency: 'EUR', amount: 1_000_000,
    businessUnit: 'BU_01', clientId: 'C-1', clientType: 'Corporate',
    startDate: '2026-01-01', durationMonths: 60,
    marginTarget: 0.5, capitalRatio: 8, riskWeight: 100,
    ...overrides,
  } as Transaction;
}

describe('inferFormulaFromProduct', () => {
  it('Liability → BM with negative sign', () => {
    const spec = inferFormulaFromProduct(deal({ category: 'Liability' }));
    expect(spec.baseRateKey).toBe('BM');
    expect(spec.sign).toBe(-1);
  });

  it('Off-Balance → DTM positive', () => {
    const spec = inferFormulaFromProduct(deal({ category: 'Off-Balance' }));
    expect(spec.baseRateKey).toBe('DTM');
    expect(spec.sign).toBe(1);
  });

  it('Secured asset → SECURED_LP curveType', () => {
    const spec = inferFormulaFromProduct(deal({ collateralType: 'Real_Estate' }));
    expect(spec.lpFormula).toBe('SECURED_LP');
    expect(spec.lpCurveType).toBe('secured');
  });

  it('Short-term corporate asset (<12m) → 50/50 split', () => {
    const spec = inferFormulaFromProduct(deal({ durationMonths: 6 }));
    expect(spec.lpFormula).toBe('50_50_DTM_1Y');
  });

  it('Long-term asset default → MIN_BM_RM + LP_BM', () => {
    const spec = inferFormulaFromProduct(deal({ durationMonths: 60 }));
    expect(spec.baseRateKey).toBe('MIN_BM_RM');
    expect(spec.lpFormula).toBe('LP_BM');
  });
});

describe('calculateCreditCost', () => {
  it('returns a finite non-negative number for valid ratings', () => {
    const ratings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B'];
    for (const r of ratings) {
      const cost = calculateCreditCost(r);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('weaker rating → higher cost (monotonicity)', () => {
    const aaa = calculateCreditCost('AAA');
    const bb = calculateCreditCost('BB');
    expect(bb).toBeGreaterThanOrEqual(aaa);
  });

  it('unknown rating does not crash', () => {
    const cost = calculateCreditCost('UNKNOWN-XYZ');
    expect(Number.isFinite(cost)).toBe(true);
  });
});

describe('getClientRating', () => {
  const clients = [
    { id: 'C-1', name: 'Alpha', type: 'Corporate' as const, segment: 'Large', rating: 'A' },
    { id: 'C-2', name: 'Beta',  type: 'SME' as const,        segment: 'Mid',   rating: 'BB' },
  ];

  it('resolves the rating of an existing client', () => {
    expect(getClientRating('C-1', clients)).toBe('A');
    expect(getClientRating('C-2', clients)).toBe('BB');
  });

  it('falls back to a default rating for unknown clients', () => {
    const r = getClientRating('DOES-NOT-EXIST', clients);
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });
});
