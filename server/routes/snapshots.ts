import { Router } from 'express';
import { query, queryOne, withTenancyTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';
import { replaySnapshot, type SnapshotPayload } from '../workers/snapshotReplay';
import {
  listSnapshotSummaries,
  loadSnapshotDetail,
  snapshotDetailToDto,
  snapshotSummaryToDto,
  verifySnapshotChainForEntity,
} from '@npricing/evidence';

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

    const result = await verifySnapshotChainForEntity(
      { query },
      {
        entityId: req.tenancy.entityId,
        from,
        to,
      }
    );
    res.json(result);
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
    const row = await loadSnapshotDetail({ queryOne }, req.tenancy.entityId, req.params.id);
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Snapshot not found' });
      return;
    }
    res.json(snapshotDetailToDto(row));
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

    const rows = await listSnapshotSummaries({ query }, { entityId: req.tenancy.entityId, dealId, limit });
    res.json(rows.map(snapshotSummaryToDto));
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
      (tx) => loadSnapshotDetail(tx, req.tenancy!.entityId, req.params.id)
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
