import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshotToDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    version: row.version,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    governance_request_id: row.governance_request_id,
    methodology_hash: row.methodology_hash,
    notes: row.notes,
    entity_id: row.entity_id,
    is_current: row.is_current,
    created_at: row.created_at,
  };
}

function cellToDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    snapshot_id: row.snapshot_id,
    entity_id: row.entity_id,
    product: row.product,
    segment: row.segment,
    tenor_bucket: row.tenor_bucket,
    currency: row.currency,
    canonical_deal_input: row.canonical_deal_input,
    ftp: row.ftp,
    liquidity_premium: row.liquidity_premium,
    capital_charge: row.capital_charge,
    esg_adjustment: row.esg_adjustment,
    target_margin: row.target_margin,
    target_client_rate: row.target_client_rate,
    target_raroc: row.target_raroc,
    components: row.components,
    computed_at: row.computed_at ?? row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

router.get('/snapshots', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id : req.tenancy.entityId;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM methodology_snapshots
       WHERE entity_id = $1
       ORDER BY is_current DESC, approved_at DESC NULLS LAST, created_at DESC
       LIMIT 200`,
      [entityId],
    );
    res.json(rows.map(snapshotToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/snapshots/:id', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await queryOne<Record<string, unknown>>(
      `SELECT * FROM methodology_snapshots WHERE id = $1 AND entity_id = $2 LIMIT 1`,
      [req.params.id, req.tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(snapshotToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/snapshots', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = String(body.id ?? randomUUID());
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO methodology_snapshots
         (id, entity_id, version, approved_at, approved_by, governance_request_id,
          methodology_hash, notes, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false))
       RETURNING *`,
      [
        id,
        req.tenancy.entityId,
        body.version ?? '1.0.0',
        body.approved_at ?? null,
        body.approved_by ?? null,
        body.governance_request_id ?? null,
        body.methodology_hash ?? '',
        body.notes ?? null,
        body.is_current ?? false,
      ],
    );
    res.status(201).json(row ? snapshotToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/snapshots/:snapshotId/set-current', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = req.tenancy.entityId;
    await execute(
      `UPDATE methodology_snapshots SET is_current = false WHERE entity_id = $1`,
      [entityId],
    );
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE methodology_snapshots SET is_current = true
       WHERE id = $1 AND entity_id = $2
       RETURNING *`,
      [req.params.snapshotId, entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(snapshotToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Grid Cells
// ---------------------------------------------------------------------------

router.get('/snapshots/:snapshotId/cells', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const params: unknown[] = [req.params.snapshotId, req.tenancy.entityId];
    const filters: string[] = ['snapshot_id = $1', 'entity_id = $2'];
    if (typeof req.query.product === 'string') {
      params.push(req.query.product);
      filters.push(`product = $${params.length}`);
    }
    if (typeof req.query.segment === 'string') {
      params.push(req.query.segment);
      filters.push(`segment = $${params.length}`);
    }
    if (typeof req.query.currency === 'string') {
      params.push(req.query.currency);
      filters.push(`currency = $${params.length}`);
    }
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM target_grid_cells WHERE ${filters.join(' AND ')} ORDER BY product, segment, tenor_bucket`,
      params,
    );
    res.json(rows.map(cellToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/cells/batch', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const cells = Array.isArray(req.body) ? req.body : [];
    const results: unknown[] = [];
    for (const cell of cells) {
      const id = String(cell.id ?? randomUUID());
      const row = await queryOne<Record<string, unknown>>(
        `INSERT INTO target_grid_cells
           (id, snapshot_id, entity_id, product, segment, tenor_bucket, currency,
            canonical_deal_input, ftp, liquidity_premium, capital_charge, esg_adjustment,
            target_margin, target_client_rate, target_raroc, components)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           ftp = EXCLUDED.ftp,
           liquidity_premium = EXCLUDED.liquidity_premium,
           capital_charge = EXCLUDED.capital_charge,
           esg_adjustment = EXCLUDED.esg_adjustment,
           target_margin = EXCLUDED.target_margin,
           target_client_rate = EXCLUDED.target_client_rate,
           target_raroc = EXCLUDED.target_raroc,
           components = EXCLUDED.components,
           canonical_deal_input = EXCLUDED.canonical_deal_input
         RETURNING *`,
        [
          id,
          cell.snapshot_id,
          cell.entity_id ?? req.tenancy.entityId,
          cell.product,
          cell.segment,
          cell.tenor_bucket,
          cell.currency ?? 'EUR',
          JSON.stringify(cell.canonical_deal_input ?? {}),
          cell.ftp ?? 0,
          cell.liquidity_premium ?? null,
          cell.capital_charge ?? null,
          cell.esg_adjustment ?? null,
          cell.target_margin ?? 0,
          cell.target_client_rate ?? 0,
          cell.target_raroc ?? 0,
          JSON.stringify(cell.components ?? {}),
        ],
      );
      if (row) results.push(cellToDto(row));
    }
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

router.get('/diff', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const fromId = String(req.query.from ?? '');
    const toId   = String(req.query.to ?? '');
    if (!fromId || !toId) {
      res.status(400).json({ code: 'invalid_params', message: 'from and to snapshot ids required' });
      return;
    }
    const eid = req.tenancy.entityId;
    const [fromCells, toCells] = await Promise.all([
      query<Record<string, unknown>>(`SELECT * FROM target_grid_cells WHERE snapshot_id=$1 AND entity_id=$2`, [fromId, eid]),
      query<Record<string, unknown>>(`SELECT * FROM target_grid_cells WHERE snapshot_id=$1 AND entity_id=$2`, [toId, eid]),
    ]);
    const fromMap = new Map(fromCells.map((c) => [`${c.product}|${c.segment}|${c.tenor_bucket}|${c.currency}`, c]));
    const toMap   = new Map(toCells.map((c) => [`${c.product}|${c.segment}|${c.tenor_bucket}|${c.currency}`, c]));
    const diffs: unknown[] = [];
    const allKeys = new Set([...fromMap.keys(), ...toMap.keys()]);
    for (const key of allKeys) {
      const from = fromMap.get(key);
      const to   = toMap.get(key);
      if (!from) diffs.push({ type: 'added', key, to: cellToDto(to!) });
      else if (!to) diffs.push({ type: 'removed', key, from: cellToDto(from) });
      else if (from.target_margin !== to.target_margin || from.ftp !== to.ftp || from.target_client_rate !== to.target_client_rate) {
        diffs.push({ type: 'changed', key, from: cellToDto(from), to: cellToDto(to) });
      }
    }
    res.json(diffs);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Canonical Deal Templates
// ---------------------------------------------------------------------------

router.get('/templates', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id : req.tenancy.entityId;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM canonical_deal_templates WHERE (entity_id IS NULL OR entity_id = $1) ORDER BY product, segment`,
      [entityId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/templates', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = String(body.id ?? randomUUID());
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO canonical_deal_templates
         (id, entity_id, product, segment, tenor_bucket, currency, template, editable_by_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         product = EXCLUDED.product,
         segment = EXCLUDED.segment,
         tenor_bucket = EXCLUDED.tenor_bucket,
         currency = EXCLUDED.currency,
         template = EXCLUDED.template,
         editable_by_role = EXCLUDED.editable_by_role,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        body.entity_id ?? req.tenancy.entityId,
        body.product,
        body.segment,
        body.tenor_bucket,
        body.currency ?? 'EUR',
        JSON.stringify(body.template ?? {}),
        JSON.stringify(body.editable_by_role ?? ['methodologist', 'admin']),
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    await execute(
      `DELETE FROM canonical_deal_templates WHERE id = $1 AND (entity_id IS NULL OR entity_id = $2)`,
      [req.params.id, req.tenancy.entityId],
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Export stubs (xlsx/pdf require additional libraries — return JSON for now)
// ---------------------------------------------------------------------------

router.get('/snapshots/:snapshotId/export/xlsx', async (req, res) => {
  res.status(501).json({ code: 'not_implemented', message: 'XLSX export requires server-side package' });
});

router.get('/snapshots/:snapshotId/export/pdf', async (req, res) => {
  res.status(501).json({ code: 'not_implemented', message: 'PDF export requires server-side package' });
});

export default router;
