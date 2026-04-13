import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types';
import {
  calibrateFromDeals,
  dealToObservation,
  groupBySegment,
  getPriorForSegment,
  DEFAULT_EXPERT_PRIOR,
  serializeModel,
  deserializeModel,
} from '../pricing/elasticityCalibration';

const baseDeal: Transaction = {
  clientId: 'c-1',
  clientType: 'Corporate',
  businessUnit: 'RM',
  fundingBusinessUnit: 'Treasury',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'EUR',
  amount: 5_000_000,
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
};

const makeDeal = (overrides: Partial<Transaction>): Transaction => ({
  ...baseDeal,
  ...overrides,
});

describe('dealToObservation', () => {
  it('returns null when outcome is missing', () => {
    expect(dealToObservation(baseDeal)).toBeNull();
  });
  it('returns null for PENDING/WITHDRAWN outcomes', () => {
    expect(dealToObservation(makeDeal({ wonLost: 'PENDING', proposedRate: 4 }))).toBeNull();
    expect(dealToObservation(makeDeal({ wonLost: 'WITHDRAWN', proposedRate: 4 }))).toBeNull();
  });
  it('returns null when no rate is available', () => {
    expect(dealToObservation(makeDeal({ wonLost: 'WON', marginTarget: 0, proposedRate: undefined }))).toBeNull();
  });
  it('builds an observation from WON', () => {
    const obs = dealToObservation(makeDeal({ wonLost: 'WON', proposedRate: 4.25 }));
    expect(obs?.converted).toBe(1);
    expect(obs?.offeredRate).toBe(4.25);
    expect(obs?.amount).toBe(5_000_000);
  });
  it('builds an observation from LOST without amount', () => {
    const obs = dealToObservation(makeDeal({ wonLost: 'LOST', proposedRate: 4.5 }));
    expect(obs?.converted).toBe(0);
    expect(obs?.amount).toBeUndefined();
  });
  it('prefers proposedRate over marginTarget', () => {
    const obs = dealToObservation(
      makeDeal({ wonLost: 'WON', proposedRate: 4.5, marginTarget: 3 }),
    );
    expect(obs?.offeredRate).toBe(4.5);
  });
});

describe('groupBySegment', () => {
  it('groups by composite key', () => {
    const obs = [
      dealToObservation(makeDeal({ wonLost: 'WON', proposedRate: 4 }))!,
      dealToObservation(makeDeal({ wonLost: 'LOST', proposedRate: 4.5, clientType: 'Retail' }))!,
      dealToObservation(makeDeal({ wonLost: 'WON', proposedRate: 4.1 }))!,
    ];
    const grouped = groupBySegment(obs);
    expect(grouped.size).toBe(2);
  });
});

describe('calibrateFromDeals', () => {
  it('returns empty when no eligible deals', () => {
    expect(calibrateFromDeals([])).toEqual([]);
    expect(calibrateFromDeals([baseDeal])).toEqual([]);
  });

  it('skips segments with < 3 observations (default without priors)', () => {
    const deals = [makeDeal({ wonLost: 'WON', proposedRate: 4 })];
    const models = calibrateFromDeals(deals);
    expect(models).toHaveLength(0);
  });

  it('uses Bayesian method for segments with 3-29 observations', () => {
    const deals: Transaction[] = [];
    for (let i = 0; i < 5; i++) {
      deals.push(makeDeal({ wonLost: i % 2 === 0 ? 'WON' : 'LOST', proposedRate: 4 + i * 0.1 }));
    }
    const models = calibrateFromDeals(deals);
    expect(models).toHaveLength(1);
    expect(models[0].method).toBe('BAYESIAN');
    expect(models[0].confidence).toBe('LOW');
    expect(models[0].sampleSize).toBe(5);
  });

  it('uses Frequentist OLS with MEDIUM confidence for 30-99 observations', () => {
    const deals: Transaction[] = [];
    for (let i = 0; i < 50; i++) {
      // Higher rates → lower win probability to give model signal
      const rate = 3 + (i / 50) * 2;
      const won = Math.random() > rate / 5;
      deals.push(makeDeal({ wonLost: won ? 'WON' : 'LOST', proposedRate: rate }));
    }
    const models = calibrateFromDeals(deals);
    expect(models).toHaveLength(1);
    expect(models[0].method).toBe('FREQUENTIST');
    expect(['MEDIUM', 'HIGH']).toContain(models[0].confidence);
    expect(models[0].sampleSize).toBe(50);
  });

  it('uses Frequentist OLS with HIGH confidence for >= 100 observations', () => {
    const deals: Transaction[] = [];
    for (let i = 0; i < 120; i++) {
      deals.push(makeDeal({
        wonLost: i % 3 === 0 ? 'LOST' : 'WON',
        proposedRate: 3 + (i % 20) * 0.1,
      }));
    }
    const models = calibrateFromDeals(deals);
    expect(models[0].method).toBe('FREQUENTIST');
    expect(models[0].confidence).toBe('HIGH');
  });

  it('calibrates multiple segments in one call', () => {
    const deals: Transaction[] = [];
    for (let i = 0; i < 5; i++) {
      deals.push(makeDeal({ wonLost: 'WON', proposedRate: 4, clientType: 'Retail' }));
      deals.push(makeDeal({ wonLost: 'LOST', proposedRate: 4.5, clientType: 'SME' }));
    }
    const models = calibrateFromDeals(deals);
    expect(models.length).toBe(2);
    const segments = new Set(models.map((m) => m.segmentKey));
    expect(segments.size).toBe(2);
  });
});

describe('getPriorForSegment', () => {
  it('returns default prior when no priors configured', () => {
    expect(getPriorForSegment('X|Y|Z|T')).toEqual(DEFAULT_EXPERT_PRIOR);
  });
  it('returns segment-specific prior when configured', () => {
    const priors = {
      'LOAN_COMM|Corporate|LARGE|MT': { elasticity: -0.5, baselineConversion: 0.7, anchorRate: 4.5 },
    };
    expect(getPriorForSegment('LOAN_COMM|Corporate|LARGE|MT', priors).elasticity).toBe(-0.5);
  });
  it('falls back to default when key not in priors', () => {
    const priors = { 'X|Y|Z|T': { elasticity: -0.5, baselineConversion: 0.7, anchorRate: 4.5 } };
    expect(getPriorForSegment('OTHER|KEY|HERE|NOT', priors)).toEqual(DEFAULT_EXPERT_PRIOR);
  });
});

describe('serialize/deserialize', () => {
  it('round-trips a model', () => {
    const model = {
      segmentKey: 'LOAN|Corp|LARGE|MT',
      elasticity: -0.42,
      baselineConversion: 0.65,
      anchorRate: 4.25,
      sampleSize: 85,
      confidence: 'MEDIUM' as const,
      method: 'FREQUENTIST' as const,
      calibratedAt: '2026-04-13T12:00:00Z',
    };
    const row = serializeModel(model);
    expect(row.segment_key).toBe(model.segmentKey);
    expect(row.is_active).toBe(true);

    const back = deserializeModel(row);
    expect(back.elasticity).toBeCloseTo(-0.42, 5);
    expect(back.method).toBe('FREQUENTIST');
  });

  it('coerces string numerics from DB', () => {
    const row = {
      segment_key: 'X',
      elasticity: '-0.3',
      baseline_conversion: '0.5',
      anchor_rate: '4',
      sample_size: '10',
      confidence: 'LOW',
      method: 'BAYESIAN',
      calibrated_at: '2026-04-13T00:00:00Z',
    };
    const model = deserializeModel(row);
    expect(model.elasticity).toBe(-0.3);
    expect(model.sampleSize).toBe(10);
  });

  it('defaults to LOW/BAYESIAN on unexpected enum values', () => {
    const row = {
      segment_key: 'X',
      elasticity: -0.1,
      baseline_conversion: 0.5,
      anchor_rate: 4,
      sample_size: 5,
      confidence: 'WAT',
      method: 'NEW_METHOD',
      calibrated_at: 'now',
    };
    const model = deserializeModel(row);
    expect(model.confidence).toBe('LOW');
    expect(model.method).toBe('BAYESIAN');
  });
});
