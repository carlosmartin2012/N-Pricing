import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { runConsolidatedMigrations } from '../../../server/migrationRunner';

/**
 * Integration tests for the consolidated migration runner.
 *
 * Validates the contract documented in `server/migrationRunner.ts`:
 *   - Supabase-compat bootstrap is idempotent
 *   - All 43 migrations in `supabase/migrations/` apply in order against
 *     a vanilla Postgres
 *   - Subsequent calls skip already-applied migrations (no re-apply)
 *   - Tracking table records every applied file with content hash
 *   - Tampering with a migration after apply is detected and rejected
 *
 * Opt-in via INTEGRATION_DATABASE_URL. The test creates and drops a
 * dedicated schema namespace to avoid colliding with the main integration
 * suite's already-applied state. Because the runner targets the `public`
 * schema (all migrations are written against it), we instead run against
 * a separate database. The CI bootstrap step provisions one named
 * `npricing_test`; this test uses a sibling DB whose name is suffixed
 * with `_runner` so it can drop everything safely.
 *
 * If you run locally, point INTEGRATION_DATABASE_URL at a Postgres where
 * you can CREATE/DROP databases — typically a docker-compose superuser.
 */

const BASE_URL = process.env.INTEGRATION_DATABASE_URL;
const SUITE_ENABLED = !!BASE_URL;

function deriveSiblingDbUrl(base: string, suffix: string): string {
  const u = new URL(base);
  const original = u.pathname.replace(/^\//, '');
  u.pathname = `/${original}${suffix}`;
  return u.toString();
}

function extractDbName(connectionString: string): string {
  const u = new URL(connectionString);
  return u.pathname.replace(/^\//, '');
}

describe.skipIf(!SUITE_ENABLED)('integration: migration runner', () => {
  // Lazy bindings: describe body executes even when skipped, so we must not
  // touch BASE_URL eagerly (it's undefined when the suite is skipped).
  let SIBLING_DB = '';
  let ADMIN_URL = '';
  let RUNNER_URL = '';

  let adminPool: Pool;
  let runnerPool: Pool;

  beforeAll(async () => {
    SIBLING_DB = `${extractDbName(BASE_URL!)}_runner`;
    ADMIN_URL = BASE_URL!;
    RUNNER_URL = deriveSiblingDbUrl(BASE_URL!, '_runner');
    adminPool = new Pool({ connectionString: ADMIN_URL });
    // (Re)create the sibling DB clean. DROP DATABASE requires no live
    // connections; close runnerPool first if a prior run left one open
    // (best-effort — typically nothing to close on first run).
    await adminPool.query(`DROP DATABASE IF EXISTS ${SIBLING_DB}`);
    await adminPool.query(`CREATE DATABASE ${SIBLING_DB}`);
    runnerPool = new Pool({ connectionString: RUNNER_URL });
  }, 30_000);

  afterAll(async () => {
    await runnerPool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS ${SIBLING_DB}`);
    await adminPool.end();
  });

  it('applies all migrations against a vanilla database', async () => {
    const client = await runnerPool.connect();
    try {
      const report = await runConsolidatedMigrations(client);
      expect(report.bootstrap).toBe('applied');
      expect(report.applied.length).toBeGreaterThan(40);
      expect(report.skippedAlreadyApplied).toHaveLength(0);
      expect(report.tamperedFiles).toHaveLength(0);
    } finally {
      client.release();
    }

    // Spot-check: tables from across the migration timeline exist.
    const checks = ['deals', 'entities', 'pricing_snapshots', 'attribution_levels', 'push_subscriptions'];
    for (const table of checks) {
      const { rows } = await runnerPool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table],
      );
      expect(rows[0]?.exists, `table ${table} missing after migrations`).toBe(true);
    }
  }, 60_000);

  it('is idempotent — second run applies nothing', async () => {
    const client = await runnerPool.connect();
    try {
      const report = await runConsolidatedMigrations(client);
      expect(report.applied).toHaveLength(0);
      expect(report.skippedAlreadyApplied.length).toBeGreaterThan(40);
    } finally {
      client.release();
    }
  });

  it('records every migration in _n_pricing_migrations with a content hash', async () => {
    const { rows } = await runnerPool.query<{
      filename: string;
      content_hash: string;
      applied_at: string;
    }>('SELECT filename, content_hash, applied_at FROM _n_pricing_migrations ORDER BY filename');

    expect(rows.length).toBeGreaterThan(40);
    for (const row of rows) {
      expect(row.filename).toMatch(/^\d{14}.*\.sql$/);
      expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.applied_at).toBeTruthy();
    }
  });

  it('rejects tampered migration files on re-run', async () => {
    // Simulate tampering: corrupt one tracked hash.
    await runnerPool.query(
      `UPDATE _n_pricing_migrations
         SET content_hash = repeat('0', 64)
         WHERE filename = (SELECT filename FROM _n_pricing_migrations ORDER BY filename LIMIT 1)`,
    );
    const client = await runnerPool.connect();
    try {
      await expect(runConsolidatedMigrations(client)).rejects.toThrow(
        /content hash mismatch/i,
      );
    } finally {
      client.release();
    }
  });
});
