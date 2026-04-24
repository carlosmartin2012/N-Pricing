#!/usr/bin/env tsx
/**
 * Backfill `prev_output_hash` on historical pricing_snapshots — opt-in.
 *
 * Migration `20260619000003_pricing_snapshots_hash_chain.sql` added the
 * chain column but left historical rows NULL (explicit non-goal of the
 * migration). This script walks each entity's snapshots in chronological
 * order and stitches them into a single chain retroactively, so an
 * auditor running `GET /api/snapshots/verify-chain` over the full
 * history sees one continuous tamper-evidence trail instead of one
 * chain per post-migration pricing call.
 *
 * Usage:
 *   tsx scripts/backfill-snapshot-hash-chain.ts [--entity-id UUID] [--dry-run]
 *
 * Flags:
 *   --entity-id UUID  Scope to one tenant. Omit to walk every tenant
 *                     that has snapshots.
 *   --dry-run         Report planned updates without writing.
 *
 * Idempotency: rows that already have `prev_output_hash` set are
 * respected (used as the anchor for the next link) and never
 * overwritten. Re-runs on a fully-backfilled table are no-ops.
 *
 * Safety:
 *   - pricing_snapshots is immutable by RLS (no UPDATE/DELETE policies).
 *     The script must run with a DB role that has BYPASSRLS, typically
 *     the Supabase service role or the direct Postgres superuser.
 *   - Recommended to run during a maintenance window. If pricing is live
 *     and inserts a new snapshot mid-backfill, the forward chain is
 *     unaffected but the reported counts may include that row on a later
 *     run — still idempotent.
 *   - After the first successful run per environment, subsequent pricing
 *     calls extend the chain normally via the Edge writer
 *     (`insertSnapshotWithChain` in `supabase/functions/pricing/index.ts`).
 *
 * Exit code 0 on success, 1 on any fatal error or a verification failure.
 */

import { Pool } from 'pg';
import {
  verifySnapshotChain,
  type SnapshotChainLink,
} from '../utils/snapshotHash';

interface Args {
  entityId?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--entity-id' && i + 1 < argv.length) {
      out.entityId = argv[++i];
    }
  }
  return out;
}

interface BackfillReport {
  entityId: string;
  total: number;
  updated: number;
  skippedAlreadySet: number;
  skippedGenesis: number;
  conflicts: number;
}

async function backfillEntity(
  pool: Pool,
  entityId: string,
  dryRun: boolean,
): Promise<BackfillReport> {
  const { rows } = await pool.query<{
    id: string;
    output_hash: string;
    prev_output_hash: string | null;
  }>(
    `SELECT id, output_hash, prev_output_hash
     FROM pricing_snapshots
     WHERE entity_id = $1
     ORDER BY created_at ASC, id ASC`,
    [entityId],
  );

  const report: BackfillReport = {
    entityId,
    total: rows.length,
    updated: 0,
    skippedAlreadySet: 0,
    skippedGenesis: 0,
    conflicts: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i === 0) {
      // Entity genesis — legitimately NULL even post-backfill.
      report.skippedGenesis++;
      continue;
    }
    if (row.prev_output_hash !== null) {
      report.skippedAlreadySet++;
      continue;
    }

    const expectedPrev = rows[i - 1].output_hash;
    if (dryRun) {
      report.updated++;
      continue;
    }

    try {
      await pool.query(
        `UPDATE pricing_snapshots
         SET prev_output_hash = $1
         WHERE id = $2 AND prev_output_hash IS NULL`,
        [expectedPrev, row.id],
      );
      report.updated++;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '23505') {
        // Fork: another snapshot in this tenant already claims this
        // prev_output_hash. Happens if two historical rows shared an
        // output_hash — the chain forks there. Skip and carry on; the
        // final verifier will flag the break.
        report.conflicts++;
        continue;
      }
      throw e;
    }
  }

  return report;
}

async function verifyEntity(pool: Pool, entityId: string): Promise<boolean> {
  const { rows } = await pool.query<{
    id: string;
    output_hash: string;
    prev_output_hash: string | null;
  }>(
    `SELECT id, output_hash, prev_output_hash
     FROM pricing_snapshots
     WHERE entity_id = $1
     ORDER BY created_at ASC, id ASC`,
    [entityId],
  );
  const links: SnapshotChainLink[] = rows.map((r) => ({
    id: r.id,
    outputHash: r.output_hash,
    prevOutputHash: r.prev_output_hash,
  }));
  const result = verifySnapshotChain(links);
  if (!result.valid) {
    console.error(
      `CHAIN BROKEN entity=${entityId} at=${result.brokenAt?.snapshotId} ` +
        `expected=${result.brokenAt?.expectedPrev} actual=${result.brokenAt?.actualPrev}`,
    );
    return false;
  }
  console.log(`entity=${entityId} chain_valid=true checked=${result.checked}`);
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const entities = args.entityId
      ? [{ id: args.entityId }]
      : (
          await pool.query<{ id: string }>(
            `SELECT DISTINCT entity_id AS id FROM pricing_snapshots ORDER BY entity_id`,
          )
        ).rows;

    if (entities.length === 0) {
      console.log('no snapshots found; nothing to backfill');
      return;
    }

    console.log(
      `mode=${args.dryRun ? 'dry-run' : 'write'} entities=${entities.length}`,
    );

    for (const ent of entities) {
      const r = await backfillEntity(pool, ent.id, args.dryRun);
      console.log(
        `entity=${r.entityId} total=${r.total} updated=${r.updated} ` +
          `skipped_set=${r.skippedAlreadySet} genesis=${r.skippedGenesis} ` +
          `conflicts=${r.conflicts}`,
      );
    }

    if (args.dryRun) {
      console.log('dry-run complete — no rows modified; re-run without --dry-run to apply');
      return;
    }

    // Post-write verification: the chain for every touched tenant must
    // pass verifySnapshotChain end-to-end. A break here indicates either
    // a pre-existing corruption (chain already forked before backfill)
    // or a race with a concurrent pricing call — inspect logs and the
    // reported brokenAt.snapshotId before re-running.
    let allValid = true;
    for (const ent of entities) {
      const ok = await verifyEntity(pool, ent.id);
      if (!ok) allValid = false;
    }
    if (!allValid) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
