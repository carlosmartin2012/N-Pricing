// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const dbMock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {
    query: vi.fn(),
    queryOne: vi.fn(),
    execute: vi.fn(),
    withTransaction: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj.withTransaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(obj));
  return obj;
});
vi.mock('../../server/db', () => dbMock);

import dealsRouter from '../../server/routes/deals';

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
  app.use('/api/deals', dealsRouter);

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

const ENTITY_A = '00000000-0000-0000-0000-00000000000a';
const ENTITY_B = '00000000-0000-0000-0000-00000000000b';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
  dbMock.execute.mockReset();
  dbMock.withTransaction.mockClear();
});

describe('deals router · batch upsert', () => {
  it('writes the batch inside one transaction and pins entity_id to tenancy', async () => {
    dbMock.queryOne
      .mockResolvedValueOnce({ id: 'generated-1', entity_id: ENTITY_A })
      .mockResolvedValueOnce({ id: 'generated-2', entity_id: ENTITY_A });

    await withApp({ entityId: ENTITY_A }, async (url) => {
      const r = await http<unknown[]>(url, 'POST', '/api/deals/batch-upsert', [
        { status: 'Draft', amount: 100, client_id: 'c-1', currency: 'EUR' },
        { status: 'Draft', amount: 200, client_id: 'c-2', currency: 'EUR' },
      ]);

      expect(r.status).toBe(200);
      expect(r.body).toHaveLength(2);
      expect(dbMock.withTransaction).toHaveBeenCalledTimes(1);
      expect(dbMock.queryOne).toHaveBeenCalledTimes(2);
      for (const [, params] of dbMock.queryOne.mock.calls) {
        expect(params[33]).toBe(ENTITY_A);
      }
    });
  });

  it('rejects a batch with mismatched body entity before opening a transaction', async () => {
    await withApp({ entityId: ENTITY_A }, async (url) => {
      const r = await http<{ code: string }>(url, 'POST', '/api/deals/batch-upsert', [
        { status: 'Draft', amount: 100, entity_id: ENTITY_B },
      ]);

      expect(r.status).toBe(403);
      expect(r.body.code).toBe('tenancy_forbidden_write');
      expect(dbMock.withTransaction).not.toHaveBeenCalled();
      expect(dbMock.queryOne).not.toHaveBeenCalled();
    });
  });

  it('returns 409 when an existing deal id belongs to another entity', async () => {
    dbMock.queryOne.mockResolvedValueOnce({ entity_id: ENTITY_B });

    await withApp({ entityId: ENTITY_A }, async (url) => {
      const r = await http<{ code: string }>(url, 'POST', '/api/deals/batch-upsert', [
        { id: 'deal-cross-entity', status: 'Draft', amount: 100 },
      ]);

      expect(r.status).toBe(409);
      expect(r.body.code).toBe('entity_mismatch');
      expect(dbMock.withTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
