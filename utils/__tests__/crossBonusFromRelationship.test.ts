import { describe, it, expect } from 'vitest';
import { deriveAttachmentsFromRelationship, __TEST_HELPERS__ } from '../customer360/crossBonusFromRelationship';
import type { ClientPosition, ClientRelationship } from '../../types/customer360';
import type { ClientEntity } from '../../types';

const CLIENT: ClientEntity = {
  id: 'c-1', name: 'Acme', type: 'Retail', segment: 'Retail', rating: 'BBB+',
};

const make = (overrides: Partial<ClientPosition>): ClientPosition => ({
  id: 'p',
  entityId: 'e',
  clientId: 'c-1',
  productId: null,
  productType: 'PAYROLL',
  category: 'Service',
  dealId: null,
  amount: 0,
  currency: 'EUR',
  marginBps: null,
  startDate: '2024-04-01',
  maturityDate: null,
  status: 'Active',
  createdAt: '2024-04-01T00:00:00Z',
  updatedAt: '2024-04-01T00:00:00Z',
  ...overrides,
});

const rel = (positions: ClientPosition[]): ClientRelationship => ({
  client: CLIENT,
  positions,
  metrics: { latest: null, history: [] },
  applicableTargets: [],
  derived: {
    activePositionCount: positions.filter((p) => p.status === 'Active').length,
    totalExposureEur: 0,
    productTypesHeld: positions.map((p) => p.productType),
    relationshipAgeYears: null,
    isMultiProduct: positions.length > 1,
  },
});

describe('deriveAttachmentsFromRelationship', () => {
  it('maps known synonyms (NOMINA → PAYROLL)', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'NOMINA' })]),
      { asOfDate: '2024-06-01' }, // < 1y → no boost
    );
    expect(attachments).toEqual([{ ruleId: 'NOMINA' }]);
  });

  it('skips matured positions', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'PAYROLL', status: 'Matured' })]),
    );
    expect(attachments).toHaveLength(0);
  });

  it('skips unknown product types silently', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'UNKNOWN_THING' })]),
    );
    expect(attachments).toHaveLength(0);
  });

  it('deduplicates when client holds two positions matching the same rule', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([
        make({ id: 'p1', productType: 'PAYROLL' }),
        make({ id: 'p2', productType: 'NOMINA' }),
      ]),
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0].ruleId).toBe('NOMINA');
  });

  it('boosts probability for medium-tenure relationships (1-3y)', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'PAYROLL', startDate: '2024-01-01' })]),
      { asOfDate: '2026-04-15' },
    );
    // 2.3y → +0.05 boost; default 0.85 → 0.90
    expect(attachments[0].overrideProbability).toBeCloseTo(0.90, 4);
  });

  it('caps the 5y+ boost at 0.95 even from a high baseline', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'PAYROLL', startDate: '2018-01-01' })]),
      { asOfDate: '2026-04-15' },
    );
    expect(attachments[0].overrideProbability).toBe(0.95);
  });

  it('caps the boosted probability at 0.95', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([make({ productType: 'PAYROLL', startDate: '2010-01-01' })]),
      {
        asOfDate: '2026-04-15',
        catalogue: [{
          id: 'NOMINA', productType: 'PAYROLL', label: 'X',
          rateDiscountBps: 25, annualMarginEur: 80, fulfillmentProbability: 0.92, stackable: true,
        }],
      },
    );
    expect(attachments[0].overrideProbability).toBe(0.95);
  });

  it('respects custom filter (e.g. exclude services from corporate deals)', () => {
    const attachments = deriveAttachmentsFromRelationship(
      rel([
        make({ id: 'p1', productType: 'PAYROLL' }),
        make({ id: 'p2', productType: 'CREDIT_CARD' }),
      ]),
      { filter: (rule) => rule.id !== 'TARJETA' },
    );
    expect(attachments.map((a) => a.ruleId)).toEqual(['NOMINA']);
  });
});

describe('helper internals', () => {
  it('normalize handles case + whitespace', () => {
    expect(__TEST_HELPERS__.normalize('  payroll ')).toBe('PAYROLL');
    expect(__TEST_HELPERS__.normalize('seg_hogar')).toBe('HOME_INSURANCE');
    expect(__TEST_HELPERS__.normalize('foo')).toBeNull();
  });
  it('yearsBetween handles inverted dates as 0', () => {
    expect(__TEST_HELPERS__.yearsBetween('2026-01-01', '2024-01-01')).toBe(0);
  });
});
