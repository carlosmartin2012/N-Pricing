import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http, { Server } from 'http';
import { AddressInfo } from 'net';
import { Pool } from 'pg';

/**
 * Integration tests for the legacy routes migrated to the tenancy pattern
 * (deals, audit, config). They verify that when tenancy middleware populated
 * req.tenancy, queries never return or mutate rows belonging to another
 * entity — the core regression this hardening was meant to close.
 *
 * OPT-IN: only runs with INTEGRATION_DATABASE_URL set. CI can wire it up
 * with a Postgres service container + migrations applied beforehand.
 *
 * The harness mounts the actual production routers behind a fake auth +
 * tenancy middleware pair that injects `req.tenancy` from a custom header,
 * so we exercise real SQL paths without needing a real JWT. Any bug that
 * reintroduces `SELECT * FROM deals` without an entity filter will fail
 * here at the fuzz step.
 */

const URL = process.env.INTEGRATION_DATABASE_URL;
const SUITE_ENABLED = !!URL;

// Canonical test entities. Distinct from the Default Entity so a cross-read
// to Default would still fail these assertions.
const ENTITY_A = '00000000-0000-0000-0000-0000000000aa';
const ENTITY_B = '00000000-0000-0000-0000-0000000000bb';

describe.skipIf(!SUITE_ENABLED)('integration: legacy route tenancy', () => {
  let pool: Pool;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    // Route modules import from '../db', which creates its own pool from
    // DATABASE_URL. We align both pools to the same URL for this suite.
    process.env.DATABASE_URL = URL;
    pool = new Pool({ connectionString: URL });

    // Seed two entities + one user per entity.
    await pool.query(`
      INSERT INTO entities (id, group_id, name, short_code, country)
      VALUES
        ($1, '00000000-0000-0000-0000-000000000001', 'Entity A', 'ETEST-A', 'ES'),
        ($2, '00000000-0000-0000-0000-000000000001', 'Entity B', 'ETEST-B', 'ES')
      ON CONFLICT (id) DO NOTHING
    `, [ENTITY_A, ENTITY_B]);
    await pool.query(`
      INSERT INTO entity_users (entity_id, user_id, role) VALUES
        ($1, 'user-a@test', 'Admin'),
        ($2, 'user-b@test', 'Admin')
      ON CONFLICT DO NOTHING
    `, [ENTITY_A, ENTITY_B]);

    // Import routers dynamically after DATABASE_URL is set.
    const { default: dealsRouter } = await import('../../../server/routes/deals');
    const { default: auditRouter } = await import('../../../server/routes/audit');
    const { default: configRouter } = await import('../../../server/routes/config');

    const app = express();
    app.use(express.json());
    // Fake auth + tenancy: read the entity + user from custom headers. In
    // production the real middlewares do JWT verification + entity_users
    // lookup; here we skip that layer so the suite can focus on query shape.
    app.use((req, _res, next) => {
      const entity = req.headers['x-entity-id'] as string | undefined;
      const email = (req.headers['x-user-email'] as string | undefined) ?? 'test@test';
      if (entity) {
        req.tenancy = { entityId: entity, userEmail: email, role: 'Admin', requestId: 'itest' };
      }
      (req as unknown as { user?: { email: string } }).user = { email };
      next();
    });
    app.use('/api/deals', dealsRouter);
    app.use('/api/audit', auditRouter);
    app.use('/api/config', configRouter);

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((r) => server.close(() => r()));
    // Clean up test data. Order matters (FK).
    //
    // audit_log is deliberately append-only — the `prevent_audit_modification`
    // trigger blocks UPDATE/DELETE, and audit_log.entity_id has an FK to
    // entities. That means we can neither delete the audit rows nor delete
    // the seeded entities they reference. Both are left in place: entity
    // INSERTs use ON CONFLICT DO NOTHING so reruns are idempotent, and the
    // test DB is short-lived in CI.
    await pool.query('DELETE FROM deals WHERE id LIKE $1', ['itest-%']);
    await pool.query('DELETE FROM rules WHERE product = $1', ['ITEST']);
    await pool.query('DELETE FROM entity_users WHERE user_id IN ($1, $2)', ['user-a@test', 'user-b@test']);
    await pool.end();
  });

  beforeEach(async () => {
    // Idempotent row setup: one deal + one audit + one rule per entity.
    for (const [entity, suffix] of [[ENTITY_A, 'a'], [ENTITY_B, 'b']] as const) {
      await pool.query(
        `INSERT INTO deals (id, status, client_id, product_type, currency, amount, entity_id)
         VALUES ($1, 'Draft', 'CLIENT-1', 'Loan', 'EUR', 1000000, $2)
         ON CONFLICT (id) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
        [`itest-deal-${suffix}`, entity],
      );
      await pool.query(
        `INSERT INTO audit_log (user_email, action, module, description, entity_id)
         VALUES ($1, 'TEST', 'itest', $2, $3)`,
        [`user-${suffix}@test`, `seed ${suffix}`, entity],
      );
      await pool.query(
        `INSERT INTO rules (business_unit, product, segment, tenor, entity_id)
         VALUES ('BU', 'ITEST', 'SEG', '1Y', $1)
         ON CONFLICT DO NOTHING`,
        [entity],
      );
    }
  });

  async function apiGet(path: string, entity: string, email = 'test@test') {
    const r = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-entity-id': entity, 'x-user-email': email },
    });
    const body = await r.json();
    return { status: r.status, body };
  }

  async function apiPost(path: string, entity: string, body: unknown, email = 'test@test') {
    const r = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-entity-id': entity,
        'x-user-email': email,
      },
      body: JSON.stringify(body),
    });
    const respBody = await r.json().catch(() => null);
    return { status: r.status, body: respBody };
  }

  async function apiDelete(path: string, entity: string, email = 'test@test') {
    const r = await fetch(`${baseUrl}${path}`, {
      method: 'DELETE',
      headers: { 'x-entity-id': entity, 'x-user-email': email },
    });
    const respBody = await r.json().catch(() => null);
    return { status: r.status, body: respBody };
  }

  it('GET /api/deals only returns deals for the caller entity', async () => {
    const a = await apiGet('/api/deals', ENTITY_A);
    const b = await apiGet('/api/deals', ENTITY_B);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const idsA = (a.body as Array<{ id: string }>).map((d) => d.id);
    const idsB = (b.body as Array<{ id: string }>).map((d) => d.id);
    expect(idsA).toContain('itest-deal-a');
    expect(idsA).not.toContain('itest-deal-b');
    expect(idsB).toContain('itest-deal-b');
    expect(idsB).not.toContain('itest-deal-a');
  });

  it('GET /api/deals/:id from the wrong entity returns 404 instead of the row', async () => {
    const r = await apiGet('/api/deals/itest-deal-b', ENTITY_A);
    expect(r.status).toBe(404);
  });

  it('POST /api/deals/upsert rejects body.entity_id that does not match the caller', async () => {
    const r = await apiPost('/api/deals/upsert', ENTITY_A, {
      id: 'itest-deal-forge',
      status: 'Draft',
      amount: 100,
      entity_id: ENTITY_B,
    });
    expect(r.status).toBe(403);
    expect((r.body as { code?: string } | null)?.code).toBe('tenancy_forbidden_write');
  });

  it('DELETE /api/deals/:id from the wrong entity is a no-op (silent), and the row still exists', async () => {
    const r = await apiDelete('/api/deals/itest-deal-b', ENTITY_A);
    expect(r.status).toBe(200); // Handler returns ok regardless
    const { rows } = await pool.query('SELECT id FROM deals WHERE id = $1', ['itest-deal-b']);
    expect(rows.length).toBe(1);
  });

  it('GET /api/audit only returns audit entries for the caller entity', async () => {
    const a = await apiGet('/api/audit', ENTITY_A);
    const b = await apiGet('/api/audit', ENTITY_B);
    const emailsA = (a.body as Array<{ user_email: string }>).map((r) => r.user_email);
    const emailsB = (b.body as Array<{ user_email: string }>).map((r) => r.user_email);
    expect(emailsA).toContain('user-a@test');
    expect(emailsA).not.toContain('user-b@test');
    expect(emailsB).toContain('user-b@test');
    expect(emailsB).not.toContain('user-a@test');
  });

  it('GET /api/config/rules only returns rules for the caller entity', async () => {
    const a = await apiGet('/api/config/rules', ENTITY_A);
    const b = await apiGet('/api/config/rules', ENTITY_B);
    const entA = new Set((a.body as Array<{ entity_id: string }>).map((r) => r.entity_id));
    const entB = new Set((b.body as Array<{ entity_id: string }>).map((r) => r.entity_id));
    expect(entA).toContain(ENTITY_A);
    expect(entA).not.toContain(ENTITY_B);
    expect(entB).toContain(ENTITY_B);
    expect(entB).not.toContain(ENTITY_A);
  });

  it('fuzz: 30 alternating-entity reads do not cross-tenant', async () => {
    const ops = Array.from({ length: 30 }, (_, i) => i);
    const results = await Promise.all(ops.map(async (i) => {
      const entity = i % 2 === 0 ? ENTITY_A : ENTITY_B;
      const r = await apiGet('/api/deals', entity);
      const foreignSuffix = i % 2 === 0 ? 'b' : 'a';
      const ids = (r.body as Array<{ id: string }>).map((d) => d.id);
      return ids.some((id) => id === `itest-deal-${foreignSuffix}`);
    }));
    expect(results.every((leaked) => !leaked)).toBe(true);
  });
});
