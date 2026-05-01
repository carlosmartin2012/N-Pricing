// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const dbMock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {
    pool:     { query: vi.fn(), connect: vi.fn() },
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj.withTransaction        = vi.fn(async (fn: (tx: any) => unknown) => fn(obj));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj.withTenancyTransaction = vi.fn(async (_t: unknown, fn: (tx: any) => unknown) => fn(obj));
  return obj;
});
vi.mock('../../server/db', () => dbMock);

import targetGridRouter from '../../server/routes/targetGrid';

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
  app.use('/api/target-grid', targetGridRouter);

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

describe('targetGrid router · templates tenancy hardening', () => {
  it('GET /templates ignores ?entity_id query and uses req.tenancy', async () => {
    dbMock.query.mockResolvedValue([]);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'GET', `/api/target-grid/templates?entity_id=${TENANT_B}`);
      expect(r.status).toBe(200);
      const [, params] = dbMock.query.mock.calls[0];
      expect(params).toEqual([TENANT_A]);
    });
  });

  it('GET /snapshots uses req.tenancy.entityId, ignoring query', async () => {
    dbMock.query.mockResolvedValue([]);
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'GET', `/api/target-grid/snapshots?entity_id=${TENANT_B}`);
      expect(r.status).toBe(200);
      const [, params] = dbMock.query.mock.calls[0];
      expect(params).toEqual([TENANT_A]);
    });
  });

  it('POST /templates rejects body.entity_id that does not match tenancy', async () => {
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'POST', '/api/target-grid/templates', {
        entity_id: TENANT_B,
        product: 'Loan',
        segment: 'SME',
        tenor_bucket: '1Y',
      });
      expect(r.status).toBe(403);
      expect((r.body as { code: string }).code).toBe('tenancy_forbidden_write');
      expect(dbMock.queryOne).not.toHaveBeenCalled();
    });
  });

  it('POST /templates pins entity_id to req.tenancy when body omits it', async () => {
    dbMock.queryOne.mockResolvedValue({ id: 'tpl-1', entity_id: TENANT_A });
    await withApp({ entityId: TENANT_A }, async (url) => {
      const r = await http(url, 'POST', '/api/target-grid/templates', {
        product: 'Loan',
        segment: 'SME',
        tenor_bucket: '1Y',
      });
      expect(r.status).toBe(201);
      const [, params] = dbMock.queryOne.mock.calls[0];
      expect(params[1]).toBe(TENANT_A);
    });
  });
});
