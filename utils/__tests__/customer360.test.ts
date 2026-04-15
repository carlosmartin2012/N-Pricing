import { describe, it, expect } from 'vitest';
import {
  findApplicableTargets,
  pickActiveTarget,
  buildClientRelationship,
} from '../customer360/relationshipAggregator';
import type {
  ClientPosition,
  ClientMetricsSnapshot,
  PricingTarget,
} from '../../types/customer360';
import type { ClientEntity } from '../../types';

const ENTITY = '00000000-0000-0000-0000-000000000010';

const makeTarget = (overrides: Partial<PricingTarget> = {}): PricingTarget => ({
  id:                 't1',
  entityId:           ENTITY,
  segment:            'Retail',
  productType:        'MORTGAGE',
  currency:           'EUR',
  period:             '2026-Q2',
  targetMarginBps:    150,
  targetRarocPct:     0.15,
  targetVolumeEur:    null,
  preApprovedRateBps: 350,
  hardFloorRateBps:   200,
  activeFrom:         '2026-04-01',
  activeTo:           '2026-06-30',
  isActive:           true,
  createdBy:          'user@bank.es',
  createdAt:          '2026-04-01T08:00:00Z',
  updatedAt:          '2026-04-01T08:00:00Z',
  ...overrides,
});

const makePosition = (overrides: Partial<ClientPosition> = {}): ClientPosition => ({
  id:           'p1',
  entityId:     ENTITY,
  clientId:     'c-1',
  productId:    'prod-1',
  productType:  'MORTGAGE',
  category:     'Asset',
  dealId:       null,
  amount:       180000,
  currency:     'EUR',
  marginBps:    180,
  startDate:    '2024-05-01',
  maturityDate: '2049-05-01',
  status:       'Active',
  createdAt:    '2024-05-01T00:00:00Z',
  updatedAt:    '2024-05-01T00:00:00Z',
  ...overrides,
});

const makeMetric = (overrides: Partial<ClientMetricsSnapshot> = {}): ClientMetricsSnapshot => ({
  id:                   'm1',
  entityId:             ENTITY,
  clientId:             'c-1',
  period:               '2026-Q1',
  computedAt:           '2026-04-01T00:00:00Z',
  nimBps:               180,
  feesEur:              500,
  evaEur:               1200,
  shareOfWalletPct:     0.35,
  relationshipAgeYears: 4.2,
  npsScore:             65,
  activePositionCount:  2,
  totalExposureEur:     200000,
  source:               'computed',
  detail:               {},
  ...overrides,
});

const CLIENT: ClientEntity = {
  id:      'c-1',
  name:    'Acme Corp',
  type:    'Corporate',
  segment: 'Retail',
  rating:  'BBB+',
};

describe('findApplicableTargets', () => {
  it('returns only matches by entity, segment, product, currency and date window', () => {
    const targets = [
      makeTarget({ id: 'a' }),
      makeTarget({ id: 'b', segment: 'SME' }),                   // wrong segment
      makeTarget({ id: 'c', productType: 'CONSUMER' }),          // wrong product
      makeTarget({ id: 'd', currency: 'USD' }),                  // wrong currency
      makeTarget({ id: 'e', activeFrom: '2027-01-01' }),         // future
      makeTarget({ id: 'f', activeTo: '2026-03-31' }),           // expired
      makeTarget({ id: 'g', isActive: false }),                  // inactive
    ];
    const out = findApplicableTargets(targets, {
      entityId: ENTITY, segment: 'Retail', productType: 'MORTGAGE',
      currency: 'EUR', asOfDate: '2026-04-15',
    });
    expect(out.map((t) => t.id)).toEqual(['a']);
  });

  it('treats null active_to as open-ended', () => {
    const targets = [makeTarget({ activeTo: null, activeFrom: '2025-01-01' })];
    const out = findApplicableTargets(targets, {
      entityId: ENTITY, segment: 'Retail', productType: 'MORTGAGE',
      currency: 'EUR', asOfDate: '2030-01-01',
    });
    expect(out).toHaveLength(1);
  });
});

describe('pickActiveTarget', () => {
  it('picks the target with the latest activeFrom when multiple match', () => {
    const targets = [
      makeTarget({ id: 'old', activeFrom: '2026-01-01' }),
      makeTarget({ id: 'new', activeFrom: '2026-04-01' }),
    ];
    const winner = pickActiveTarget(targets, {
      entityId: ENTITY, segment: 'Retail', productType: 'MORTGAGE',
      currency: 'EUR', asOfDate: '2026-04-15',
    });
    expect(winner?.id).toBe('new');
  });

  it('returns null when nothing applies', () => {
    expect(pickActiveTarget([], {
      entityId: ENTITY, segment: 'Retail', productType: 'MORTGAGE',
      currency: 'EUR', asOfDate: '2026-04-15',
    })).toBeNull();
  });
});

describe('buildClientRelationship', () => {
  it('aggregates active positions, latest metric, derived fields', () => {
    const positions = [
      makePosition({ id: 'p1', productType: 'MORTGAGE' }),
      makePosition({ id: 'p2', productType: 'DEPOSIT', category: 'Liability', amount: 50000 }),
      makePosition({ id: 'p3', status: 'Matured', amount: 99999 }),
    ];
    const metricsHistory = [
      makeMetric({ id: 'm-old', period: '2025-Q4', computedAt: '2026-01-15T00:00:00Z' }),
      makeMetric({ id: 'm-new', period: '2026-Q1', computedAt: '2026-04-01T00:00:00Z' }),
    ];
    const targets = [
      makeTarget({ id: 't-mortgage', productType: 'MORTGAGE' }),
      makeTarget({ id: 't-deposit',  productType: 'DEPOSIT' }),
      makeTarget({ id: 't-other',    productType: 'CONSUMER' }),  // not held
    ];
    const out = buildClientRelationship({
      client: CLIENT,
      positions,
      metricsHistory,
      targets,
      asOfDate: '2026-04-15',
    });

    expect(out.derived.activePositionCount).toBe(2);
    expect(out.derived.totalExposureEur).toBe(180000 + 50000);
    expect(out.derived.productTypesHeld).toEqual(['DEPOSIT', 'MORTGAGE']);
    expect(out.derived.isMultiProduct).toBe(true);
    expect(out.derived.relationshipAgeYears).toBe(4.2);

    expect(out.metrics.latest?.id).toBe('m-new');
    expect(out.metrics.history.map((m) => m.id)).toEqual(['m-new', 'm-old']);

    expect(out.applicableTargets.map((t) => t.id).sort()).toEqual(['t-deposit', 't-mortgage']);
  });

  it('handles client with zero positions and no metrics', () => {
    const out = buildClientRelationship({
      client: CLIENT,
      positions: [],
      metricsHistory: [],
      targets: [makeTarget()],
      asOfDate: '2026-04-15',
    });
    expect(out.derived.activePositionCount).toBe(0);
    expect(out.derived.isMultiProduct).toBe(false);
    expect(out.metrics.latest).toBeNull();
    // No held products → target list should still consider segment match.
    expect(out.applicableTargets).toHaveLength(1);
  });

  it('skips matured positions in derived totals but keeps them in the positions array', () => {
    const out = buildClientRelationship({
      client: CLIENT,
      positions: [makePosition({ status: 'Matured', amount: 1000 })],
      metricsHistory: [],
      targets: [],
      asOfDate: '2026-04-15',
    });
    expect(out.positions).toHaveLength(1);
    expect(out.derived.activePositionCount).toBe(0);
    expect(out.derived.totalExposureEur).toBe(0);
  });
});
