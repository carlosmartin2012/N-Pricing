import { describe, it, expect } from 'vitest';
import type { ClientRelationship, ClientPosition } from '../../../types/customer360';
import {
  computeLtv,
  defaultAssumptions,
  discountFactor,
  positionContribution,
  survivalProb,
  yearsToMaturity,
} from '../ltvEngine';

function position(overrides: Partial<ClientPosition> = {}): ClientPosition {
  return {
    id: 'pos-1',
    entityId: 'ent-1',
    clientId: 'cli-1',
    productId: null,
    productType: 'Mortgage',
    category: 'Asset',
    dealId: null,
    amount: 100_000,
    currency: 'EUR',
    marginBps: 200,
    startDate: '2026-01-01',
    maturityDate: '2031-01-01',
    status: 'Active',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function relationship(positions: ClientPosition[] = [], feesEur = 0): ClientRelationship {
  const totalExposure = positions
    .filter((p) => p.status === 'Active')
    .reduce((s, p) => s + p.amount, 0);
  const productTypes = Array.from(new Set(positions.filter((p) => p.status === 'Active').map((p) => p.productType)));
  return {
    client: { id: 'cli-1', name: 'Test Corp', type: 'Corporate', segment: 'SME', rating: 'BBB' },
    positions,
    metrics: {
      latest: feesEur > 0 ? {
        id: 'm-1',
        entityId: 'ent-1',
        clientId: 'cli-1',
        period: '2026-Q1',
        computedAt: '2026-01-01',
        nimBps: 180,
        feesEur,
        evaEur: null,
        shareOfWalletPct: 0.4,
        relationshipAgeYears: 3,
        npsScore: 40,
        activePositionCount: positions.length,
        totalExposureEur: totalExposure,
        source: 'computed',
        detail: {},
      } : null,
      history: [],
    },
    applicableTargets: [],
    derived: {
      activePositionCount: positions.filter((p) => p.status === 'Active').length,
      totalExposureEur: totalExposure,
      productTypesHeld: productTypes,
      relationshipAgeYears: 3,
      isMultiProduct: productTypes.length > 1,
    },
  };
}

describe('ltvEngine primitives', () => {
  it('survivalProb decreases monotonically with t', () => {
    const s0 = survivalProb(0.1, 0);
    const s5 = survivalProb(0.1, 5);
    const s10 = survivalProb(0.1, 10);
    expect(s0).toBe(1);
    expect(s5).toBeGreaterThan(s10);
    expect(s10).toBeGreaterThan(0);
  });

  it('survivalProb clamps hazard > 1', () => {
    expect(survivalProb(5, 1)).toBe(survivalProb(1, 1));
  });

  it('discountFactor rate 0 keeps amount at parity', () => {
    expect(discountFactor(0, 10)).toBe(1);
  });

  it('discountFactor reduces future cashflows', () => {
    const df = discountFactor(0.08, 5);
    expect(df).toBeGreaterThan(0);
    expect(df).toBeLessThan(1);
    expect(df).toBeCloseTo(1 / Math.pow(1.08, 5), 6);
  });

  it('yearsToMaturity handles null (perpetual)', () => {
    const p = position({ maturityDate: null });
    expect(yearsToMaturity(p, '2026-01-01')).toBe(Number.POSITIVE_INFINITY);
  });

  it('yearsToMaturity is ~5 for a 5y loan starting today', () => {
    const y = yearsToMaturity(position(), '2026-01-01');
    expect(y).toBeCloseTo(5, 1);
  });
});

describe('positionContribution', () => {
  it('returns 0 for zero margin', () => {
    const a = defaultAssumptions('2026-01-01');
    expect(positionContribution(position({ marginBps: 0 }), a)).toBe(0);
  });

  it('returns 0 for zero amount', () => {
    const a = defaultAssumptions('2026-01-01');
    expect(positionContribution(position({ amount: 0 }), a)).toBe(0);
  });

  it('higher hazard reduces contribution monotonically', () => {
    const low = defaultAssumptions('2026-01-01', { churnHazardAnnual: 0.02 });
    const high = defaultAssumptions('2026-01-01', { churnHazardAnnual: 0.30 });
    const cLow = positionContribution(position(), low);
    const cHigh = positionContribution(position(), high);
    expect(cLow).toBeGreaterThan(cHigh);
  });

  it('longer horizon produces more NII (diminishing returns)', () => {
    const short = defaultAssumptions('2026-01-01', { horizonYears: 3 });
    const long = defaultAssumptions('2026-01-01', { horizonYears: 10 });
    const cShort = positionContribution(position(), short);
    const cLong = positionContribution(position(), long);
    expect(cLong).toBeGreaterThan(cShort);
  });

  it('is roughly proportional to amount', () => {
    const a = defaultAssumptions('2026-01-01');
    const small = positionContribution(position({ amount: 100_000 }), a);
    const big = positionContribution(position({ amount: 500_000 }), a);
    expect(big / small).toBeCloseTo(5, 3);
  });
});

describe('computeLtv', () => {
  it('empty relationship yields non-negative CLV with 0 positions', () => {
    const r = relationship([]);
    const out = computeLtv(r, defaultAssumptions('2026-01-01'));
    expect(out.clvPointEur).toBeCloseTo(0, 1);
    expect(out.breakdown.niiEur).toBe(0);
    expect(out.breakdown.perPosition).toHaveLength(0);
  });

  it('single active position produces positive NII + positive CLV', () => {
    const r = relationship([position()]);
    const out = computeLtv(r, defaultAssumptions('2026-01-01'));
    expect(out.clvPointEur).toBeGreaterThan(0);
    expect(out.breakdown.niiEur).toBeGreaterThan(0);
    expect(out.breakdown.perPosition).toHaveLength(1);
  });

  it('p5 ≤ point ≤ p95 (band is well-ordered)', () => {
    const r = relationship([position({ amount: 500_000 })]);
    const out = computeLtv(r, defaultAssumptions('2026-01-01'));
    expect(out.clvP5Eur).toBeLessThanOrEqual(out.clvPointEur);
    expect(out.clvPointEur).toBeLessThanOrEqual(out.clvP95Eur);
  });

  it('reproducible: same inputs → same assumptionsHash', () => {
    const r = relationship([position()]);
    const a = defaultAssumptions('2026-01-01');
    const out1 = computeLtv(r, a);
    const out2 = computeLtv(r, { ...a });
    expect(out1.assumptionsHash).toBe(out2.assumptionsHash);
    expect(out1.clvPointEur).toBe(out2.clvPointEur);
  });

  it('different assumptions → different hash', () => {
    const r = relationship([position()]);
    const out1 = computeLtv(r, defaultAssumptions('2026-01-01'));
    const out2 = computeLtv(r, defaultAssumptions('2026-01-01', { discountRate: 0.10 }));
    expect(out1.assumptionsHash).not.toBe(out2.assumptionsHash);
  });

  it('clamps invalid assumptions instead of crashing', () => {
    const r = relationship([position()]);
    const a = defaultAssumptions('2026-01-01', {
      horizonYears: 999,
      churnHazardAnnual: -1,
      renewalProb: 5,
    });
    const out = computeLtv(r, a);
    expect(out.horizonYears).toBeLessThanOrEqual(30);
    expect(out.churnHazardAnnual).toBeGreaterThanOrEqual(0);
    expect(out.renewalProb).toBeLessThanOrEqual(1);
  });

  it('fees contribute to CLV when latest metrics have feesEur', () => {
    const r1 = relationship([position()]);
    const r2 = relationship([position()], 5000);   // 5k fees/yr
    const a = defaultAssumptions('2026-01-01');
    const c1 = computeLtv(r1, a);
    const c2 = computeLtv(r2, a);
    expect(c2.clvPointEur).toBeGreaterThan(c1.clvPointEur);
    expect(c2.breakdown.feesEur).toBeGreaterThan(0);
  });

  it('matured positions do not contribute', () => {
    const r = relationship([
      position({ status: 'Matured' }),
      position({ id: 'pos-2', status: 'Active' }),
    ]);
    const out = computeLtv(r, defaultAssumptions('2026-01-01'));
    expect(out.breakdown.perPosition).toHaveLength(1);
    expect(out.breakdown.perPosition[0].positionId).toBe('pos-2');
  });

  it('shareOfWalletGap = 1 - shareOfWalletEst', () => {
    const r = relationship([position()]);
    const out = computeLtv(r, defaultAssumptions('2026-01-01', { shareOfWalletEst: 0.3 }));
    expect(out.shareOfWalletGap).toBeCloseTo(0.7, 6);
  });
});
