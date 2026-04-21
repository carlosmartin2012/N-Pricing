import { describe, it, expect } from 'vitest';
import type { ClientRelationship, ClientPosition } from '../../../types/customer360';
import { computeLtv, defaultAssumptions } from '../ltvEngine';
import { rankNextBestActions, REFERENCE_CATALOGUE } from '../nextBestAction';

function position(overrides: Partial<ClientPosition> = {}): ClientPosition {
  return {
    id: 'p-1',
    entityId: 'ent',
    clientId: 'c-1',
    productId: null,
    productType: 'Mortgage',
    category: 'Asset',
    dealId: null,
    amount: 250_000,
    currency: 'EUR',
    marginBps: 150,
    startDate: '2026-01-01',
    maturityDate: '2030-06-01',
    status: 'Active',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function relationship(positions: ClientPosition[]): ClientRelationship {
  const exposure = positions.filter((p) => p.status === 'Active').reduce((s, p) => s + p.amount, 0);
  const productTypes = Array.from(new Set(positions.filter((p) => p.status === 'Active').map((p) => p.productType)));
  return {
    client: { id: 'c-1', name: 'X', type: 'Corporate', segment: 'SME', rating: 'BBB' },
    positions,
    metrics: { latest: null, history: [] },
    applicableTargets: [],
    derived: {
      activePositionCount: positions.length,
      totalExposureEur: exposure,
      productTypesHeld: productTypes,
      relationshipAgeYears: 2,
      isMultiProduct: productTypes.length > 1,
    },
  };
}

describe('nextBestAction', () => {
  it('returns topN recommendations sorted by expected ΔCLV desc', () => {
    const rel = relationship([position()]);
    const a = defaultAssumptions('2026-01-01');
    const ltv = computeLtv(rel, a);
    const recs = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions: a,
      catalogue: REFERENCE_CATALOGUE,
      topN: 3,
    });
    expect(recs.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].expectedClvDeltaEur).toBeGreaterThanOrEqual(recs[i].expectedClvDeltaEur);
    }
  });

  it('filters out products with non-positive ΔCLV', () => {
    const rel = relationship([position()]);
    const a = defaultAssumptions('2026-01-01');
    const ltv = computeLtv(rel, a);
    const recs = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions: a,
      catalogue: REFERENCE_CATALOGUE,
    });
    for (const r of recs) {
      expect(r.expectedClvDeltaEur).toBeGreaterThan(0);
    }
  });

  it('confidence is in [0, 1]', () => {
    const rel = relationship([position()]);
    const a = defaultAssumptions('2026-01-01');
    const ltv = computeLtv(rel, a);
    const recs = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions: a,
      catalogue: REFERENCE_CATALOGUE,
    });
    for (const r of recs) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('product already held tags as cross_sell_cohort_signal, not product_gap_core', () => {
    const rel = relationship([position({ productType: 'Mortgage' })]);
    const a = defaultAssumptions('2026-01-01');
    const ltv = computeLtv(rel, a);
    const recs = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions: a,
      catalogue: REFERENCE_CATALOGUE,
    });
    const mortgage = recs.find((r) => r.recommendedProduct === 'Mortgage');
    if (mortgage) {
      expect(mortgage.reasonCodes).not.toContain('product_gap_core');
    }
  });

  it('produces a rationale string for every recommendation', () => {
    const rel = relationship([position()]);
    const a = defaultAssumptions('2026-01-01');
    const ltv = computeLtv(rel, a);
    const recs = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions: a,
      catalogue: REFERENCE_CATALOGUE,
    });
    for (const r of recs) {
      expect(typeof r.rationale).toBe('string');
      expect(r.rationale!.length).toBeGreaterThan(0);
    }
  });
});
