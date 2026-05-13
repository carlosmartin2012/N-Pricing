import { describe, expect, it } from 'vitest';
import type { PricingCampaign } from '../../types';
import { findApplicableCampaigns, findBenchmark, parseMarketBenchmarksCsv, pickBestForBorrower } from '@npricing/commercial';
import { verifySnapshotChain } from '@npricing/evidence';
import { computeDueAt, promoteLevel } from '@npricing/governance';

describe('platform package facades', () => {
  it('exposes evidence hash-chain verification', () => {
    expect(
      verifySnapshotChain([
        { id: 's1', outputHash: 'h1', prevOutputHash: null },
        { id: 's2', outputHash: 'h2', prevOutputHash: 'h1' },
      ])
    ).toEqual({ valid: true, checked: 2 });
  });

  it('exposes governance escalation helpers', () => {
    expect(promoteLevel('L1')).toBe('L2');
    expect(computeDueAt(new Date('2026-01-01T00:00:00.000Z'), 24)).toBe('2026-01-02T00:00:00.000Z');
  });

  it('exposes commercial campaign matching', () => {
    const campaigns: PricingCampaign[] = [
      campaign({ id: 'c1', rateDeltaBps: -10 }),
      campaign({ id: 'c2', rateDeltaBps: -25 }),
      campaign({ id: 'expired', activeTo: '2025-12-31' }),
    ];

    const matches = findApplicableCampaigns(campaigns, {
      entityId: 'entity-1',
      segment: 'Corporate',
      productType: 'LOAN_COMM',
      currency: 'EUR',
      channel: 'branch',
      asOfDate: '2026-01-15',
    });

    expect(matches.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(pickBestForBorrower(matches)?.id).toBe('c2');
  });

  it('exposes commercial market benchmark helpers', () => {
    const benchmark = findBenchmark(
      [
        {
          productType: 'LOAN_COMM',
          tenorBucket: 'MT',
          clientType: 'Corporate',
          currency: 'EUR',
          rate: 4.22,
          source: 'BBG',
          asOfDate: '2026-04-01',
        },
      ],
      { productType: 'LOAN_COMM', clientType: 'Corporate', currency: 'EUR', durationMonths: 36 },
    );

    expect(benchmark?.rate).toBe(4.22);
    expect(parseMarketBenchmarksCsv('productType,tenorBucket,clientType,currency,rate,source\nLOAN_COMM,MT,Corporate,EUR,4.22,BBG').rows).toHaveLength(1);
  });
});

function campaign(overrides: Partial<PricingCampaign>): PricingCampaign {
  return {
    id: 'campaign',
    entityId: 'entity-1',
    code: 'CMP-1',
    name: 'Campaign',
    segment: 'Corporate',
    productType: 'LOAN_COMM',
    currency: 'EUR',
    channel: 'branch',
    status: 'active',
    rateDeltaBps: -10,
    maxVolumeEur: null,
    consumedVolumeEur: 0,
    activeFrom: '2026-01-01',
    activeTo: '2026-12-31',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    parentVersionId: null,
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    ...overrides,
  };
}
