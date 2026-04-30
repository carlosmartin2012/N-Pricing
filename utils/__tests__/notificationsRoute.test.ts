// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import notificationsRouter from '../../server/routes/notifications';

interface Tenancy { entityId: string; userEmail?: string | null }

async function withApp<T>(t: Tenancy | null, fn: (url: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  if (t) app.use((req, _res, next) => { (req as unknown as { tenancy: Tenancy }).tenancy = t; next(); });
  app.use('/api/notifications', notificationsRouter);
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
const USER = 'user@bank.es';

const subRow = {
  id:           'sub-1',
  entity_id:    ENTITY,
  user_email:   USER,
  endpoint:     'https://fcm.googleapis.com/fcm/send/abc',
  keys_p256dh:  'p256dh-base64',
  keys_auth:    'auth-base64',
  user_agent:   'Mozilla/5.0',
  created_at:   '2026-04-30T10:00:00Z',
  last_seen_at: '2026-04-30T10:00:00Z',
};

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
});

describe('notifications router · POST /push/subscribe', () => {
  it('sin tenancy → 400', async () => {
    await withApp(null, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/subscribe', {});
      expect(r.status).toBe(400);
    });
  });

  it('sin userEmail en tenancy → 400 user_email_missing', async () => {
    await withApp({ entityId: ENTITY }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/subscribe', {
        endpoint: 'x', keysP256dh: 'y', keysAuth: 'z',
      });
      expect(r.status).toBe(400);
      expect((r.body as { code: string }).code).toBe('user_email_missing');
    });
  });

  it('body inválido → 400', async () => {
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/subscribe', { foo: 'bar' });
      expect(r.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // SSRF guard (Ola 10.2 fix #8) — endpoint allowlist
  // -------------------------------------------------------------------
  describe('endpoint allowlist (SSRF guard)', () => {
    const validBody = (endpoint: string) => ({
      endpoint,
      keysP256dh: 'p256dh',
      keysAuth:   'auth',
    });

    it.each([
      ['localhost Redis',     'http://localhost:6379'],
      ['internal IP',          'http://10.0.0.1/admin'],
      ['cloud metadata',       'http://169.254.169.254/computeMetadata/v1/'],
      ['http (plaintext)',     'http://fcm.googleapis.com/fcm/send/abc'],
      ['arbitrary host',       'https://attacker.example.com/path'],
      ['allowlist substring',  'https://fcm.googleapis.com.attacker.com/path'],
      ['malformed URL',        'not-a-url'],
      ['empty after trim',     '   '],
    ])('rechaza endpoint %s con 400 invalid_endpoint', async (_label, badEndpoint) => {
      await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
        const r = await http(url, 'POST', '/api/notifications/push/subscribe', validBody(badEndpoint));
        expect(r.status).toBe(400);
        const body = r.body as { code: string };
        // Empty/missing endpoint → validation_error; resto → invalid_endpoint
        expect(['invalid_endpoint', 'validation_error']).toContain(body.code);
      });
      // Crítico: nunca tocar la DB con endpoint inválido
      expect(dbMock.queryOne).not.toHaveBeenCalled();
    });

    it.each([
      ['FCM canonical', 'https://fcm.googleapis.com/fcm/send/abc'],
      ['FCM subdomain', 'https://android.fcm.googleapis.com/fcm/send/abc'],
      ['Mozilla',       'https://updates.push.services.mozilla.com/wpush/v2/abc'],
      ['Apple web',     'https://web.push.apple.com/QABCDEF'],
    ])('acepta endpoint %s', async (_label, goodEndpoint) => {
      dbMock.queryOne.mockResolvedValueOnce({ ...subRow, endpoint: goodEndpoint });
      await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
        const r = await http(url, 'POST', '/api/notifications/push/subscribe', validBody(goodEndpoint));
        expect(r.status).toBe(201);
      });
    });
  });

  it('happy path → 201 con shape mapeada a camelCase', async () => {
    dbMock.queryOne.mockResolvedValueOnce(subRow);
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/subscribe', {
        endpoint:   subRow.endpoint,
        keysP256dh: subRow.keys_p256dh,
        keysAuth:   subRow.keys_auth,
        userAgent:  subRow.user_agent,
      });
      expect(r.status).toBe(201);
      const body = r.body as { endpoint: string; keysP256dh: string; userEmail: string };
      expect(body.endpoint).toBe(subRow.endpoint);
      expect(body.keysP256dh).toBe(subRow.keys_p256dh);
      expect(body.userEmail).toBe(USER);
    });
    // SQL incluye ON CONFLICT DO UPDATE (UPSERT idempotente)
    const sql = dbMock.queryOne.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT (entity_id, user_email, endpoint)');
    expect(sql).toContain('DO UPDATE');
  });
});

describe('notifications router · POST /push/unsubscribe', () => {
  it('happy path con endpoint válido', async () => {
    dbMock.query.mockResolvedValueOnce([]);
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/unsubscribe', { endpoint: 'x' });
      expect(r.status).toBe(200);
    });
  });

  it('endpoint missing → 400', async () => {
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/unsubscribe', {});
      expect(r.status).toBe(400);
    });
  });
});

describe('notifications router · GET /push/subscriptions', () => {
  it('lista propias del usuario mapeadas', async () => {
    dbMock.query.mockResolvedValueOnce([subRow]);
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'GET', '/api/notifications/push/subscriptions');
      expect(r.status).toBe(200);
      const body = r.body as { items: Array<{ userEmail: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0].userEmail).toBe(USER);
    });
  });
});

describe('notifications router · POST /push/test', () => {
  it('sin VAPID configurado → 503 no_vapid_config sin tocar la DB', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'POST', '/api/notifications/push/test', { message: 'hello' });
      expect(r.status).toBe(503);
      const body = r.body as { code: string };
      expect(body.code).toBe('no_vapid_config');
    });
    // Anti-regresión Ola 10.5 fix #16: el check VAPID debe ir ANTES del query
    // a push_subscriptions; si no, cada hit sin config hace round-trip
    // innecesario a Postgres.
    expect(dbMock.query).not.toHaveBeenCalled();
  });

  it('Anti-regresión fix #11: con VAPID configurado y 0 subs, devuelve 200 (no 500 por purge)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BFakePub';
    process.env.VAPID_PRIVATE_KEY = 'fake-priv';
    try {
      dbMock.query.mockResolvedValueOnce([]); // SELECT sin subscriptions
      await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
        const r = await http(url, 'POST', '/api/notifications/push/test', { message: 'x' });
        expect(r.status).toBe(200);
        const body = r.body as { delivered: number; total: number; staleEndpointsPurged: number };
        expect(body.delivered).toBe(0);
        expect(body.staleEndpointsPurged).toBe(0);
      });
    } finally {
      // Limpieza explícita — sin esto, los siguientes tests del archivo
      // (GET /push/vapid-public-key sin VAPID) heredan estas env vars.
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    }
  });
});

describe('notifications router · GET /push/vapid-public-key', () => {
  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('sin VAPID configurado → 503', async () => {
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'GET', '/api/notifications/push/vapid-public-key');
      expect(r.status).toBe(503);
    });
  });

  it('con VAPID configurado → devuelve la public key', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BFakePub';
    process.env.VAPID_PRIVATE_KEY = 'fake-priv';
    await withApp({ entityId: ENTITY, userEmail: USER }, async (url) => {
      const r = await http(url, 'GET', '/api/notifications/push/vapid-public-key');
      expect(r.status).toBe(200);
      const body = r.body as { publicKey: string; configured: boolean };
      expect(body.publicKey).toBe('BFakePub');
      expect(body.configured).toBe(true);
    });
  });
});
