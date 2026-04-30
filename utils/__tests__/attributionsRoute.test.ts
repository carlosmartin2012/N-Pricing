// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// Mock pg.Pool / query / queryOne para no tocar DB real.
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

// Mock dispatcher de push para evitar que `attributions.ts` arrastre
// `web-push` (top-level side-effects) por la cadena de imports. Sin este
// mock, otros archivos de test que importan el mismo grafo pueden hidratar
// el módulo antes de que vi.mock('server/db') se aplique → flake
// no-determinístico que devuelve 501 en /route y /recalibrations/:id/reject
// cuando vitest pone los archivos en cierto orden.
vi.mock('../../server/integrations/escalationPushDispatcher', () => ({
  dispatchEscalationPush: vi.fn().mockResolvedValue({
    notified: 0,
    staleEndpointsPurged: 0,
    skipped: 'no_vapid' as const,
    errors: [],
  }),
}));

import attributionsRouter from '../../server/routes/attributions';

// ---------------------------------------------------------------------------
// Mini test harness — monta el router con tenancy sintética y hace fetch
// ---------------------------------------------------------------------------

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
  app.use('/api/attributions', attributionsRouter);

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

interface ApiResponse<T> {
  status: number;
  body: T;
}

async function http<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = '00000000-0000-0000-0000-000000000099';

const officeRow = {
  id:           'lvl-office',
  entity_id:    ENTITY,
  name:         'Oficina',
  parent_id:    null,
  level_order:  1,
  rbac_role:    'BranchManager',
  metadata:     {},
  active:       true,
  created_at:   '2026-04-01T08:00:00Z',
  updated_at:   '2026-04-01T08:00:00Z',
};
const zoneRow = { ...officeRow, id: 'lvl-zone', name: 'Zona', parent_id: 'lvl-office', level_order: 2 };
const committeeRow = { ...officeRow, id: 'lvl-committee', name: 'Comité', parent_id: 'lvl-zone', level_order: 3 };

const officeThresholdRow = {
  id:                'thr-office',
  entity_id:         ENTITY,
  level_id:          'lvl-office',
  scope:             {},
  deviation_bps_max: 5,
  raroc_pp_min:      14,
  volume_eur_max:    100_000,
  active_from:       '2026-01-01',
  active_to:         null,
  is_active:         true,
  created_at:        '2026-04-01T08:00:00Z',
  updated_at:        '2026-04-01T08:00:00Z',
};
const zoneThresholdRow      = { ...officeThresholdRow, id: 'thr-zone',      level_id: 'lvl-zone',      deviation_bps_max: 15, raroc_pp_min: 12, volume_eur_max: 500_000 };
const committeeThresholdRow = { ...officeThresholdRow, id: 'thr-committee', level_id: 'lvl-committee', deviation_bps_max: 50, raroc_pp_min: 8,  volume_eur_max: 10_000_000 };

const baseQuote = {
  finalClientRateBps: 490,
  standardRateBps:    492,
  hardFloorRateBps:   400,
  rarocPp:            14.5,
  volumeEur:          80_000,
  scope:              { product: ['loan'], segment: ['SME'], currency: ['EUR'], tenorMaxMonths: 24 },
};

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
  dbMock.execute.mockReset();
  dbMock.withTransaction.mockClear();
});

// ---------------------------------------------------------------------------
// Tenancy guards
// ---------------------------------------------------------------------------

describe('attributions router · tenancy guards', () => {
  it('GET /matrix sin x-entity-id → 400 tenancy_missing_header', async () => {
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/matrix');
      expect(r.status).toBe(400);
      expect((r.body as { code: string }).code).toBe('tenancy_missing_header');
    });
  });

  it('POST /levels sin role Admin/Risk_Manager → 403 forbidden', async () => {
    await withApp({ entityId: ENTITY, role: 'Commercial' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/levels', {
        name: 'Director Oficina', levelOrder: 1, rbacRole: 'BranchManager',
      });
      expect(r.status).toBe(403);
      expect((r.body as { code: string }).code).toBe('forbidden');
    });
  });

  it('POST /thresholds sin role Admin/Risk_Manager → 403', async () => {
    await withApp({ entityId: ENTITY, role: 'Commercial' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/thresholds', {
        levelId: 'lvl-office', deviationBpsMax: 10,
      });
      expect(r.status).toBe(403);
    });
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('attributions router · validation', () => {
  it('POST /levels sin name → 400 validation_error', async () => {
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/levels', { levelOrder: 1, rbacRole: 'X' });
      expect(r.status).toBe(400);
      expect((r.body as { code: string }).code).toBe('validation_error');
    });
  });

  it('POST /thresholds sin levelId → 400', async () => {
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/thresholds', { deviationBpsMax: 10 });
      expect(r.status).toBe(400);
    });
  });

  it('POST /thresholds sin ningún criterio → 400', async () => {
    await withApp({ entityId: ENTITY, role: 'Admin' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/thresholds', { levelId: 'lvl-office' });
      expect(r.status).toBe(400);
    });
  });

  it('POST /route con quote inválido → 400', async () => {
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/route', { quote: { foo: 1 } });
      expect(r.status).toBe(400);
    });
  });

  it('POST /decisions/:dealId con decision inválida → 400', async () => {
    await withApp({ entityId: ENTITY, role: 'BranchManager' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId:    'lvl-office',
        decision:           'frobnicate',
        pricingSnapshotHash:'h',
      });
      expect(r.status).toBe(400);
    });
  });

  it('POST /decisions/:dealId sin pricingSnapshotHash → 400', async () => {
    await withApp({ entityId: ENTITY, role: 'BranchManager' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId: 'lvl-office',
        decision:        'approved',
      });
      expect(r.status).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /decisions/:dealId — role guard (Ola 10.2 fix #7)
// ---------------------------------------------------------------------------

describe('attributions router · POST /decisions/:dealId · role guard', () => {
  it.each([
    ['Sales',      'Sales'],
    ['Commercial', 'Commercial'],
    ['Read_Only',  'Read_Only'],
  ])('rol %s no autorizado → 403 forbidden (anti privilege escalation)', async (_label, role) => {
    await withApp({ entityId: ENTITY, role, userEmail: 'sales@bank.es' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId:     'lvl-office',
        decision:            'approved',
        pricingSnapshotHash: 'h-abc',
      });
      expect(r.status).toBe(403);
      expect((r.body as { code: string }).code).toBe('forbidden');
    });
    // Crítico: el INSERT NUNCA debe ejecutarse para roles no autorizados
    expect(dbMock.queryOne).not.toHaveBeenCalled();
  });

  it('sin rol en tenancy → 403', async () => {
    await withApp({ entityId: ENTITY, userEmail: 'x@bank.es' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId:     'lvl-office',
        decision:            'approved',
        pricingSnapshotHash: 'h-abc',
      });
      expect(r.status).toBe(403);
    });
    expect(dbMock.queryOne).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /matrix — happy path
// ---------------------------------------------------------------------------

describe('attributions router · GET /matrix', () => {
  it('devuelve árbol + thresholds mapeados a camelCase', async () => {
    dbMock.query
      .mockResolvedValueOnce([officeRow, zoneRow, committeeRow])
      .mockResolvedValueOnce([officeThresholdRow, zoneThresholdRow, committeeThresholdRow]);

    await withApp({ entityId: ENTITY, role: 'Risk_Manager' }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/matrix');
      expect(r.status).toBe(200);
      const matrix = r.body as { entityId: string; levels: unknown[]; thresholds: unknown[] };
      expect(matrix.entityId).toBe(ENTITY);
      expect(matrix.levels).toHaveLength(3);
      expect(matrix.thresholds).toHaveLength(3);
      expect((matrix.levels[0] as { rbacRole: string }).rbacRole).toBe('BranchManager');
      expect((matrix.thresholds[0] as { deviationBpsMax: number }).deviationBpsMax).toBe(5);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /route — algoritmo end-to-end con DB mock
// ---------------------------------------------------------------------------

describe('attributions router · POST /route', () => {
  it('quote dentro del threshold de Oficina → Oficina aprueba', async () => {
    dbMock.query
      .mockResolvedValueOnce([officeRow, zoneRow, committeeRow])
      .mockResolvedValueOnce([officeThresholdRow, zoneThresholdRow, committeeThresholdRow]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/route', { quote: baseQuote });
      expect(r.status).toBe(200);
      const result = r.body as { requiredLevel: { id: string }; reason: string; belowHardFloor: boolean };
      expect(result.requiredLevel.id).toBe('lvl-office');
      expect(result.reason).toBe('within_threshold');
      expect(result.belowHardFloor).toBe(false);
    });
  });

  it('matriz vacía → 409 matrix_empty', async () => {
    dbMock.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/route', { quote: baseQuote });
      expect(r.status).toBe(409);
      expect((r.body as { code: string }).code).toBe('matrix_empty');
    });
  });

  it('quote bajo hard floor → belowHardFloor=true en respuesta', async () => {
    dbMock.query
      .mockResolvedValueOnce([officeRow, zoneRow, committeeRow])
      .mockResolvedValueOnce([officeThresholdRow, zoneThresholdRow, committeeThresholdRow]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/route', {
        quote: { ...baseQuote, finalClientRateBps: 350 },
      });
      expect(r.status).toBe(200);
      const result = r.body as { belowHardFloor: boolean; reason: string; requiredLevel: { id: string } };
      expect(result.belowHardFloor).toBe(true);
      expect(result.reason).toBe('below_hard_floor');
      expect(result.requiredLevel.id).toBe('lvl-committee');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /simulate
// ---------------------------------------------------------------------------

describe('attributions router · POST /simulate', () => {
  it('aplica adjustments y devuelve nuevo routing + diff', async () => {
    dbMock.query
      .mockResolvedValueOnce([officeRow, zoneRow, committeeRow])
      .mockResolvedValueOnce([officeThresholdRow, zoneThresholdRow, committeeThresholdRow]);

    await withApp({ entityId: ENTITY }, async (url) => {
      // Quote inicial cae en Zona; subiendo RAROC el resultado pasa a Oficina.
      const r = await http(url, 'POST', '/api/attributions/simulate', {
        quote: { ...baseQuote, rarocPp: 13, finalClientRateBps: 489 },
        proposedAdjustments: { rarocPpOverride: 15 },
      });
      expect(r.status).toBe(200);
      const result = r.body as {
        adjustedQuote: { rarocPp: number };
        diffVsOriginal: { requiredLevelChanged: boolean; levelsAvoided: { id: string }[] };
      };
      expect(result.adjustedQuote.rarocPp).toBe(15);
      expect(result.diffVsOriginal.requiredLevelChanged).toBe(true);
      expect(result.diffVsOriginal.levelsAvoided.map((l) => l.id)).toContain('lvl-zone');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /decisions/:dealId — append + trigger error mapping
// ---------------------------------------------------------------------------

describe('attributions router · POST /decisions/:dealId', () => {
  it('inserta y devuelve 201 con la decisión mapeada', async () => {
    const insertedRow = {
      id:                       'dec-1',
      entity_id:                ENTITY,
      deal_id:                  'deal-1',
      required_level_id:        'lvl-office',
      decided_by_level_id:      'lvl-office',
      decided_by_user:          'demo@bank.es',
      decision:                 'approved',
      reason:                   null,
      pricing_snapshot_hash:    'h-abcdef',
      routing_metadata:         { deviationBps: -2, rarocPp: 14.5, volumeEur: 80_000, scope: {} },
      decided_at:               '2026-04-30T10:00:00Z',
    };
    dbMock.queryOne.mockResolvedValueOnce(insertedRow);

    await withApp({ entityId: ENTITY, role: 'BranchManager', userEmail: 'demo@bank.es' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId:     'lvl-office',
        decidedByLevelId:    'lvl-office',
        decision:            'approved',
        pricingSnapshotHash: 'h-abcdef',
        routingMetadata:     { deviationBps: -2, rarocPp: 14.5, volumeEur: 80_000, scope: {} },
      });
      expect(r.status).toBe(201);
      const decision = r.body as { id: string; decision: string; pricingSnapshotHash: string };
      expect(decision.id).toBe('dec-1');
      expect(decision.decision).toBe('approved');
      expect(decision.pricingSnapshotHash).toBe('h-abcdef');
    });
  });

  it('hash inexistente (trigger DB) → 422 unknown_snapshot_hash', async () => {
    dbMock.queryOne.mockRejectedValueOnce(
      new Error('attribution_decision rejects unknown pricing_snapshot_hash h-bad for entity ' + ENTITY),
    );

    await withApp({ entityId: ENTITY, role: 'BranchManager' }, async (url) => {
      const r = await http(url, 'POST', '/api/attributions/decisions/deal-1', {
        requiredLevelId:     'lvl-office',
        decision:            'approved',
        pricingSnapshotHash: 'h-bad',
      });
      expect(r.status).toBe(422);
      expect((r.body as { code: string }).code).toBe('unknown_snapshot_hash');
    });
  });
});

// ---------------------------------------------------------------------------
// GET /decisions — listing con filtros
// ---------------------------------------------------------------------------

describe('attributions router · GET /decisions', () => {
  it('filtra por deal_id y devuelve paginación', async () => {
    const row = {
      id:                    'dec-1',
      entity_id:             ENTITY,
      deal_id:               'deal-X',
      required_level_id:     'lvl-zone',
      decided_by_level_id:   'lvl-zone',
      decided_by_user:       'gestor@bank.es',
      decision:              'approved',
      reason:                null,
      pricing_snapshot_hash: 'h-1',
      routing_metadata:      null,
      decided_at:            '2026-04-30T10:00:00Z',
    };
    dbMock.query.mockResolvedValueOnce([row]);

    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/attributions/decisions?deal_id=deal-X&limit=10');
      expect(r.status).toBe(200);
      const body = r.body as { items: { dealId: string }[]; pagination: { limit: number } };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].dealId).toBe('deal-X');
      expect(body.pagination.limit).toBe(10);
    });
  });
});
