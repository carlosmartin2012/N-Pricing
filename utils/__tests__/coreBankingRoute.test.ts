// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const dbMock = vi.hoisted(() => ({
  pool:                   { query: vi.fn(), connect: vi.fn() },
  query:                  vi.fn(),
  queryOne:               vi.fn(),
  execute:                vi.fn(),
  withTransaction:        vi.fn(),
  withTenancyTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import coreBankingRouter from '../../server/routes/coreBanking';
import { adapterRegistry } from '../../integrations/registry';
import { InMemoryCoreBanking } from '../../integrations/inMemory';

interface SyntheticTenancy { entityId: string }

async function withApp<T>(
  tenancy: SyntheticTenancy | null,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  if (tenancy) {
    app.use((req, _res, next) => {
      (req as unknown as { tenancy: SyntheticTenancy }).tenancy = tenancy;
      next();
    });
  }
  app.use('/api/core-banking', coreBankingRouter);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function http<T>(baseUrl: string, method: string, path: string) {
  const r = await fetch(`${baseUrl}${path}`, { method });
  let parsed: unknown = null;
  const text = await r.text();
  if (text) try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed as T };
}

const ENTITY = '00000000-0000-0000-0000-000000000099';

beforeEach(() => {
  adapterRegistry.clear();
  dbMock.query.mockReset();
});

describe('coreBanking router · /reconciliation', () => {
  it('sin x-entity-id → 400', async () => {
    adapterRegistry.register(new InMemoryCoreBanking());
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/core-banking/reconciliation?as_of=2026-04-30');
      expect(r.status).toBe(400);
    });
  });

  it('sin adapter registrado → 503', async () => {
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/core-banking/reconciliation?as_of=2026-04-30');
      expect(r.status).toBe(503);
    });
  });

  it('cruza booked rows con pricing snapshots y devuelve outcomes + summary', async () => {
    const adapter = new InMemoryCoreBanking();
    adapter.seedBookedRows([
      { dealId: 'd-match',    externalDealId: null, clientId: 'c1', productType: 'loan', bookedRateBps: 485, amountEur: 100_000, currency: 'EUR', bookedAt: '2026-04-30T10:00:00Z', status: 'booked' },
      { dealId: 'd-mismatch', externalDealId: null, clientId: 'c1', productType: 'loan', bookedRateBps: 490, amountEur: 100_000, currency: 'EUR', bookedAt: '2026-04-30T10:00:00Z', status: 'booked' },
    ]);
    adapterRegistry.register(adapter);

    dbMock.query.mockResolvedValueOnce([
      { deal_id: 'd-match',    output: { finalClientRate: 0.0485 }, output_hash: 'h1', created_at: '2026-04-30T09:00:00Z' },
      { deal_id: 'd-mismatch', output: { finalClientRate: 0.0485 }, output_hash: 'h2', created_at: '2026-04-30T09:00:00Z' },
      { deal_id: 'd-missing',  output: { finalClientRate: 0.0480 }, output_hash: 'h3', created_at: '2026-04-30T09:00:00Z' },
    ]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/core-banking/reconciliation?as_of=2026-04-30');
      expect(r.status).toBe(200);
      const body = r.body as {
        summary: { matched: number; mismatchRate: number; mismatchMissing: number; unknownInPricing: number };
        outcomes: Array<{ dealId: string; status: string }>;
      };
      expect(body.summary.matched).toBe(1);
      expect(body.summary.mismatchRate).toBe(1);
      expect(body.summary.mismatchMissing).toBe(1);
      expect(body.summary.unknownInPricing).toBe(0);
      expect(body.outcomes.find((o) => o.dealId === 'd-mismatch')?.status).toBe('mismatch_rate');
    });
  });

  it('respeta tolerance_bps query param', async () => {
    const adapter = new InMemoryCoreBanking();
    adapter.seedBookedRows([
      { dealId: 'd1', externalDealId: null, clientId: 'c1', productType: 'loan', bookedRateBps: 487, amountEur: 100_000, currency: 'EUR', bookedAt: '2026-04-30T10:00:00Z', status: 'booked' },
    ]);
    adapterRegistry.register(adapter);
    dbMock.query.mockResolvedValueOnce([
      { deal_id: 'd1', output: { finalClientRate: 0.0485 }, output_hash: 'h1', created_at: '2026-04-30T09:00:00Z' },
    ]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/core-banking/reconciliation?as_of=2026-04-30&tolerance_bps=3');
      expect(r.status).toBe(200);
      const body = r.body as { toleranceBps: number; summary: { matched: number; mismatchRate: number } };
      expect(body.toleranceBps).toBe(3);
      expect(body.summary.matched).toBe(1);
      expect(body.summary.mismatchRate).toBe(0);
    });
  });
});

describe('coreBanking router · /health', () => {
  it('reporta kind=core_banking + name + health.ok', async () => {
    adapterRegistry.register(new InMemoryCoreBanking());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/core-banking/health');
      expect(r.status).toBe(200);
      const body = r.body as { kind: string; health: { ok: boolean } };
      expect(body.kind).toBe('core_banking');
      expect(body.health.ok).toBe(true);
    });
  });
});
