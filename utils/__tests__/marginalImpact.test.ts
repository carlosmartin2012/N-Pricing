import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types';
import { computeMarginalImpact } from '../portfolio/marginalImpact';

const baseDeal: Transaction = {
  clientId: 'c-1',
  clientType: 'Corporate',
  businessUnit: 'RM',
  fundingBusinessUnit: 'Treasury',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'EUR',
  amount: 1_000_000,
  startDate: '2026-04-13',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 1.5,
  riskWeight: 1,
  capitalRatio: 0.08,
  targetROE: 12,
  operationalCostBps: 15,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  lcrOutflowPct: 10,
};

const mk = (overrides: Partial<Transaction>): Transaction => ({ ...baseDeal, ...overrides });

describe('computeMarginalImpact', () => {
  it('adds RWA in proportion to amount × riskWeight', () => {
    const portfolio = [mk({ id: 'd-1', amount: 1_000_000 })];
    const candidate = mk({ amount: 2_000_000, riskWeight: 0.75 });
    const impact = computeMarginalImpact(candidate, portfolio);
    expect(impact.delta.rwa).toBe(2_000_000 * 0.75);
    expect(impact.isRwaIncreasing).toBe(true);
  });

  it('detects concentration increase when adding to same client', () => {
    const portfolio = [
      mk({ id: 'd-1', clientId: 'c-big', amount: 5_000_000 }),
      mk({ id: 'd-2', clientId: 'c-small', amount: 1_000_000 }),
    ];
    const candidate = mk({ clientId: 'c-big', amount: 3_000_000 });
    const impact = computeMarginalImpact(candidate, portfolio);
    expect(impact.isConcentrationIncreasing).toBe(true);
    expect(impact.delta.herfindahlByClient).toBeGreaterThan(0);
  });

  it('concentration decreases when deal diversifies', () => {
    const portfolio = [mk({ id: 'd-1', clientId: 'c-big', amount: 10_000_000 })];
    const candidate = mk({ clientId: 'c-new', amount: 5_000_000 });
    const impact = computeMarginalImpact(candidate, portfolio);
    expect(impact.delta.herfindahlByClient).toBeLessThan(0);
  });

  it('excludes existing same-id deal from before (edit scenario)', () => {
    const existingId = 'd-edit';
    const portfolio = [mk({ id: existingId, amount: 1_000_000, riskWeight: 1 })];
    const candidate = mk({ id: existingId, amount: 2_000_000, riskWeight: 1 });
    const impact = computeMarginalImpact(candidate, portfolio);
    // Before: 1M × 1 = 1M, After: 2M × 1 = 2M, delta = 1M
    expect(impact.delta.rwa).toBe(1_000_000);
  });

  it('applies NSFR floor factor by tenor bucket', () => {
    const portfolio: Transaction[] = [];
    const short = computeMarginalImpact(mk({ durationMonths: 3, amount: 1_000_000 }), portfolio);
    const medium = computeMarginalImpact(mk({ durationMonths: 9, amount: 1_000_000 }), portfolio);
    const long = computeMarginalImpact(mk({ durationMonths: 24, amount: 1_000_000 }), portfolio);
    expect(short.delta.nsfrFloor).toBe(150_000);   // 15% factor
    expect(medium.delta.nsfrFloor).toBe(500_000);  // 50% factor
    expect(long.delta.nsfrFloor).toBe(650_000);    // 65% factor
  });

  it('LCR outflow scales by lcrOutflowPct', () => {
    const impact = computeMarginalImpact(
      mk({ amount: 5_000_000, lcrOutflowPct: 25 }),
      [],
    );
    expect(impact.delta.lcrOutflow).toBe(1_250_000);
  });

  it('handles empty portfolio', () => {
    const impact = computeMarginalImpact(mk({ amount: 1_000_000 }), []);
    expect(impact.before.totalRwa).toBe(0);
    expect(impact.after.totalRwa).toBe(1_000_000);
  });
});
