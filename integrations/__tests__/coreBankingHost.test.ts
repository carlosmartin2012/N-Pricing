import { describe, it, expect } from 'vitest';
import { InMemoryCoreBanking } from '../inMemory';
import { BmHostCoreBanking } from '../coreBanking/bmHost';
import type { CoreBankingBookedRow } from '../types';

const sampleRow: CoreBankingBookedRow = {
  dealId:         'd1',
  externalDealId: 'EXT-1',
  clientId:       'c1',
  productType:    'loan',
  bookedRateBps:  485,
  amountEur:      100_000,
  currency:       'EUR',
  bookedAt:       '2026-04-30T10:00:00Z',
  status:         'booked',
};

describe('InMemoryCoreBanking · pullBookedRows', () => {
  it('devuelve [] si no hay rows seedados', async () => {
    const a = new InMemoryCoreBanking();
    const r = await a.pullBookedRows('2026-04-30');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toEqual([]);
  });

  it('devuelve los rows seedados', async () => {
    const a = new InMemoryCoreBanking();
    a.seedBookedRows([sampleRow]);
    const r = await a.pullBookedRows('2026-04-30');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toHaveLength(1);
    expect(r.value[0].dealId).toBe('d1');
  });
});

describe('BmHostCoreBanking · stub behavior', () => {
  const config = {
    sftpHost:           'host-recon.bancamarch.es',
    sftpUser:           'pricing-recon',
    sftpPrivateKeyPem:  '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    dropDirectory:      '/incoming/pricing-recon',
  };

  it('throws en constructor si falta sftp config crítica', () => {
    expect(() => new BmHostCoreBanking({ ...config, sftpHost:           '' })).toThrow();
    expect(() => new BmHostCoreBanking({ ...config, sftpUser:           '' })).toThrow();
    expect(() => new BmHostCoreBanking({ ...config, sftpPrivateKeyPem:  '' })).toThrow();
    expect(() => new BmHostCoreBanking({ ...config, dropDirectory:      '' })).toThrow();
  });

  it('health reporta ok=false con sftpHost + dropDirectory en mensaje', async () => {
    const a = new BmHostCoreBanking(config);
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.message).toContain(config.sftpHost);
    expect(h.message).toContain(config.dropDirectory);
  });

  it('fetchActiveDeals devuelve fail not_found con explicación batch-only', async () => {
    const a = new BmHostCoreBanking(config);
    const r = await a.fetchActiveDeals('any');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('not_found');
      expect(r.error.message).toMatch(/batch-only/i);
    }
  });

  it('upsertBookedDeal devuelve fail unreachable con explicación', async () => {
    const a = new BmHostCoreBanking(config);
    const r = await a.upsertBookedDeal({
      id: 'd1', clientId: 'c1', productType: 'loan', amount: 100, currency: 'EUR',
      startDate: '2026-04-30', maturityDate: null, marginBps: null, status: 'Active',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unreachable');
  });

  it('pullBookedRows devuelve ok([]) (stub)', async () => {
    const a = new BmHostCoreBanking(config);
    const r = await a.pullBookedRows('2026-04-30');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toEqual([]);
  });
});
