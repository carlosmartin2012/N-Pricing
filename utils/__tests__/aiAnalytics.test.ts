import { describe, it, expect } from 'vitest';
import {
  getSimilarDealSuggestions,
  detectPortfolioAnomalies,
  classifyDealRisk,
} from '../aiAnalytics';
import type { Transaction } from '../../types';

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset' as const,
  currency: 'EUR',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 36,
  amortization: 'Bullet' as const,
  repricingFreq: 'Fixed' as const,
  marginTarget: 0.015,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  transitionRisk: 'Neutral' as const,
  physicalRisk: 'Low' as const,
  status: 'Approved' as const,
};

let _counter = 0;
function makeDeal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    ...baseDeal,
    id: `deal-${++_counter}`,
    ...overrides,
  };
}

// ─── Pricing Suggestions ──────────────────────────────────────────

describe('Pricing Suggestions', () => {
  it('returns empty if fewer than 3 similar deals', () => {
    const current = makeDeal();
    const historical = [makeDeal(), makeDeal()];
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    expect(suggestions).toHaveLength(0);
  });

  it('returns suggestions when enough similar deals exist', () => {
    const current = makeDeal();
    const historical = Array.from({ length: 5 }, () => makeDeal());
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].metric).toBe('Margin Target');
  });

  it('filters out Draft and Rejected deals', () => {
    const current = makeDeal();
    const historical = [
      makeDeal({ status: 'Draft' }),
      makeDeal({ status: 'Rejected' }),
      makeDeal({ status: 'Approved' }),
      makeDeal({ status: 'Booked' }),
      makeDeal({ status: 'Approved' }),
    ];
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    // Only 3 non-Draft/Rejected deals match — should still produce suggestions
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('only matches same product/category/currency', () => {
    const current = makeDeal({ productType: 'LOAN_COMM', currency: 'EUR' });
    const historical = Array.from({ length: 5 }, () =>
      makeDeal({ productType: 'DEP_TERM', category: 'Liability' as const, currency: 'USD' })
    );
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    expect(suggestions).toHaveLength(0);
  });

  it('includes amount range and duration suggestions', () => {
    const current = makeDeal();
    const historical = Array.from({ length: 5 }, () => makeDeal());
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    const metrics = suggestions.map((s) => s.metric);
    expect(metrics).toContain('Typical Amount Range');
    expect(metrics).toContain('Typical Duration');
  });

  it('assigns high confidence when margin spread is tight', () => {
    const current = makeDeal();
    // All historical deals have identical margin — std dev = 0
    const historical = Array.from({ length: 5 }, () => makeDeal({ marginTarget: 0.015 }));
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    const marginSuggestion = suggestions.find((s) => s.metric === 'Margin Target');
    expect(marginSuggestion?.confidence).toBe('high');
  });

  it('assigns low confidence when margin spread is wide', () => {
    const current = makeDeal();
    const historical = [
      makeDeal({ marginTarget: 0.005 }),
      makeDeal({ marginTarget: 0.05 }),
      makeDeal({ marginTarget: 0.10 }),
      makeDeal({ marginTarget: 0.001 }),
      makeDeal({ marginTarget: 0.08 }),
    ];
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    const marginSuggestion = suggestions.find((s) => s.metric === 'Margin Target');
    expect(marginSuggestion?.confidence).toBe('low');
  });

  it('excludes the current deal itself from similar deals', () => {
    const current = makeDeal({ id: 'self-deal' });
    // Only provide current deal + 2 others (should be < 3 similar)
    const historical = [current, makeDeal(), makeDeal()];
    const suggestions = getSimilarDealSuggestions(current, historical, new Map());
    expect(suggestions).toHaveLength(0);
  });
});

// ─── Anomaly Detection ────────────────────────────────────────────

describe('Anomaly Detection', () => {
  it('returns empty for small portfolios (< 5 deals)', () => {
    const alerts = detectPortfolioAnomalies([makeDeal(), makeDeal(), makeDeal()]);
    expect(alerts).toHaveLength(0);
  });

  it('detects margin outliers', () => {
    const deals = [
      ...Array.from({ length: 8 }, () => makeDeal({ marginTarget: 0.015 })),
      makeDeal({ marginTarget: 0.10 }), // outlier
    ];
    const alerts = detectPortfolioAnomalies(deals);
    const spreadAlert = alerts.find((a) => a.type === 'spread_outlier');
    expect(spreadAlert).toBeDefined();
    expect(spreadAlert!.metric).toBe('margin_target');
  });

  it('detects risk concentration', () => {
    const deals = Array.from({ length: 12 }, () => makeDeal({ productType: 'LOAN_COMM' }));
    const alerts = detectPortfolioAnomalies(deals);
    const concAlert = alerts.find((a) => a.type === 'risk_concentration');
    expect(concAlert).toBeDefined();
    expect(concAlert!.severity).toBe('critical');
  });

  it('detects large single exposure', () => {
    const deals = [
      ...Array.from({ length: 5 }, () => makeDeal({ amount: 1_000_000 })),
      makeDeal({ amount: 50_000_000 }), // huge relative to rest
    ];
    const alerts = detectPortfolioAnomalies(deals);
    const expAlert = alerts.find((a) => a.type === 'volume_spike');
    expect(expAlert).toBeDefined();
  });

  it('does not flag concentration below the threshold', () => {
    // 50/50 split — no product exceeds 60%
    const deals = [
      ...Array.from({ length: 5 }, () => makeDeal({ productType: 'LOAN_COMM' })),
      ...Array.from({ length: 5 }, () => makeDeal({ productType: 'DEP_TERM' })),
    ];
    const alerts = detectPortfolioAnomalies(deals);
    expect(alerts.find((a) => a.type === 'risk_concentration')).toBeUndefined();
  });

  it('marks concentration as warning (not critical) between 60% and 80%', () => {
    // 7/10 = 70% — above 60% threshold but below 80%
    const deals = [
      ...Array.from({ length: 7 }, () => makeDeal({ productType: 'LOAN_COMM' })),
      ...Array.from({ length: 3 }, () => makeDeal({ productType: 'DEP_TERM' })),
    ];
    const alerts = detectPortfolioAnomalies(deals);
    const concAlert = alerts.find((a) => a.type === 'risk_concentration');
    expect(concAlert).toBeDefined();
    expect(concAlert!.severity).toBe('warning');
  });

  it('flags large single exposure as critical when > 40% of portfolio', () => {
    const deals = [
      ...Array.from({ length: 5 }, () => makeDeal({ amount: 500_000 })),
      makeDeal({ amount: 20_000_000 }), // ~89% of total
    ];
    const alerts = detectPortfolioAnomalies(deals);
    const expAlert = alerts.find((a) => a.type === 'volume_spike');
    expect(expAlert).toBeDefined();
    expect(expAlert!.severity).toBe('critical');
  });
});

// ─── Risk Classification ──────────────────────────────────────────

describe('Risk Classification', () => {
  it('classifies low-risk deal', () => {
    const result = classifyDealRisk(makeDeal({
      amount: 1_000_000,
      durationMonths: 12,
      riskWeight: 20,
      transitionRisk: 'Green' as const,
      physicalRisk: 'Low' as const,
      clientType: 'Corporate',
    }));
    expect(result.tier).toBe('Low');
    expect(result.score).toBeLessThan(20);
  });

  it('classifies high-risk deal as Critical', () => {
    const result = classifyDealRisk(makeDeal({
      amount: 60_000_000,
      durationMonths: 180,
      riskWeight: 150,
      transitionRisk: 'Brown' as const,
      physicalRisk: 'High' as const,
    }));
    expect(result.tier).toBe('Critical');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('includes relevant risk factors', () => {
    const result = classifyDealRisk(makeDeal({
      amount: 60_000_000,
      transitionRisk: 'Brown' as const,
    }));
    expect(result.factors).toContain('Very large exposure (>50M)');
    expect(result.factors).toContain('Brown ESG classification');
  });

  it('caps score at 100', () => {
    const result = classifyDealRisk(makeDeal({
      amount: 100_000_000,
      durationMonths: 240,
      riskWeight: 200,
      transitionRisk: 'Brown' as const,
      physicalRisk: 'High' as const,
      clientType: 'Institution',
    }));
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('uses "new" as dealId when id is undefined', () => {
    const dealWithoutId = makeDeal();
    // Force id to be undefined
    const { id: _id, ...rest } = dealWithoutId;
    const result = classifyDealRisk(rest as Transaction);
    expect(result.dealId).toBe('new');
  });

  it('classifies medium-risk deal', () => {
    // amount >10M (+15) + riskWeight >50 (+10) = 25 → Medium
    const result = classifyDealRisk(makeDeal({
      amount: 15_000_000,
      durationMonths: 24,
      riskWeight: 75,
      transitionRisk: 'Neutral' as const,
      physicalRisk: 'Low' as const,
    }));
    expect(result.tier).toBe('Medium');
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThan(40);
  });

  it('classifies high (not critical) risk deal', () => {
    // amount >10M (+15) + duration >5Y (+10) + riskWeight >50 (+10) + physicalRisk High (+10) = 45 → High
    const result = classifyDealRisk(makeDeal({
      amount: 15_000_000,
      durationMonths: 84,
      riskWeight: 75,
      transitionRisk: 'Neutral' as const,
      physicalRisk: 'High' as const,
    }));
    expect(result.tier).toBe('High');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(60);
  });
});
