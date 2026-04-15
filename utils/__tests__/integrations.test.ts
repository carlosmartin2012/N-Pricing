import { describe, it, expect, beforeEach } from 'vitest';
import { _newRegistry } from '../../integrations/registry';
import { InMemoryCoreBanking, InMemoryCrm, InMemoryMarketData } from '../../integrations/inMemory';
import { DemoSsoProvider, deriveRoleFromGroups } from '../../integrations/sso';

describe('adapter registry', () => {
  it('routes by kind and only returns matching adapters', () => {
    const r = _newRegistry();
    const cb = new InMemoryCoreBanking();
    const crm = new InMemoryCrm();
    r.register(cb);
    r.register(crm);
    expect(r.coreBanking()).toBe(cb);
    expect(r.crm()).toBe(crm);
    expect(r.marketData()).toBeNull();
  });

  it('healthAll captures every registered adapter', async () => {
    const r = _newRegistry();
    r.register(new InMemoryCoreBanking());
    r.register(new InMemoryCrm());
    const reports = await r.healthAll();
    expect(reports).toHaveLength(2);
    expect(reports.every((x) => x.health.ok)).toBe(true);
  });
});

describe('InMemoryCoreBanking', () => {
  let cb: InMemoryCoreBanking;
  beforeEach(() => { cb = new InMemoryCoreBanking(); });

  it('returns only Active deals', async () => {
    cb.seed('c-1', [
      { id: 'd1', clientId: 'c-1', productType: 'MORTGAGE', amount: 100, currency: 'EUR', startDate: '2024-01-01', maturityDate: null, marginBps: 100, status: 'Active' },
      { id: 'd2', clientId: 'c-1', productType: 'MORTGAGE', amount: 50, currency: 'EUR', startDate: '2020-01-01', maturityDate: null, marginBps: 100, status: 'Matured' },
    ]);
    const r = await cb.fetchActiveDeals('c-1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(1);
  });

  it('upsert replaces deal in place', async () => {
    cb.seed('c-1', [
      { id: 'd1', clientId: 'c-1', productType: 'MORTGAGE', amount: 100, currency: 'EUR', startDate: '2024-01-01', maturityDate: null, marginBps: 100, status: 'Active' },
    ]);
    await cb.upsertBookedDeal({
      id: 'd1', clientId: 'c-1', productType: 'MORTGAGE', amount: 999, currency: 'EUR',
      startDate: '2024-01-01', maturityDate: null, marginBps: 120, status: 'Active',
    });
    const r = await cb.fetchActiveDeals('c-1');
    if (r.ok) expect(r.value[0].amount).toBe(999);
  });

  it('rejects malformed upserts', async () => {
    const r = await cb.upsertBookedDeal({
      id: '', clientId: '', productType: '', amount: 0, currency: '',
      startDate: '', maturityDate: null, marginBps: null, status: 'Active',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('parse_error');
  });
});

describe('InMemoryMarketData', () => {
  it('handles inverse FX', async () => {
    const md = new InMemoryMarketData();
    md.seedFx('EUR', 'USD', 1.10);
    const direct = await md.fetchFxRate('EUR', 'USD');
    if (direct.ok) expect(direct.value).toBeCloseTo(1.10);
    const inverse = await md.fetchFxRate('USD', 'EUR');
    if (inverse.ok) expect(inverse.value).toBeCloseTo(1 / 1.10, 6);
    const same = await md.fetchFxRate('EUR', 'EUR');
    if (same.ok) expect(same.value).toBe(1);
  });

  it('returns not_found for missing currency', async () => {
    const md = new InMemoryMarketData();
    const r = await md.fetchYieldCurve('XYZ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not_found');
  });
});

describe('DemoSsoProvider', () => {
  it('accepts a well-formed demo token', async () => {
    const p = new DemoSsoProvider();
    const id = await p.verifyToken('demo:user-1:carlos@bank.es:Carlos M:admin,trader');
    expect(id).toMatchObject({ sub: 'user-1', email: 'carlos@bank.es', displayName: 'Carlos M' });
    expect(id?.groups).toEqual(['admin', 'trader']);
  });

  it('returns null for malformed tokens', async () => {
    const p = new DemoSsoProvider();
    expect(await p.verifyToken('not-a-demo-token')).toBeNull();
    expect(await p.verifyToken('demo:only-one')).toBeNull();
  });
});

describe('deriveRoleFromGroups', () => {
  const map = { 'risk-team': 'Risk_Manager', 'admin-team': 'Admin' };
  it('picks the first matching group', () => {
    expect(deriveRoleFromGroups(['something', 'risk-team', 'admin-team'], map)).toBe('Risk_Manager');
  });
  it('falls back when no group matches', () => {
    expect(deriveRoleFromGroups(['unrelated'], map, 'Trader')).toBe('Trader');
  });
});
