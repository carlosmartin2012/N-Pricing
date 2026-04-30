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

import budgetRouter from '../../server/routes/budget';
import { adapterRegistry } from '../../integrations/registry';
import { InMemoryBudgetSource } from '../../integrations/inMemory';

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
  app.use('/api/budget', budgetRouter);
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

describe('budget router · /comparison', () => {
  it('sin x-entity-id → 400', async () => {
    adapterRegistry.register(new InMemoryBudgetSource());
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/budget/comparison?period=2026-04');
      expect(r.status).toBe(400);
    });
  });

  it('sin adapter registrado → 503 no_adapter', async () => {
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/budget/comparison?period=2026-04');
      expect(r.status).toBe(503);
    });
  });

  it('cruza supuestos con realizado y devuelve summary + items', async () => {
    const adapter = new InMemoryBudgetSource();
    adapter.seedAssumptions('2026-04', [
      {
        period:               '2026-04',
        segment:              'SME',
        productType:          'loan',
        currency:             'EUR',
        budgetedRateBps:      500,
        budgetedVolumeEur:    1_000_000,
        budgetedRarocPp:      14,
        externalAssumptionId: 'ALQ-1',
        fixedAt:              '2026-01-15T08:00:00Z',
        notes:                null,
      },
    ]);
    adapterRegistry.register(adapter);

    // Mock realized aggregation
    dbMock.query.mockResolvedValueOnce([
      {
        segment: 'SME', product_type: 'loan', currency: 'EUR',
        realized_rate_bps:   '510',          // +10 bps drift
        realized_volume_eur: '1100000',
        realized_raroc_pp:   '14',
        deal_count:          '12',
      },
    ]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/budget/comparison?period=2026-04');
      expect(r.status).toBe(200);
      const body = r.body as {
        period: string;
        summary: { total: number; overRate: number; weightedAvgDiffRateBps: number };
        items: Array<{ status: string; diffRateBps: number }>;
      };
      expect(body.period).toBe('2026-04');
      expect(body.summary.total).toBe(1);
      expect(body.summary.overRate).toBe(1);
      expect(body.summary.weightedAvgDiffRateBps).toBeCloseTo(10, 4);
      expect(body.items[0].status).toBe('over_budget_rate');
      expect(body.items[0].diffRateBps).toBe(10);
    });
  });

  // Anti-regresión Ola 10.5 fix #19 — period inválido NO debe colapsar
  // a "este mes" silenciosamente; trazabilidad del replay regulatorio
  // se rompía cuando un dashboard pedía '2024-13' y veía datos de hoy.
  it('period inválido (no YYYY-MM) → 400 invalid_period_format', async () => {
    adapterRegistry.register(new InMemoryBudgetSource());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/budget/comparison?period=invalid');
      expect(r.status).toBe(400);
      const body = r.body as { code: string };
      expect(body.code).toBe('invalid_period_format');
    });
  });

  it('period ausente → defaultea al mes actual', async () => {
    adapterRegistry.register(new InMemoryBudgetSource());
    dbMock.query.mockResolvedValueOnce([]);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/budget/comparison');
      expect(r.status).toBe(200);
      const body = r.body as { period: string };
      expect(body.period).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

describe('budget router · /health', () => {
  it('reporta kind=budget + ok=true para in-memory', async () => {
    adapterRegistry.register(new InMemoryBudgetSource());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/budget/health');
      expect(r.status).toBe(200);
      const body = r.body as { kind: string; health: { ok: boolean } };
      expect(body.kind).toBe('budget');
      expect(body.health.ok).toBe(true);
    });
  });
});
