#!/usr/bin/env tsx
/**
 * Apply every migration in `supabase/migrations/` against
 * `INTEGRATION_DATABASE_URL` (CI) or `DATABASE_URL` (anything else).
 *
 * Thin CLI over `server/migrationRunner.ts` so CI can call the same code
 * path the server boots through. Replaces the historical bash loop in
 * `.github/workflows/ci.yml` which had a silent-failure bug: each
 * migration was applied via `psql -v ON_ERROR_STOP=1`, but the surrounding
 * `for` loop had no `set -e`, so a failing migration logged the error and
 * the loop carried on — leaving CI green with a partially-applied schema.
 *
 * Exit 0 on success, 1 on any migration failure. Idempotent: tracks
 * applied migrations in `_n_pricing_migrations` and skips on re-runs.
 */

import { Pool } from 'pg';
import { runConsolidatedMigrations } from '../server/migrationRunner';

async function main(): Promise<void> {
  const url = process.env.INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('apply-migrations: INTEGRATION_DATABASE_URL or DATABASE_URL must be set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const report = await runConsolidatedMigrations(client);
    console.log(
      `apply-migrations: applied=${report.applied.length} ` +
      `skipped=${report.skippedAlreadyApplied.length}`,
    );
    if (report.applied.length > 0) {
      console.log(`apply-migrations: newly applied: ${report.applied.join(', ')}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('apply-migrations failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
