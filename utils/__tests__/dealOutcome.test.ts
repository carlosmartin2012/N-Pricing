import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types';
import {
  isOutcomeComplete,
  isElasticityEligible,
  buildOutcomePatch,
  getOutcomeStyle,
  WON_LOST_OPTIONS,
  LOSS_REASON_OPTIONS,
} from '../dealOutcome';
import { mapDealFromDB, mapDealToDB } from '../supabase/mappers';

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

describe('dealOutcome helpers', () => {
  describe('isOutcomeComplete', () => {
    it('returns false when wonLost is missing', () => {
      expect(isOutcomeComplete({})).toBe(false);
    });
    it('returns false when LOST without lossReason', () => {
      expect(isOutcomeComplete({ wonLost: 'LOST' })).toBe(false);
    });
    it('returns true when LOST with lossReason', () => {
      expect(isOutcomeComplete({ wonLost: 'LOST', lossReason: 'PRICE' })).toBe(true);
    });
    it('returns true for WON without lossReason', () => {
      expect(isOutcomeComplete({ wonLost: 'WON' })).toBe(true);
    });
    it('returns true for PENDING and WITHDRAWN without lossReason', () => {
      expect(isOutcomeComplete({ wonLost: 'PENDING' })).toBe(true);
      expect(isOutcomeComplete({ wonLost: 'WITHDRAWN' })).toBe(true);
    });
  });

  describe('isElasticityEligible', () => {
    it('only WON and LOST feed elasticity calibration', () => {
      expect(isElasticityEligible({ ...baseDeal, wonLost: 'WON' })).toBe(true);
      expect(isElasticityEligible({ ...baseDeal, wonLost: 'LOST' })).toBe(true);
      expect(isElasticityEligible({ ...baseDeal, wonLost: 'PENDING' })).toBe(false);
      expect(isElasticityEligible({ ...baseDeal, wonLost: 'WITHDRAWN' })).toBe(false);
      expect(isElasticityEligible(baseDeal)).toBe(false);
    });
  });

  describe('buildOutcomePatch', () => {
    it('stamps decisionDate for WON', () => {
      const patch = buildOutcomePatch({ wonLost: 'WON' });
      expect(patch.wonLost).toBe('WON');
      expect(patch.decisionDate).toBeDefined();
      expect(patch.lossReason).toBeUndefined();
    });
    it('stamps decisionDate for LOST and preserves lossReason', () => {
      const patch = buildOutcomePatch({ wonLost: 'LOST', lossReason: 'COMPETITOR' });
      expect(patch.lossReason).toBe('COMPETITOR');
      expect(patch.decisionDate).toBeDefined();
    });
    it('does NOT stamp decisionDate for PENDING', () => {
      const patch = buildOutcomePatch({ wonLost: 'PENDING' });
      expect(patch.decisionDate).toBeUndefined();
    });
    it('drops lossReason when not LOST (no stale data leaks)', () => {
      const patch = buildOutcomePatch({ wonLost: 'WON', lossReason: 'PRICE' });
      expect(patch.lossReason).toBeUndefined();
    });
    it('preserves competitorRate when provided', () => {
      const patch = buildOutcomePatch({ wonLost: 'LOST', lossReason: 'PRICE', competitorRate: 4.18 });
      expect(patch.competitorRate).toBe(4.18);
    });
  });

  describe('getOutcomeStyle', () => {
    it('returns distinct styles per outcome', () => {
      expect(getOutcomeStyle('WON').label).toBe('WON');
      expect(getOutcomeStyle('LOST').label).toBe('LOST');
      expect(getOutcomeStyle(undefined).label).toBe('—');
    });
  });

  describe('constants coverage', () => {
    it('WON_LOST_OPTIONS covers all 4 states', () => {
      expect(WON_LOST_OPTIONS.map((o) => o.value).sort()).toEqual(['LOST', 'PENDING', 'WITHDRAWN', 'WON']);
    });
    it('LOSS_REASON_OPTIONS covers all 7 reasons', () => {
      expect(LOSS_REASON_OPTIONS).toHaveLength(7);
    });
  });
});

describe('mapper roundtrip — outcome fields', () => {
  it('persists and reads all 5 outcome fields', () => {
    const deal: Transaction = {
      ...baseDeal,
      wonLost: 'LOST',
      lossReason: 'COMPETITOR',
      competitorRate: 4.18,
      proposedRate: 4.35,
      decisionDate: '2026-04-13T10:00:00Z',
    };

    const row = mapDealToDB(deal);
    expect(row.won_lost).toBe('LOST');
    expect(row.loss_reason).toBe('COMPETITOR');
    expect(row.competitor_rate).toBe(4.18);
    expect(row.proposed_rate).toBe(4.35);
    expect(row.decision_date).toBe('2026-04-13T10:00:00Z');

    const roundTripped = mapDealFromDB(row as unknown as Record<string, unknown>);
    expect(roundTripped.wonLost).toBe('LOST');
    expect(roundTripped.lossReason).toBe('COMPETITOR');
    expect(roundTripped.competitorRate).toBe(4.18);
    expect(roundTripped.proposedRate).toBe(4.35);
    expect(roundTripped.decisionDate).toBe('2026-04-13T10:00:00Z');
  });

  it('handles NULL from DB gracefully', () => {
    const row = {
      ...(mapDealToDB(baseDeal) as Record<string, unknown>),
      won_lost: null,
      loss_reason: null,
      competitor_rate: null,
      proposed_rate: null,
      decision_date: null,
    };
    const deal = mapDealFromDB(row);
    expect(deal.wonLost).toBeUndefined();
    expect(deal.lossReason).toBeUndefined();
    expect(deal.competitorRate).toBeUndefined();
    expect(deal.proposedRate).toBeUndefined();
    expect(deal.decisionDate).toBeUndefined();
  });

  it('coerces numeric string values from DB', () => {
    const row = {
      ...(mapDealToDB(baseDeal) as Record<string, unknown>),
      competitor_rate: '4.18',
      proposed_rate: '4.35',
    };
    const deal = mapDealFromDB(row);
    expect(deal.competitorRate).toBe(4.18);
    expect(deal.proposedRate).toBe(4.35);
  });

  it('ignores non-numeric garbage in rate fields', () => {
    const row = {
      ...(mapDealToDB(baseDeal) as Record<string, unknown>),
      competitor_rate: 'not-a-number',
      proposed_rate: 'nope',
    };
    const deal = mapDealFromDB(row);
    expect(deal.competitorRate).toBeUndefined();
    expect(deal.proposedRate).toBeUndefined();
  });
});
