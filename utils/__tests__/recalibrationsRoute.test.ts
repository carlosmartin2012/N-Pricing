// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import attributionsRouter from '../../server/routes/attributions';

interface Tenancy { entityId: string; userEmail?: string | null; role?: string | null }

async function withApp<T>(t: Tenancy | null, fn: (url: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  if (t) app.use((req, _res, next) => { (req as unknown as { tenancy: Tenancy }).tenancy = t; next(); });
  app.use('/api/attributions', attributionsRouter);
  const server = createServer((req: IncomingMessage, res: ServerResponse) =>
    (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try { return await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

async function http<T>(url: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown = null;
  const text = await r.text();
  if (text) try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed as T };
}

const ENTITY = '00000000-0000-0000-0000-000000000099';

const recalRow = (over: Record<string, unknown> = {}) => ({
  id:                          'recal-1',
  entity_id:                   ENTITY,
  threshold_id:                'thr-1',
  proposed_deviation_bps_max:  '12',
  proposed_raroc_pp_min:       '11',
  proposed_volume_eur_max:     '600000',
  rationale:                   { windowDays: 180, decisionsCount: 40 },
  status:                      'pending',
  proposed_at:                 '2026-04-30T10:00:00Z',
  decided_at:                  null,
  decided_by_user:             null,
  reason:                      null,
  ...over,
});

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
});

describe('attributions router · GET /recalibrations', () => {
  it('sin tenancy → 400', async () => {
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/recalibrations');
      expect(r.status).toBe(400);
    });
  });

  // Anti-regresión Ola 10.5 fix #12 — endpoint expone propuestas
  // sensibles del motor (governance SR 11-7).
  it.each([
    ['Sales',      'Sales'],
    ['Commercial', 'Commercial'],
    ['Auditor',    'Auditor'],
  ])('rol %s no autorizado → 403 forbidden sin tocar la DB', async (_label, role) => {
    await withApp({ entityId: ENTITY, role }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/recalibrations');
      expect(r.status).toBe(403);
    });
    expect(dbMock.query).not.toHaveBeenCalled();
  });

  it('lista propuestas y mapea a camelCase', async () => {
    dbMock.query.mockResolvedValueOnce([recalRow()]);
    await withApp({ entityId: ENTITY, role: 'Risk_Manager' }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/recalibrations?status=pending');
      expect(r.status).toBe(200);
      const body = r.body as { items: Array<{ id: string; thresholdId: string; status: string; proposedDeviationBpsMax: number }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].thresholdId).toBe('thr-1');
      expect(body.items[0].status).toBe('pending');
      expect(body.items[0].proposedDeviationBpsMax).toBe(12);
    });
  });

  it('filtra por status válido', async () => {
    dbMock.query.mockResolvedValueOnce([]);
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/recalibrations?status=approved');
      expect(r.status).toBe(200);
      const sql = dbMock.query.mock.calls[0][0] as string;
      expect(sql).toContain('status = $2');
    });
  });

  it('ignora status inválido', async () => {
    dbMock.query.mockResolvedValueOnce([]);
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/recalibrations?status=hacked');
      expect(r.status).toBe(200);
      const params = dbMock.query.mock.calls[0][1] as unknown[];
      expect(params).toEqual([ENTITY]);    // sólo el entity_id, sin filtro extra
    });
  });
});

describe('attributions router · POST /recalibrations/:id/approve', () => {
  it('sin role Admin/Risk_Manager → 403', async () => {
    await withApp({ entityId: ENTITY, role: 'Commercial' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/recalibrations/abc/approve', {});
      expect(r.status).toBe(403);
    });
  });

  it('happy path: marca approved y devuelve la row', async () => {
    dbMock.queryOne.mockResolvedValueOnce(recalRow({
      status: 'approved',
      decided_at: '2026-05-01T08:00:00Z',
      decided_by_user: 'admin@bank.es',
      reason: 'looks reasonable',
    }));
    await withApp(
      { entityId: ENTITY, role: 'Admin', userEmail: 'admin@bank.es' },
      async (url) => {
        const r = await http(url, 'POST', '/api/attributions/recalibrations/recal-1/approve', { reason: 'looks reasonable' });
        expect(r.status).toBe(200);
        const body = r.body as { status: string; decidedByUser: string; reason: string };
        expect(body.status).toBe('approved');
        expect(body.decidedByUser).toBe('admin@bank.es');
        expect(body.reason).toBe('looks reasonable');
      },
    );
  });

  it('si la propuesta no existe / ya decidida → 404', async () => {
    dbMock.queryOne.mockResolvedValueOnce(null);
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/recalibrations/missing/approve', {});
      expect(r.status).toBe(404);
    });
  });
});

describe('attributions router · POST /recalibrations/:id/reject', () => {
  it('happy path con role Risk_Manager', async () => {
    dbMock.queryOne.mockResolvedValueOnce(recalRow({
      status: 'rejected',
      decided_at: '2026-05-01T08:00:00Z',
      decided_by_user: 'risk@bank.es',
      reason: 'not enough sample',
    }));
    await withApp(
      { entityId: ENTITY, role: 'Risk_Manager', userEmail: 'risk@bank.es' },
      async (url) => {
        const r = await http(url, 'POST', '/api/attributions/recalibrations/recal-1/reject', { reason: 'not enough sample' });
        expect(r.status).toBe(200);
        const body = r.body as { status: string };
        expect(body.status).toBe('rejected');
      },
    );
  });

  it('Commercial sin permisos → 403', async () => {
    await withApp({ entityId: ENTITY, role: 'Commercial' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/recalibrations/recal-1/reject', {});
      expect(r.status).toBe(403);
    });
  });
});
