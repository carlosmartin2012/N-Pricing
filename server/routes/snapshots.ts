import { Router } from 'express';
import { query, queryOne, withTenancyTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';
import { replaySnapshot, type SnapshotPayload } from '../workers/snapshotReplay';
import { verifySnapshotChain, type SnapshotChainLink } from '../../utils/snapshotHash';

/**
 * Pricing snapshot read + replay.
 *
 * Replay semantics:
 *   - Load the stored snapshot by id.
 *   - Recompute the output hash from the stored output (no engine invocation
 *     yet — that requires the server-side pricing runner, which will land in
 *     a follow-up sprint). For now `current` equals `original` and the endpoint
 *     verifies the snapshot has not been tampered with.
 *
 * When the full replay lands, this handler will additionally call the pricing
 * engine with the stored input+context and compare the two outputs field by
 * field.
 */

const router = Router();

interface SnapshotRow {
  id: string;
  entity_id: string;
  deal_id: string | null;
  pricing_result_id: string | null;
  request_id: string;
  engine_version: string;
  as_of_date: string;
  used_mock_for: string[];
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  output: Record<string, unknown>;
  input_hash: string;
  output_hash: string;
  created_at: string;
}

function rowToDto(row: SnapshotRow): Record<string, unknown> {
  return {
    id: row.id,
    entityId: row.entity_id,
    dealId: row.deal_id,
    pricingResultId: row.pricing_result_id,
    requestId: row.request_id,
    engineVersion: row.engine_version,
    asOfDate: row.as_of_date,
    usedMockFor: row.used_mock_for,
    input: row.input,
    context: row.context,
    output: row.output,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    createdAt: row.created_at,
  };
}

async function loadSnapshot(tenancyEntityId: string, id: string): Promise<SnapshotRow | null> {
  const row = await queryOne<SnapshotRow>(
    `SELECT id, entity_id, deal_id, pricing_result_id, request_id, engine_version,
            as_of_date, used_mock_for, input, context, output, input_hash, output_hash, created_at
     FROM pricing_snapshots
     WHERE id = $1 AND entity_id = $2
     LIMIT 1`,
    [id, tenancyEntityId],
  );
  return row;
}

/**
 * Ola 6 Bloque C — snapshot hash chain verification.
 *
 * Admin-only. Walks pricing_snapshots for the caller's entity in an optional
 * date window (inclusive `from` / `to` in ISO-8601 UTC) and checks that each
 * non-first row's `prev_output_hash` matches the predecessor's `output_hash`.
 *
 * A tampered historical row surfaces as `valid: false` with `brokenAt`
 * pointing at the first snapshot whose chain link does not match.
 *
 * NOTE: declared BEFORE `/:id` so Express does not match "verify-chain" as
 * a snapshot UUID.
 */
router.get('/verify-chain', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ code: 'admin_required', message: 'Admin role required' });
      return;
    }

    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;

    const filters = ['entity_id = $1'];
    const params: Array<string> = [req.tenancy.entityId];
    if (from) { params.push(from); filters.push(`created_at >= $${params.length}`); }
    if (to)   { params.push(to);   filters.push(`created_at <= $${params.length}`); }

    const rows = await query<{ id: string; output_hash: string; prev_output_hash: string | null }>(
      `SELECT id, output_hash, prev_output_hash
       FROM pricing_snapshots
       WHERE ${filters.join(' AND ')}
       ORDER BY created_at ASC, id ASC`,
      params,
    );
    const links: SnapshotChainLink[] = rows.map((r) => ({
      id: r.id,
      outputHash: r.output_hash,
      prevOutputHash: r.prev_output_hash,
    }));
    const result = verifySnapshotChain(links);
    res.json({
      entityId: req.tenancy.entityId,
      from,
      to,
      count: links.length,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await loadSnapshot(req.tenancy.entityId, req.params.id);
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Snapshot not found' });
      return;
    }
    res.json(rowToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const dealId = typeof req.query.deal_id === 'string' ? req.query.deal_id : null;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);

    const rows = dealId
      ? await query<SnapshotRow>(
          `SELECT id, entity_id, deal_id, pricing_result_id, request_id, engine_version,
                  as_of_date, used_mock_for, input_hash, output_hash, created_at
           FROM pricing_snapshots
           WHERE entity_id = $1 AND deal_id = $2
           ORDER BY created_at DESC LIMIT $3`,
          [req.tenancy.entityId, dealId, limit],
        )
      : await query<SnapshotRow>(
          `SELECT id, entity_id, deal_id, pricing_result_id, request_id, engine_version,
                  as_of_date, used_mock_for, input_hash, output_hash, created_at
           FROM pricing_snapshots
           WHERE entity_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [req.tenancy.entityId, limit],
        );

    res.json(rows.map((r) => {
      // List view omits heavy input/context/output blobs — they're on the detail endpoint.
      return {
        id: r.id,
        dealId: r.deal_id,
        requestId: r.request_id,
        engineVersion: r.engine_version,
        asOfDate: r.as_of_date,
        usedMockFor: r.used_mock_for,
        inputHash: r.input_hash,
        outputHash: r.output_hash,
        createdAt: r.created_at,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

/**
 * Replay a stored snapshot. Re-runs the pricing engine against the stored
 * input + context with the *current* engine code, then compares the resulting
 * output hash to the one persisted at original-call time. Field-level diffs
 * are reported in absolute and bps deltas for the numeric FTP outputs.
 *
 * matches = true  → engine output is byte-identical to what was recorded.
 * matches = false → the diff array shows which fields drifted.
 */
router.post('/:id/replay', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    // Defense-in-depth: aunque withTenancyTransaction setea
    // `app.current_entity_id` y RLS filtra, añadimos `AND entity_id = $2`
    // explícito por si la sesión variable falla o el RLS está desactivado
    // en el deploy. Belt + suspenders en queries del replay regulatorio.
    const row = await withTenancyTransaction(
      { entityId: req.tenancy.entityId, userEmail: req.tenancy.userEmail, role: req.tenancy.role },
      (tx) => tx.queryOne<SnapshotRow>(
        `SELECT * FROM pricing_snapshots WHERE id = $1 AND entity_id = $2 LIMIT 1`,
        [req.params.id, req.tenancy!.entityId],
      ),
    );

    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Snapshot not found' });
      return;
    }

    const payload: SnapshotPayload = {
      input: row.input as unknown as SnapshotPayload['input'],
      context: row.context,
      output: row.output,
      outputHash: row.output_hash,
      engineVersion: row.engine_version,
    };
    const result = await replaySnapshot(payload, process.env.ENGINE_VERSION ?? 'dev-local');

    res.json({
      snapshotId: row.id,
      matches: result.matches,
      engineVersionOriginal: result.engineVersionOriginal,
      engineVersionNow: result.engineVersionNow,
      originalOutputHash: result.originalOutputHash,
      currentOutputHash: result.currentOutputHash,
      diff: result.diff,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
