// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// Mock pg.Pool / query / queryOne so the router never touches a real DB.
const dbMock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {
    pool:     { query: vi.fn(), connect: vi.fn() },
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn(),
  };
  return obj;
});
vi.mock('../../server/db', () => dbMock);

// Adapter registry pulls in too much; stub it out.
vi.mock('../../integrations/registry', () => ({
  adapterRegistry: { healthAll: vi.fn().mockResolvedValue([]) },
}));

import observabilityRouter from '../../server/routes/observability';

interface SyntheticTenancy {
  entityId: string;
  userEmail?: string | null;
  role?: string | null;
}

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
  app.use('/api/observability', observabilityRouter);

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

async function http<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  return { status: res.status, body: parsed as T };
}

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
  dbMock.execute.mockReset();
});

describe('observability router · alert-rules tenancy hardening', () => {
  it('GET /alert-rules ignores ?entity_id query and uses req.tenancy', async () => {
    dbMock.query.mockResolvedValue([]);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'GET', `/api/observability/alert-rules?entity_id=${TENANT_B}`);
      expect(r.status).toBe(200);
      expect(dbMock.query).toHaveBeenCalledTimes(1);
      const [, params] = dbMock.query.mock.calls[0];
      expect(params).toEqual([TENANT_A]);
    });
  });

  it('GET /alert-rules without tenancy returns 400 (no cross-tenant leak)', async () => {
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/observability/alert-rules');
      expect(r.status).toBe(400);
      expect((r.body as { code: string }).code).toBe('tenancy_missing_header');
      expect(dbMock.query).not.toHaveBeenCalled();
    });
  });

  it('POST /alert-rules pins entity_id to req.tenancy and rejects body mismatch', async () => {
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'POST', '/api/observability/alert-rules', {
        entity_id: TENANT_B,
        name: 'rogue',
        metric_name: 'pricing_latency_ms',
        operator: 'gte',
        threshold: 100,
      });
      expect(r.status).toBe(403);
      expect((r.body as { code: string }).code).toBe('tenancy_forbidden_write');
      expect(dbMock.queryOne).not.toHaveBeenCalled();
    });
  });

  it('POST /alert-rules uses req.tenancy entity_id when body omits it', async () => {
    dbMock.queryOne.mockResolvedValue({ id: 'rule-1', entity_id: TENANT_A });
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'POST', '/api/observability/alert-rules', {
        name: 'latency-guard',
        metric_name: 'pricing_latency_ms',
        operator: 'gte',
        threshold: 250,
      });
      expect(r.status).toBe(200);
      const [, params] = dbMock.queryOne.mock.calls[0];
      expect(params[1]).toBe(TENANT_A);
    });
  });

  it('PATCH /alert-rules/:id/toggle filters by entity_id', async () => {
    dbMock.queryOne.mockResolvedValue(null);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'PATCH', '/api/observability/alert-rules/rule-from-other-tenant/toggle', {
        is_active: false,
      });
      expect(r.status).toBe(404);
      const [sql, params] = dbMock.queryOne.mock.calls[0];
      expect(sql).toMatch(/entity_id\s*=\s*\$2/);
      expect(params).toEqual(['rule-from-other-tenant', TENANT_A, false]);
    });
  });

  it('DELETE /alert-rules/:id filters by entity_id', async () => {
    dbMock.execute.mockResolvedValue(undefined);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'DELETE', '/api/observability/alert-rules/rule-x');
      expect(r.status).toBe(200);
      const [sql, params] = dbMock.execute.mock.calls[0];
      expect(sql).toMatch(/entity_id\s*=\s*\$2/);
      expect(params).toEqual(['rule-x', TENANT_A]);
    });
  });

  it('DELETE /alert-rules/:id without tenancy returns 400', async () => {
    await withApp(null, async (url) => {
      const r = await http(url, 'DELETE', '/api/observability/alert-rules/rule-x');
      expect(r.status).toBe(400);
      expect(dbMock.execute).not.toHaveBeenCalled();
    });
  });
});

describe('observability router · read-only endpoints prefer req.tenancy', () => {
  it('GET /summary uses req.tenancy.entityId even when query has another tenant', async () => {
    dbMock.queryOne.mockResolvedValue(null);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'GET', `/api/observability/summary?entity_id=${TENANT_B}`);
      expect(r.status).toBe(200);
      // Each of the 4 queries should have been called with TENANT_A.
      for (const call of dbMock.queryOne.mock.calls) {
        const [, params] = call;
        expect(params[0]).toBe(TENANT_A);
      }
    });
  });

  it('GET /metrics/recent uses req.tenancy.entityId', async () => {
    dbMock.query.mockResolvedValue([]);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(
        url,
        'GET',
        `/api/observability/metrics/recent?entity_id=${TENANT_B}&metric_name=pricing_latency_ms`,
      );
      expect(r.status).toBe(200);
      const [, params] = dbMock.query.mock.calls[0];
      expect(params[0]).toBe(TENANT_A);
    });
  });
});
