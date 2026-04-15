import { describe, it, expect } from 'vitest';
import {
  findApplicableCampaigns,
  pickBestForBorrower,
  remainingVolume,
} from '../channels/campaignMatcher';
import type { PricingCampaign } from '../../types/channels';

const ENTITY = '00000000-0000-0000-0000-000000000010';

const make = (overrides: Partial<PricingCampaign> = {}): PricingCampaign => ({
  id:                'c-1',
  entityId:          ENTITY,
  code:              'SUMMER',
  name:              'Summer 2026',
  segment:           'Retail',
  productType:       'MORTGAGE',
  currency:          'EUR',
  channel:           null,
  rateDeltaBps:      -10,
  maxVolumeEur:      1_000_000,
  consumedVolumeEur: 0,
  activeFrom:        '2026-04-01',
  activeTo:          '2026-09-30',
  status:            'active',
  version:           1,
  parentVersionId:   null,
  createdBy:         'rm@bank.es',
  approvedBy:        'admin@bank.es',
  approvedAt:        '2026-04-01T08:00:00Z',
  createdAt:         '2026-03-30T00:00:00Z',
  updatedAt:         '2026-04-01T08:00:00Z',
  ...overrides,
});

const lookup = {
  entityId: ENTITY, segment: 'Retail', productType: 'MORTGAGE',
  currency: 'EUR', asOfDate: '2026-04-15',
};

describe('findApplicableCampaigns', () => {
  it('returns campaigns within the active window', () => {
    expect(findApplicableCampaigns([make()], lookup)).toHaveLength(1);
  });
  it('rejects expired/future windows', () => {
    expect(findApplicableCampaigns([make({ activeFrom: '2026-01-01', activeTo: '2026-01-31' })], lookup)).toHaveLength(0);
    expect(findApplicableCampaigns([make({ activeFrom: '2026-12-01', activeTo: '2026-12-31' })], lookup)).toHaveLength(0);
  });
  it('rejects exhausted campaigns', () => {
    expect(findApplicableCampaigns([make({ maxVolumeEur: 100, consumedVolumeEur: 100 })], lookup)).toHaveLength(0);
  });
  it('rejects draft / cancelled / expired', () => {
    expect(findApplicableCampaigns([make({ status: 'draft' })],     lookup)).toHaveLength(0);
    expect(findApplicableCampaigns([make({ status: 'cancelled' })], lookup)).toHaveLength(0);
    expect(findApplicableCampaigns([make({ status: 'expired' })],   lookup)).toHaveLength(0);
  });
  it('honours channel restriction when present', () => {
    const c = make({ channel: 'web' });
    expect(findApplicableCampaigns([c], { ...lookup, channel: 'web' })).toHaveLength(1);
    expect(findApplicableCampaigns([c], { ...lookup, channel: 'branch' })).toHaveLength(0);
    // No channel passed → channel-restricted campaign rejected
    expect(findApplicableCampaigns([c], lookup)).toHaveLength(0);
  });
  it('null channel = available to all channels including unspecified', () => {
    const c = make({ channel: null });
    expect(findApplicableCampaigns([c], lookup)).toHaveLength(1);
    expect(findApplicableCampaigns([c], { ...lookup, channel: 'mobile' })).toHaveLength(1);
  });
});

describe('pickBestForBorrower', () => {
  it('returns null with no matches', () => {
    expect(pickBestForBorrower([])).toBeNull();
  });
  it('picks the most aggressive (most negative) discount', () => {
    const a = make({ id: 'a', rateDeltaBps: -10 });
    const b = make({ id: 'b', rateDeltaBps: -25 });
    const c = make({ id: 'c', rateDeltaBps:  -5 });
    expect(pickBestForBorrower([a, b, c])?.id).toBe('b');
  });
});

describe('remainingVolume', () => {
  it('returns Infinity when uncapped', () => {
    expect(remainingVolume(make({ maxVolumeEur: null }))).toBe(Number.POSITIVE_INFINITY);
  });
  it('clamps to zero when over-consumed', () => {
    expect(remainingVolume(make({ maxVolumeEur: 100, consumedVolumeEur: 250 }))).toBe(0);
  });
});
