// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import admissionRouter from '../../server/routes/admission';
import { adapterRegistry } from '../../integrations/registry';
import { InMemoryAdmission } from '../../integrations/inMemory';
import type { AdmissionContext, AdmissionReconciliationItem } from '../../integrations/types';

interface SyntheticTenancy {
  entityId: string;
  userEmail?: string | null;
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
  app.use('/api/admission', admissionRouter);

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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown = null;
  const text = await r.text();
  if (text) try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed as T };
}

const ENTITY = '00000000-0000-0000-0000-000000000099';

const PUSH_BODY = {
  dealId:                 'deal-1',
  pricingSnapshotHash:    'h-abcdef',
  decision:               'approved',
  decidedByUser:          'demo@bank.es',
  decidedAt:              '2026-04-30T10:00:00Z',
  finalClientRateBps:     485,
  rarocPp:                14.2,
  attributionLevelId:     'lvl-office',
  routingMetadata:        {},
};

const SAMPLE_CONTEXT: AdmissionContext = {
  dealId:               'deal-1',
  clientId:             'client-1',
  internalRating:       'A',
  pdAnnual:             0.012,
  lgd:                  0.45,
  exposureEur:          500_000,
  exposureAtDefaultEur: 480_000,
  collateral:           [],
  decision:             'approved',
  decidedAt:            '2026-04-30T08:00:00Z',
  notes:                null,
};

beforeEach(() => {
  adapterRegistry.clear();
});

describe('admission router · tenancy + adapter resolution', () => {
  it('GET /health sin x-entity-id → 400', async () => {
    adapterRegistry.register(new InMemoryAdmission());
    await withApp(null, async (url) => {
      const r = await http(url, 'GET', '/api/admission/health');
      expect(r.status).toBe(400);
    });
  });

  it('POST /push sin adapter registrado → 503 no_adapter', async () => {
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/admission/push', PUSH_BODY);
      expect(r.status).toBe(503);
      expect((r.body as { code: string }).code).toBe('no_adapter');
    });
  });

  it('GET /health con InMemoryAdmission → 200 ok=true', async () => {
    adapterRegistry.register(new InMemoryAdmission());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/admission/health');
      expect(r.status).toBe(200);
      const body = r.body as { kind: string; name: string; health: { ok: boolean } };
      expect(body.kind).toBe('admission');
      expect(body.health.ok).toBe(true);
    });
  });
});

describe('admission router · POST /push', () => {
  it('body inválido → 400 validation_error', async () => {
    adapterRegistry.register(new InMemoryAdmission());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/admission/push', { foo: 'bar' });
      expect(r.status).toBe(400);
    });
  });

  it('push exitoso → 202 accepted con externalId', async () => {
    const adapter = new InMemoryAdmission();
    adapterRegistry.register(adapter);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/admission/push', PUSH_BODY);
      expect(r.status).toBe(202);
      const body = r.body as { accepted: boolean; externalId: string };
      expect(body.accepted).toBe(true);
      expect(body.externalId).toMatch(/^puzzle-mem-/);
    });
    expect(adapter.decisionsPushed()).toHaveLength(1);
  });

  it('push duplicado (mismo dealId+hash) usa el mismo externalId', async () => {
    const adapter = new InMemoryAdmission();
    adapterRegistry.register(adapter);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r1 = await http(url, 'POST', '/api/admission/push', PUSH_BODY);
      const r2 = await http(url, 'POST', '/api/admission/push', PUSH_BODY);
      expect((r1.body as { externalId: string }).externalId).toBe(
        (r2.body as { externalId: string }).externalId,
      );
    });
  });
});

describe('admission router · GET /context/:dealId', () => {
  it('contexto inexistente → 404', async () => {
    adapterRegistry.register(new InMemoryAdmission());
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/admission/context/missing');
      expect(r.status).toBe(404);
    });
  });

  it('contexto seedado → 200 con shape AdmissionContext', async () => {
    const adapter = new InMemoryAdmission();
    adapter.seedContext(SAMPLE_CONTEXT);
    adapterRegistry.register(adapter);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/admission/context/deal-1');
      expect(r.status).toBe(200);
      const body = r.body as AdmissionContext;
      expect(body.internalRating).toBe('A');
    });
  });
});

describe('admission router · GET /reconciliation', () => {
  it('summary cuenta correctamente status mix', async () => {
    const adapter = new InMemoryAdmission();
    const items: AdmissionReconciliationItem[] = [
      { dealId: 'd1', pricingSnapshotHash: 'h1', ourFinalRateBps: 485, bookedRateBps: 485, diffBps: 0, bookedAt: '2026-04-30T10:00:00Z', status: 'matched' },
      { dealId: 'd2', pricingSnapshotHash: 'h2', ourFinalRateBps: 480, bookedRateBps: 482, diffBps: 2, bookedAt: '2026-04-30T10:00:00Z', status: 'mismatch_rate' },
      { dealId: 'd3', pricingSnapshotHash: 'h3', ourFinalRateBps: 490, bookedRateBps: 0,   diffBps: 0, bookedAt: null,                    status: 'mismatch_missing' },
    ];
    adapter.seedReconciliation(items);
    adapterRegistry.register(adapter);
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'GET', '/api/admission/reconciliation?as_of=2026-04-30');
      expect(r.status).toBe(200);
      const body = r.body as { summary: { total: number; matched: number; mismatchRate: number; mismatchMissing: number } };
      expect(body.summary.total).toBe(3);
      expect(body.summary.matched).toBe(1);
      expect(body.summary.mismatchRate).toBe(1);
      expect(body.summary.mismatchMissing).toBe(1);
    });
  });
});
