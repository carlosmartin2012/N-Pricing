import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Path resolution: the runner is loaded by `tsx server/index.ts`, so
 * `__dirname` is `<repo>/server`. Migrations live at `<repo>/supabase/migrations`.
 * If the build pipeline ever bundles server code to a different layout, override
 * via `N_PRICING_MIGRATIONS_DIR` env var.
 */
const MIGRATIONS_DIR = process.env.N_PRICING_MIGRATIONS_DIR
  ?? path.resolve(__dirname, '..', 'supabase', 'migrations');

/**
 * Supabase-hosted Postgres provisions objects our migrations take for
 * granted (auth schema, anon/authenticated/service_role, supabase_realtime
 * publication). A vanilla postgres:16 container (Replit, local dev,
 * GitHub Actions services) has none of them — so we bootstrap minimal
 * compat stubs before running migrations. All statements are idempotent
 * (IF NOT EXISTS / OR REPLACE) and safe to run against real Supabase too,
 * where they no-op because the objects already exist.
 *
 * Mirrors `.github/workflows/ci.yml` "Bootstrap Supabase-specific objects".
 * Update both sites in tandem when adding new Supabase-only dependencies.
 */
const SUPABASE_COMPAT_BOOTSTRAP = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
  LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE TABLE IF NOT EXISTS auth.users (
  id    UUID PRIMARY KEY,
  email TEXT
);
`;

/**
 * Tracking table for applied migrations. Records each filename plus the
 * sha256 of its contents so a tampered/edited migration is detected on the
 * next boot (we refuse to re-apply silently with a changed hash).
 */
const APPLIED_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS _n_pricing_migrations (
  filename     TEXT         PRIMARY KEY,
  content_hash TEXT         NOT NULL,
  applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`;

async function sha256Hex(content: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

export interface MigrationRunReport {
  applied: string[];
  skippedAlreadyApplied: string[];
  tamperedFiles: string[];
  bootstrap: 'applied';
}

/**
 * Apply Supabase compat bootstrap + every pending migration in
 * `supabase/migrations/`. Idempotent: subsequent calls re-run the bootstrap
 * (it no-ops) and skip migrations already recorded in `_n_pricing_migrations`
 * unless their content hash changed (in which case we abort — re-applying
 * an edited migration is unsafe).
 *
 * The function expects a `PoolClient` so the caller controls connection
 * lifecycle. Each migration is applied in its own transaction so a failure
 * in migration N leaves migrations 1..N-1 committed.
 */
export async function runConsolidatedMigrations(
  client: PoolClient,
): Promise<MigrationRunReport> {
  // 1. Bootstrap Supabase-compat stubs. Single statement, no transaction —
  //    DO blocks can't be wrapped in BEGIN/COMMIT cleanly across drivers.
  await client.query(SUPABASE_COMPAT_BOOTSTRAP);

  // 2. Tracking table — created idempotently before any migration runs.
  await client.query(APPLIED_MIGRATIONS_DDL);

  const files = await listMigrationFiles();
  const applied: string[] = [];
  const skippedAlreadyApplied: string[] = [];
  const tamperedFiles: string[] = [];

  const { rows: existing } = await client.query<{
    filename: string;
    content_hash: string;
  }>('SELECT filename, content_hash FROM _n_pricing_migrations');
  const known = new Map(existing.map((r) => [r.filename, r.content_hash]));

  for (const filename of files) {
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const content = await readFile(fullPath, 'utf8');
    const hash = await sha256Hex(content);

    const previousHash = known.get(filename);
    if (previousHash) {
      if (previousHash !== hash) {
        tamperedFiles.push(filename);
        continue;
      }
      skippedAlreadyApplied.push(filename);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(content);
      await client.query(
        'INSERT INTO _n_pricing_migrations (filename, content_hash) VALUES ($1, $2)',
        [filename, hash],
      );
      await client.query('COMMIT');
      applied.push(filename);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${filename} failed: ${(err as Error).message}`, { cause: err });
    }
  }

  if (tamperedFiles.length > 0) {
    throw new Error(
      `Migration file content hash mismatch — refusing to continue. ` +
      `Files changed after they were applied: ${tamperedFiles.join(', ')}. ` +
      `If the edit was intentional, write a new migration with a later timestamp ` +
      `or manually update _n_pricing_migrations.content_hash.`,
    );
  }

  return {
    applied,
    skippedAlreadyApplied,
    tamperedFiles,
    bootstrap: 'applied',
  };
}
