import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http, { Server } from 'http';
import { AddressInfo } from 'net';
import { Pool } from 'pg';

/**
 * Integration tests for /api/market-benchmarks (Ola 6 Bloque D).
 *
 * Validates the cross-tenant design and the admin-only write guard:
 *   - GET is open to any authenticated user (returns shared rows)
 *   - POST / DELETE require req.user?.role === 'Admin'
 *   - ON CONFLICT (product,tenor,client,currency,as_of) is idempotent
 *   - Filters products/currencies/clients apply as ANY()
 *
 * OPT-IN: only runs with INTEGRATION_DATABASE_URL set.
 */

const URL = process.env.INTEGRATION_DATABASE_URL;
const SUITE_ENABLED = !!URL;

const SEED_MARK = 'ITEST-BENCH';

describe.skipIf(!SUITE_ENABLED)('integration: market benchmarks route', () => {
  let pool: Pool;
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = URL;
    pool = new Pool({ connectionString: URL });

    const { default: marketBenchmarksRouter } = await import('../../../server/routes/marketBenchmarks');

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const role = (req.headers['x-user-role'] as string | undefined) ?? 'Trader';
      (req as unknown as { user?: { email: string; name: string; role?: string } }).user = {
        email: 'test@test',
        name: 'Test User',
        role,
      };
      next();
    });
    app.use('/api/market-benchmarks', marketBenchmarksRouter);

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((r) => server.close(() => r()));
    await pool.query('DELETE FROM market_benchmarks WHERE source = $1', [SEED_MARK]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM market_benchmarks WHERE source = $1', [SEED_MARK]);
  });

  async function call(method: 'GET' | 'POST' | 'DELETE', path: string, role: string, body?: unknown) {
    const r = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'x-user-role': role, 'content-type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const raw = method === 'DELETE' && r.status === 204 ? null : await r.json().catch(() => null);
    return { status: r.status, body: raw };
  }

  it('rejects POST for non-admin roles', async () => {
    const { status, body } = await call('POST', '/api/market-benchmarks', 'Trader', {
      productType: 'ITEST_P', tenorBucket: 'MT', clientType: 'Corporate',
      currency: 'EUR', rate: 4.2, source: SEED_MARK,
    });
    expect(status).toBe(403);
    expect(body?.code).toBe('admin_required');
  });

  it('accepts POST for Admin and is idempotent (upsert on conflict)', async () => {
    const payload = {
      productType: 'ITEST_P', tenorBucket: 'MT', clientType: 'Corporate',
      currency: 'EUR', rate: 4.2, source: SEED_MARK, asOfDate: '2026-04-23',
    };
    const first = await call('POST', '/api/market-benchmarks', 'Admin', payload);
    expect(first.status).toBe(201);
    expect(first.body?.rate).toBe(4.2);

    const second = await call('POST', '/api/market-benchmarks', 'Admin', { ...payload, rate: 4.35 });
    expect(second.status).toBe(201);
    expect(second.body?.rate).toBe(4.35);
    // Same tuple — should not create a duplicate row.
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM market_benchmarks
       WHERE product_type = $1 AND tenor_bucket = $2 AND client_type = $3
         AND currency = $4 AND as_of_date = $5`,
      ['ITEST_P', 'MT', 'Corporate', 'EUR', '2026-04-23'],
    );
    expect(rows[0].count).toBe('1');
  });

  it('GET allows any authenticated role and applies product/currency filters', async () => {
    await pool.query(
      `INSERT INTO market_benchmarks (product_type, tenor_bucket, client_type, currency, rate, source, as_of_date)
       VALUES
         ('ITEST_A', 'ST', 'Retail',    'EUR', 3.10, $1, '2026-04-23'),
         ('ITEST_B', 'MT', 'Corporate', 'USD', 5.50, $1, '2026-04-23')`,
      [SEED_MARK],
    );
    const all = await call('GET', '/api/market-benchmarks?products=ITEST_A,ITEST_B', 'Trader');
    expect(all.status).toBe(200);
    expect(Array.isArray(all.body)).toBe(true);
    const seeded = (all.body as Array<{ source: string }>).filter((r) => r.source === SEED_MARK);
    expect(seeded.length).toBe(2);

    const eurOnly = await call('GET', '/api/market-benchmarks?products=ITEST_A,ITEST_B&currencies=EUR', 'Trader');
    const seededEur = (eurOnly.body as Array<{ source: string; productType: string }>).filter((r) => r.source === SEED_MARK);
    expect(seededEur.length).toBe(1);
    expect(seededEur[0].productType).toBe('ITEST_A');
  });

  it('rejects DELETE for non-admin and allows Admin', async () => {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO market_benchmarks (product_type, tenor_bucket, client_type, currency, rate, source, as_of_date)
       VALUES ('ITEST_DEL', 'LT', 'SME', 'EUR', 4.9, $1, '2026-04-23') RETURNING id`,
      [SEED_MARK],
    );
    const id = ins.rows[0].id;

    const denied = await call('DELETE', `/api/market-benchmarks/${id}`, 'Trader');
    expect(denied.status).toBe(403);

    const ok = await call('DELETE', `/api/market-benchmarks/${id}`, 'Admin');
    expect(ok.status).toBe(204);

    const missing = await call('DELETE', `/api/market-benchmarks/${id}`, 'Admin');
    expect(missing.status).toBe(404);
  });

  it('rejects invalid payloads (400 on missing fields, bad tenor, out-of-range rate)', async () => {
    const missingFields = await call('POST', '/api/market-benchmarks', 'Admin', { productType: 'X' });
    expect(missingFields.status).toBe(400);

    const badTenor = await call('POST', '/api/market-benchmarks', 'Admin', {
      productType: 'X', tenorBucket: 'XX', clientType: 'C', currency: 'EUR', rate: 4, source: SEED_MARK,
    });
    expect(badTenor.status).toBe(400);

    const badRate = await call('POST', '/api/market-benchmarks', 'Admin', {
      productType: 'X', tenorBucket: 'MT', clientType: 'C', currency: 'EUR', rate: 99, source: SEED_MARK,
    });
    expect(badRate.status).toBe(400);
    expect(badRate.body?.code).toBe('invalid_rate');
  });
});
