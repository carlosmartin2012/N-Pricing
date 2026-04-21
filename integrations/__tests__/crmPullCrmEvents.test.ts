import { describe, it, expect } from 'vitest';
import { InMemoryCrm } from '../inMemory';
import { SalesforceCrmAdapter } from '../crm/salesforce';
import type { CrmPulledEvent } from '../types';

describe('InMemoryCrm.pullCrmEvents', () => {
  it('returns empty for clients with no seeded events', async () => {
    const crm = new InMemoryCrm();
    const res = await crm.pullCrmEvents('client-x');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual([]);
  });

  it('returns all events when since is omitted', async () => {
    const crm = new InMemoryCrm();
    const events: CrmPulledEvent[] = [
      { externalId: 'e1', clientExternalId: 'c1', kind: 'contact', occurredAt: '2026-03-01T10:00:00Z', payload: {} },
      { externalId: 'e2', clientExternalId: 'c1', kind: 'claim',   occurredAt: '2026-04-01T10:00:00Z', payload: {} },
    ];
    crm.seedEvents('c1', events);
    const res = await crm.pullCrmEvents('c1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toHaveLength(2);
  });

  it('filters by since exclusive', async () => {
    const crm = new InMemoryCrm();
    crm.seedEvents('c1', [
      { externalId: 'e1', clientExternalId: 'c1', kind: 'contact', occurredAt: '2026-03-01T10:00:00Z', payload: {} },
      { externalId: 'e2', clientExternalId: 'c1', kind: 'claim',   occurredAt: '2026-04-01T10:00:00Z', payload: {} },
    ]);
    const res = await crm.pullCrmEvents('c1', '2026-03-15T00:00:00Z');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(1);
      expect(res.value[0].externalId).toBe('e2');
    }
  });
});

describe('SalesforceCrmAdapter.pullCrmEvents', () => {
  it('returns empty ok result when credentials are missing (stub mode)', async () => {
    const sf = new SalesforceCrmAdapter({
      instanceUrl: 'https://test.my.salesforce.com',
      clientId: 'app-id',
      clientSecret: '',
    });
    const res = await sf.pullCrmEvents('c1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual([]);
  });

  it('fails with unreachable when credentials exist but HTTP not implemented', async () => {
    const sf = new SalesforceCrmAdapter({
      instanceUrl: 'https://test.my.salesforce.com',
      clientId: 'app-id',
      clientSecret: 'secret-present',
    });
    const res = await sf.pullCrmEvents('c1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('unreachable');
  });
});
