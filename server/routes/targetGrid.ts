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

function listParam(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v) => listParam(v));
  }
  if (typeof value !== 'string') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function addListFilter(
  filters: string[],
  params: unknown[],
  column: string,
  values: string[],
): void {
  if (values.length === 0) return;
  params.push(values);
  filters.push(`${column} = ANY($${params.length}::text[])`);
}

function buildCellQuery(
  snapshotId: string,
  entityId: string,
  queryParams: Record<string, unknown>,
): { filters: string[]; params: unknown[] } {
  const params: unknown[] = [snapshotId, entityId];
  const filters: string[] = ['snapshot_id = $1', 'entity_id = $2'];

  addListFilter(filters, params, 'product', listParam(queryParams.products ?? queryParams.product));
  addListFilter(filters, params, 'segment', listParam(queryParams.segments ?? queryParams.segment));
  addListFilter(filters, params, 'tenor_bucket', listParam(queryParams.tenor_buckets ?? queryParams.tenorBucket));
  addListFilter(filters, params, 'currency', listParam(queryParams.currencies ?? queryParams.currency));

  return { filters, params };
}

async function loadCellsForSnapshot(
  snapshotId: string,
  entityId: string,
  queryParams: Record<string, unknown> = {},
) {
  const { filters, params } = buildCellQuery(snapshotId, entityId, queryParams);
  return query<Record<string, unknown>>(
    `SELECT * FROM target_grid_cells WHERE ${filters.join(' AND ')} ORDER BY product, segment, tenor_bucket, currency`,
    params,
  );
}

function exportRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    Product: row.product,
    Segment: row.segment,
    Tenor: row.tenor_bucket,
    Currency: row.currency,
    'FTP (%)': Number(row.ftp ?? 0),
    'Liquidity Premium (%)': row.liquidity_premium == null ? null : Number(row.liquidity_premium),
    'Capital Charge (%)': row.capital_charge == null ? null : Number(row.capital_charge),
    'ESG Adjustment (%)': row.esg_adjustment == null ? null : Number(row.esg_adjustment),
    'Target Margin (%)': Number(row.target_margin ?? 0),
    'Target Client Rate (%)': Number(row.target_client_rate ?? 0),
    'Target RAROC (%)': Number(row.target_raroc ?? 0),
    'Computed At': row.computed_at ?? row.created_at ?? '',
  }));
}

function pdfEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdf(lines: string[]): Buffer {
  const content = [
    'BT /F1 16 Tf 48 792 Td (N-Pricing Target Grid Export) Tj ET',
    ...lines.slice(0, 48).map((line, index) => {
      const size = index === 0 ? 10 : 8;
      return `BT /F1 ${size} Tf 48 ${764 - index * 14} Td (${pdfEscape(line).slice(0, 118)}) Tj ET`;
    }),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
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
    const entityId = req.tenancy.entityId;
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
    const rows = await loadCellsForSnapshot(
      req.params.snapshotId,
      req.tenancy.entityId,
      req.query as Record<string, unknown>,
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
    const entityId = req.tenancy.entityId;
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
    const tenantEntityId = req.tenancy.entityId;
    if (
      typeof body.entity_id === 'string' &&
      body.entity_id.length > 0 &&
      body.entity_id !== tenantEntityId
    ) {
      res.status(403).json({
        code: 'tenancy_forbidden_write',
        message: 'body.entity_id does not match the authenticated tenancy',
      });
      return;
    }
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
       WHERE canonical_deal_templates.entity_id IS NULL
          OR canonical_deal_templates.entity_id = $2
       RETURNING *`,
      [
        id,
        tenantEntityId,
        body.product,
        body.segment,
        body.tenor_bucket,
        body.currency ?? 'EUR',
        JSON.stringify(body.template ?? {}),
        JSON.stringify(body.editable_by_role ?? ['methodologist', 'admin']),
      ],
    );
    if (!row) {
      res.status(409).json({
        code: 'entity_mismatch',
        message: 'Template id exists in another entity',
      });
      return;
    }
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
// Exports
// ---------------------------------------------------------------------------

router.get('/snapshots/:snapshotId/export/xlsx', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await loadCellsForSnapshot(
      req.params.snapshotId,
      req.tenancy.entityId,
      req.query as Record<string, unknown>,
    );
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    XLSX.utils.book_append_sheet(wb, ws, 'Target Grid');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="target-grid-${req.params.snapshotId.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/snapshots/:snapshotId/export/pdf', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await loadCellsForSnapshot(
      req.params.snapshotId,
      req.tenancy.entityId,
      req.query as Record<string, unknown>,
    );
    const lines = [
      `Snapshot: ${req.params.snapshotId}`,
      `Cells: ${rows.length}`,
      ...exportRows(rows).map((row) => (
        `${row.Product} | ${row.Segment} | ${row.Tenor} | ${row.Currency} | FTP ${row['FTP (%)']} | Client ${row['Target Client Rate (%)']} | RAROC ${row['Target RAROC (%)']}`
      )),
    ];
    const pdf = buildSimplePdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="target-grid-${req.params.snapshotId.slice(0, 8)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
