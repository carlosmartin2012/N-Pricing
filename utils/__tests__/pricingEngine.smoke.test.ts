import { describe, it, expect } from 'vitest';
import { core } from '../pricing';
import type { Transaction, ApprovalMatrixConfig } from '../../types';
import type { PricingContext } from '../pricingEngine';

// Empty context — every field is optional-empty so the engine falls back
// to the built-in mocks (MOCK_YIELD_CURVE, etc.). Typed via `as unknown as`
// because PricingContext marks the arrays as required but calculatePricing
// tolerates missing ones in practice.
const EMPTY_CTX: PricingContext = {
  yieldCurve: [], liquidityCurves: [], rules: [], rateCards: [],
  transitionGrid: [], physicalGrid: [], greeniumGrid: [],
  behaviouralModels: [], products: [], clients: [], businessUnits: [],
} as unknown as PricingContext;

/**
 * End-to-end smoke for the pricing orchestrator surface exposed via the
 * core bounded context (Ola C-7).
 *
 * Goal: catch the regression "Ola C-x barrel broke because some flat
 * module stopped compiling". Uses the canonical fallback-to-mocks path
 * (no DB, no real context) and just asserts the result shape.
 */

const matrix: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
  autoApprovalEvaBp: 200,
  l1EvaBp: 0,
  l2EvaBp: -100,
};

function baseDeal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'smoke',
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

describe('pricing.core.calculatePricing smoke', () => {
  it('returns a stable FTPResult shape for a well-formed deal', () => {
    const result = core.calculatePricing(baseDeal(), matrix);
    expect(result).toBeDefined();
    expect(typeof result.totalFTP).toBe('number');
    expect(typeof result.finalClientRate).toBe('number');
    expect(typeof result.raroc).toBe('number');
  });

  it('returns EMPTY_RESULT equivalent for zero-amount deal', () => {
    const result = core.calculatePricing(baseDeal({ amount: 0 }), matrix);
    expect(result.totalFTP).toBe(0);
    expect(result.finalClientRate).toBe(0);
  });

  it('guards against NaN/Infinity in amount', () => {
    const result = core.calculatePricing(baseDeal({ amount: NaN }), matrix);
    expect(Number.isFinite(result.totalFTP)).toBe(true);
  });

  it('batchReprice handles empty array', () => {
    const results = core.batchReprice([], matrix, EMPTY_CTX);
    expect(results.size).toBe(0);
  });

  it('batchReprice returns one entry per valid deal', () => {
    const deals = [baseDeal({ id: 'd1' }), baseDeal({ id: 'd2', amount: 500_000 })];
    const results = core.batchReprice(deals, matrix, EMPTY_CTX);
    expect(results.size).toBe(2);
    expect(results.has('d1')).toBe(true);
    expect(results.has('d2')).toBe(true);
  });

  it('DEFAULT_PRICING_SHOCKS is a stable object (not mutated by call)', () => {
    const before = JSON.stringify(core.DEFAULT_PRICING_SHOCKS);
    core.calculatePricing(baseDeal(), matrix);
    const after = JSON.stringify(core.DEFAULT_PRICING_SHOCKS);
    expect(after).toBe(before);
  });
});
