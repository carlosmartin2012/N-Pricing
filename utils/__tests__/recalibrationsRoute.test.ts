// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const dbMock = vi.hoisted(() => {
  // El hoisted block necesita auto-referencia para que `withTransaction(fn)`
  // pueda inyectar el mismo objeto como `tx`, manteniendo compatibilidad con
  // tests que pre-configuran `dbMock.queryOne.mockResolvedValueOnce(...)`.
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

// Mock dispatcher de push (mismo motivo que en attributionsRoute.test.ts):
// evita arrastrar `web-push` por imports transitivos y elimina la flake
// 501 no-determinística en suite completa.
vi.mock('../../server/integrations/escalationPushDispatcher', () => ({
  dispatchEscalationPush: vi.fn().mockResolvedValue({
    notified: 0,
    staleEndpointsPurged: 0,
    skipped: 'no_vapid' as const,
    errors: [],
  }),
}));

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
  dbMock.execute.mockReset();
  dbMock.withTransaction.mockClear();
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

  it('happy path: aplica los 3 pasos (insert nuevo / desactivar viejo / marcar approved)', async () => {
    // El handler ejecuta dentro de withTransaction:
    //   1. SELECT JOIN  → proposal+threshold (devuelve proposal con level_id, scope, ...)
    //   2. INSERT new threshold (execute, sin return)
    //   3. UPDATE old threshold is_active=false (execute)
    //   4. UPDATE recalibration → status=approved, RETURNING *
    dbMock.queryOne.mockResolvedValueOnce({
      ...recalRow(),
      level_id:    'lvl-zone',
      scope:       {},
      active_from: '2026-01-01',
      active_to:   null,
    });
    dbMock.execute.mockResolvedValueOnce(undefined); // INSERT new threshold
    dbMock.execute.mockResolvedValueOnce(undefined); // UPDATE old threshold
    dbMock.queryOne.mockResolvedValueOnce(recalRow({
      status:           'approved',
      decided_at:       '2026-05-01T08:00:00Z',
      decided_by_user:  'admin@bank.es',
      reason:           'looks reasonable',
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

    // Verifica que los 3 pasos del governance flow se ejecutaron
    expect(dbMock.withTransaction).toHaveBeenCalledTimes(1);
    expect(dbMock.queryOne).toHaveBeenCalledTimes(2);
    expect(dbMock.execute).toHaveBeenCalledTimes(2);
    // Step 1: el SELECT debe usar JOIN attribution_thresholds
    const firstSelectSql = dbMock.queryOne.mock.calls[0][0] as string;
    expect(firstSelectSql).toMatch(/SELECT[\s\S]*JOIN attribution_thresholds/i);
    // Step 2: INSERT into attribution_thresholds
    const insertSql = dbMock.execute.mock.calls[0][0] as string;
    expect(insertSql).toMatch(/INSERT INTO attribution_thresholds/i);
    // Step 3: UPDATE attribution_thresholds … is_active = FALSE
    const deactivateSql = dbMock.execute.mock.calls[1][0] as string;
    expect(deactivateSql).toMatch(/UPDATE attribution_thresholds[\s\S]*is_active\s*=\s*FALSE/i);
  });

  it('si la propuesta no existe / ya decidida → 404 (sin tocar thresholds)', async () => {
    dbMock.queryOne.mockResolvedValueOnce(null); // SELECT inicial vacío
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/recalibrations/missing/approve', {});
      expect(r.status).toBe(404);
    });
    // Crítico: si la propuesta no existe NO debe tocar los thresholds
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('trigger cross-tenant rechaza → 422 invalid_threshold', async () => {
    dbMock.queryOne.mockResolvedValueOnce({
      ...recalRow(),
      level_id:    'lvl-zone',
      scope:       {},
      active_from: '2026-01-01',
      active_to:   null,
    });
    dbMock.execute.mockRejectedValueOnce(
      new Error('cross-tenant recalibration rejected: threshold X belongs to entity Y, recalibration claims Z'),
    );

    await withApp({ entityId: ENTITY, role: 'Admin', userEmail: 'admin@bank.es' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/recalibrations/recal-1/approve', {});
      expect(r.status).toBe(422);
      expect((r.body as { code: string }).code).toBe('invalid_threshold');
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
