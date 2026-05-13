import { pool } from './db';
import { runConsolidatedMigrations } from './migrationRunner';

/**
 * Boot-time migration entrypoint. Replaces the historical 1140-line inline
 * SCHEMA constant — the schema now lives in `supabase/migrations/*.sql`
 * (the canonical source per `supabase/migrations/README.md`).
 *
 * Behavior:
 *   1. Run Supabase-compat bootstrap (auth schema, anon/authenticated/
 *      service_role, supabase_realtime publication) — no-ops on real
 *      Supabase, populates stubs on raw Postgres (Replit, local, CI).
 *   2. Apply every pending migration from `supabase/migrations/`, tracked
 *      in `_n_pricing_migrations`. Subsequent boots skip already-applied
 *      files and abort if a file's content hash changed (tamper guard).
 *
 * Path override: set `N_PRICING_MIGRATIONS_DIR` if the deploy layout
 * separates compiled server code from the migration files.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const report = await runConsolidatedMigrations(client);
    console.info(
      `[migrate] schema applied | applied=${report.applied.length} ` +
      `skipped=${report.skippedAlreadyApplied.length}`,
    );
    if (report.applied.length > 0) {
      console.info(`[migrate] newly applied: ${report.applied.join(', ')}`);
    }
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
