// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const dbMock = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
  withTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import whatIfRouter from '../../server/routes/whatIf';

const ENTITY = '00000000-0000-0000-0000-000000000099';

async function withApp<T>(fn: (baseUrl: string) => Promise<T>, role = 'Admin'): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as {
      tenancy: { entityId: string; userEmail: string; role: string };
      user: { email: string; name: string; role: string };
    }).tenancy = { entityId: ENTITY, userEmail: 'methodologist@nfq.es', role };
    (req as unknown as { user: { email: string; name: string; role: string } }).user = {
      email: 'methodologist@nfq.es',
      name: 'Methodologist',
      role,
    };
    next();
  });
  app.use('/api/what-if', whatIfRouter);
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

async function http<T>(baseUrl: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const parsed = text ? JSON.parse(text) as T : null as T;
  return { status: r.status, body: parsed };
}

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
  dbMock.execute.mockReset();
  dbMock.withTransaction.mockReset();
});

describe('what-if router', () => {
  it('lists sandbox methodologies as camelCase DTOs', async () => {
    dbMock.query.mockResolvedValueOnce([
      {
        id: 'sb-1',
        name: 'NIM uplift',
        description: null,
        base_snapshot_id: 'snap-1',
        status: 'draft',
        diffs: [{ parameterPath: 'liquidity', currentValue: 0, proposedValue: 12 }],
        created_at: '2026-05-01T00:00:00Z',
        created_by_email: 'methodologist@nfq.es',
        created_by_name: 'Methodologist',
        updated_at: '2026-05-02T00:00:00Z',
        entity_id: ENTITY,
      },
    ]);

    await withApp(async (url) => {
      const r = await http<Array<{ id: string; baseSnapshotId: string; diffs: unknown[] }>>(
        url,
        'GET',
        '/api/what-if/sandboxes',
      );
      expect(r.status).toBe(200);
      expect(r.body[0]).toMatchObject({
        id: 'sb-1',
        baseSnapshotId: 'snap-1',
        diffs: [{ parameterPath: 'liquidity', currentValue: 0, proposedValue: 12 }],
      });
    });
  });

  it('creates a sandbox against the current methodology snapshot when baseSnapshotId is omitted', async () => {
    dbMock.queryOne
      .mockResolvedValueOnce({ id: 'snap-current' })
      .mockResolvedValueOnce({
        id: 'sb-new',
        name: 'Credit spread test',
        description: 'Scenario',
        base_snapshot_id: 'snap-current',
        status: 'draft',
        diffs: [],
        created_at: '2026-05-01T00:00:00Z',
        created_by_email: 'methodologist@nfq.es',
        created_by_name: 'Methodologist',
        updated_at: '2026-05-01T00:00:00Z',
        entity_id: ENTITY,
      });

    await withApp(async (url) => {
      const r = await http<{ id: string; baseSnapshotId: string }>(
        url,
        'POST',
        '/api/what-if/sandboxes',
        { name: 'Credit spread test', description: 'Scenario', diffs: [] },
      );
      expect(r.status).toBe(201);
      expect(r.body.baseSnapshotId).toBe('snap-current');
      expect(dbMock.queryOne).toHaveBeenCalledTimes(2);
    });
  });

  it('rejects sandbox writes for non-methodology roles', async () => {
    await withApp(async (url) => {
      const r = await http<{ code: string }>(
        url,
        'POST',
        '/api/what-if/sandboxes',
        { name: 'Unauthorized' },
      );
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('forbidden');
      expect(dbMock.queryOne).not.toHaveBeenCalled();
    }, 'Trader');
  });

  it('computes cohort-scoped impact with elasticity and booked deal portfolio', async () => {
    dbMock.queryOne.mockResolvedValueOnce({
      id: 'sb-1',
      name: 'NII uplift',
      base_snapshot_id: 'snap-1',
      status: 'draft',
      diffs: [{
        parameterPath: 'rules.margin',
        parameterLabel: 'Margin',
        changeType: 'spread',
        currentValue: 0,
        proposedValue: 20,
        scope: { products: ['LOAN_COMM'], segments: ['Corporate'] },
      }],
      created_at: '2026-05-01T00:00:00Z',
      created_by_email: 'methodologist@nfq.es',
      created_by_name: 'Methodologist',
      updated_at: '2026-05-01T00:00:00Z',
      entity_id: ENTITY,
    });
    dbMock.query
      .mockResolvedValueOnce([
        {
          id: 'cell-1',
          snapshot_id: 'snap-1',
          entity_id: ENTITY,
          product: 'LOAN_COMM',
          segment: 'Corporate',
          tenor_bucket: '1-3Y',
          currency: 'EUR',
          canonical_deal_input: { amount: 1_000_000 },
          ftp: 2.1,
          target_margin: 1.9,
          target_client_rate: 4,
          target_raroc: 12,
          components: {},
          computed_at: '2026-05-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'ela-1',
          segment_key: 'LOAN_COMM|Corporate|EUR|ALL',
          elasticity: 0.1,
          baseline_conversion: 0,
          sample_size: 120,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'deal-1',
          product_type: 'LOAN_COMM',
          client_type: 'Corporate',
          currency: 'EUR',
          amount: 2_000_000,
          duration_months: 24,
          pricing_snapshot: { output: { finalClientRate: 4, raroc: 11 } },
        },
      ]);

    await withApp(async (url) => {
      const r = await http<{
        summary: { totalCellsAffected: number; avgFtpChangeBps: number; avgRarocChangePp: number };
        cellImpacts: Array<{ clientRateDeltaBps: number; estimatedVolumeDelta: number; elasticityModelId: string }>;
        portfolioImpact: { dealCount: number; affectedDealCount: number; niiDelta: number };
      }>(
        url,
        'GET',
        '/api/what-if/sandboxes/sb-1/impact',
      );
      expect(r.status).toBe(200);
      expect(r.body.summary).toMatchObject({
        totalCellsAffected: 1,
        avgFtpChangeBps: 20,
        avgRarocChangePp: -0.2,
      });
      expect(r.body.cellImpacts[0]).toMatchObject({
        clientRateDeltaBps: 20,
        estimatedVolumeDelta: -20_000,
        elasticityModelId: 'ela-1',
      });
      expect(r.body.portfolioImpact.dealCount).toBe(1);
      expect(r.body.portfolioImpact.affectedDealCount).toBe(1);
      expect(r.body.portfolioImpact.niiDelta).toBeCloseTo(4_640, 6);
    });
  });

  it('compares target-grid cells against latest matching market benchmarks', async () => {
    dbMock.query
      .mockResolvedValueOnce([
        {
          id: 'cell-1',
          snapshot_id: 'snap-1',
          entity_id: ENTITY,
          product: 'LOAN_COMM',
          segment: 'Corporate',
          tenor_bucket: '1-3Y',
          currency: 'EUR',
          target_client_rate: 4.45,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'bench-1',
          product_type: 'LOAN_COMM',
          tenor_bucket: 'MT',
          client_type: 'Corporate',
          currency: 'EUR',
          rate: 4.1,
          source: 'BdE',
          as_of_date: '2026-05-01',
        },
      ]);

    await withApp(async (url) => {
      const r = await http<Array<{ deltaBps: number; source: string }>>(
        url,
        'GET',
        '/api/what-if/benchmarks/compare?snapshot_id=snap-1',
      );
      expect(r.status).toBe(200);
      expect(r.body[0].source).toBe('BdE');
      expect(r.body[0].deltaBps).toBeCloseTo(35, 6);
    });
  });
});
