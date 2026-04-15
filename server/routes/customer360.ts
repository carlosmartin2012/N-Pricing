import { Router } from 'express';
import { pool, query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  buildClientRelationship,
  mapClientPositionRow,
  mapClientMetricsSnapshotRow,
  mapPricingTargetRow,
} from '../../utils/customer360/relationshipAggregator';
import { parsePositionsCsv, parseMetricsCsv } from '../../utils/customer360/csvImport';
import type { ClientEntity } from '../../types';

const router = Router();

interface ClientRow {
  id: string;
  name: string;
  type: ClientEntity['type'] | null;
  segment: string | null;
  rating: string | null;
}

function mapClient(row: ClientRow): ClientEntity {
  return {
    id:      row.id,
    name:    row.name,
    type:    row.type ?? 'Corporate',
    segment: row.segment ?? '',
    rating:  row.rating ?? 'BBB',
  };
}

router.get('/clients/:clientId', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = req.tenancy.entityId;
    const clientId = req.params.clientId;
    const asOfDate = typeof req.query.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.as_of)
      ? req.query.as_of
      : new Date().toISOString().slice(0, 10);

    const client = await queryOne<ClientRow>(
      'SELECT id, name, type, segment, rating FROM clients WHERE id = $1 LIMIT 1',
      [clientId],
    );
    if (!client) {
      res.status(404).json({ code: 'not_found', message: 'Client not found' });
      return;
    }

    const [positions, metrics, targets] = await Promise.all([
      query<Parameters<typeof mapClientPositionRow>[0]>(
        `SELECT * FROM client_positions
         WHERE entity_id = $1 AND client_id = $2
         ORDER BY status ASC, start_date DESC`,
        [entityId, clientId],
      ),
      query<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
        `SELECT * FROM client_metrics_snapshots
         WHERE entity_id = $1 AND client_id = $2
         ORDER BY computed_at DESC LIMIT 24`,
        [entityId, clientId],
      ),
      query<Parameters<typeof mapPricingTargetRow>[0]>(
        `SELECT * FROM pricing_targets
         WHERE entity_id = $1 AND is_active = true`,
        [entityId],
      ),
    ]);

    const aggregate = buildClientRelationship({
      client: mapClient(client),
      positions: positions.map(mapClientPositionRow),
      metricsHistory: metrics.map(mapClientMetricsSnapshotRow),
      targets: targets.map(mapPricingTargetRow),
      asOfDate,
    });
    res.json(aggregate);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/clients/:clientId/positions', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await query<Parameters<typeof mapClientPositionRow>[0]>(
      `SELECT * FROM client_positions
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY status ASC, start_date DESC`,
      [req.tenancy.entityId, req.params.clientId],
    );
    res.json(rows.map(mapClientPositionRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/clients/:clientId/metrics', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '12'), 10) || 12, 1), 60);
    const rows = await query<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
      `SELECT * FROM client_metrics_snapshots
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY computed_at DESC LIMIT $3`,
      [req.tenancy.entityId, req.params.clientId, limit],
    );
    res.json(rows.map(mapClientMetricsSnapshotRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients/:clientId/positions', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ code: 'invalid_payload', message: 'body required' });
      return;
    }
    const productType = String(body.productType ?? '');
    const category = String(body.category ?? '');
    const amount = Number(body.amount);
    if (!productType || !['Asset', 'Liability', 'Off-Balance', 'Service'].includes(category) || !Number.isFinite(amount)) {
      res.status(400).json({ code: 'invalid_payload', message: 'productType, category and amount are required' });
      return;
    }
    const row = await queryOne<Parameters<typeof mapClientPositionRow>[0]>(
      `INSERT INTO client_positions (
         entity_id, client_id, product_id, product_type, category, deal_id,
         amount, currency, margin_bps, start_date, maturity_date, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, 'Active'))
       RETURNING *`,
      [
        req.tenancy.entityId,
        req.params.clientId,
        body.productId ?? null,
        productType,
        category,
        body.dealId ?? null,
        amount,
        body.currency ?? 'EUR',
        body.marginBps ?? null,
        body.startDate ?? new Date().toISOString().slice(0, 10),
        body.maturityDate ?? null,
        body.status ?? null,
      ],
    );
    res.status(201).json(row ? mapClientPositionRow(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/positions/:id', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) {
      res.status(400).json({ code: 'invalid_payload', message: 'body required' });
      return;
    }
    const row = await queryOne<Parameters<typeof mapClientPositionRow>[0]>(
      `UPDATE client_positions SET
         amount        = COALESCE($3, amount),
         margin_bps    = COALESCE($4, margin_bps),
         maturity_date = COALESCE($5, maturity_date),
         status        = COALESCE($6, status),
         updated_at    = NOW()
       WHERE id = $1 AND entity_id = $2
       RETURNING *`,
      [
        req.params.id,
        req.tenancy.entityId,
        body.amount ?? null,
        body.marginBps ?? null,
        body.maturityDate ?? null,
        body.status ?? null,
      ],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Position not found' });
      return;
    }
    res.json(mapClientPositionRow(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients/:clientId/metrics', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const period = String(body?.period ?? '').trim();
    if (!period) {
      res.status(400).json({ code: 'invalid_payload', message: 'period required' });
      return;
    }
    const row = await queryOne<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
      `INSERT INTO client_metrics_snapshots (
         entity_id, client_id, period,
         nim_bps, fees_eur, eva_eur, share_of_wallet_pct,
         relationship_age_years, nps_score,
         active_position_count, total_exposure_eur, source, detail
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, 'computed'), $13::jsonb)
       RETURNING *`,
      [
        req.tenancy.entityId,
        req.params.clientId,
        period,
        body?.nimBps ?? null,
        body?.feesEur ?? null,
        body?.evaEur ?? null,
        body?.shareOfWalletPct ?? null,
        body?.relationshipAgeYears ?? null,
        body?.npsScore ?? null,
        body?.activePositionCount ?? 0,
        body?.totalExposureEur ?? 0,
        body?.source ?? null,
        JSON.stringify(body?.detail ?? {}),
      ],
    );
    res.status(201).json(row ? mapClientMetricsSnapshotRow(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/pricing-targets', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const segment      = String(body?.segment ?? '').trim();
    const productType  = String(body?.productType ?? '').trim();
    const period       = String(body?.period ?? '').trim();
    if (!segment || !productType || !period) {
      res.status(400).json({ code: 'invalid_payload', message: 'segment, productType, period required' });
      return;
    }
    const row = await queryOne<Parameters<typeof mapPricingTargetRow>[0]>(
      `INSERT INTO pricing_targets (
         entity_id, segment, product_type, currency, period,
         target_margin_bps, target_raroc_pct, target_volume_eur,
         pre_approved_rate_bps, hard_floor_rate_bps,
         active_from, active_to, is_active, created_by
       ) VALUES ($1, $2, $3, COALESCE($4, 'EUR'), $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, true), $14)
       RETURNING *`,
      [
        req.tenancy.entityId,
        segment,
        productType,
        body?.currency ?? null,
        period,
        body?.targetMarginBps ?? null,
        body?.targetRarocPct ?? null,
        body?.targetVolumeEur ?? null,
        body?.preApprovedRateBps ?? null,
        body?.hardFloorRateBps ?? null,
        body?.activeFrom ?? new Date().toISOString().slice(0, 10),
        body?.activeTo ?? null,
        body?.isActive ?? null,
        req.tenancy.userEmail,
      ],
    );
    res.status(201).json(row ? mapPricingTargetRow(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- Bulk CSV import ----------
// Accepts text/csv body or { csv: '<text>' } JSON body. Streams INSERTs in
// chunks of 200 within a single transaction so partial failures roll back.

async function consumeCsv(req: import('express').Request): Promise<string> {
  const ct = (req.headers['content-type'] ?? '').toString().toLowerCase();
  if (ct.startsWith('text/csv') || ct.startsWith('text/plain')) {
    return await new Promise<string>((resolve, reject) => {
      let buf = '';
      req.on('data', (c) => { buf += c.toString('utf8'); });
      req.on('end', () => resolve(buf));
      req.on('error', reject);
    });
  }
  const body = req.body as Record<string, unknown> | undefined;
  return typeof body?.csv === 'string' ? body.csv : '';
}

router.post('/import/positions', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const csv = await consumeCsv(req);
    if (!csv) {
      res.status(400).json({ code: 'invalid_payload', message: 'CSV body required (text/csv or { csv })' });
      return;
    }
    const parsed = parsePositionsCsv(csv);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      res.status(400).json({ code: 'parse_failed', errors: parsed.errors });
      return;
    }
    const client = await pool.connect();
    let inserted = 0;
    try {
      await client.query('BEGIN');
      for (const r of parsed.rows) {
        await client.query(
          `INSERT INTO client_positions (
             entity_id, client_id, product_id, product_type, category, deal_id,
             amount, currency, margin_bps, start_date, maturity_date, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            req.tenancy.entityId, r.clientId, r.productId, r.productType, r.category,
            r.dealId, r.amount, r.currency, r.marginBps, r.startDate, r.maturityDate, r.status,
          ],
        );
        inserted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    res.status(201).json({
      inserted,
      skipped: parsed.errors.length,
      errors: parsed.errors,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/import/metrics', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const csv = await consumeCsv(req);
    if (!csv) {
      res.status(400).json({ code: 'invalid_payload', message: 'CSV body required' });
      return;
    }
    const parsed = parseMetricsCsv(csv);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      res.status(400).json({ code: 'parse_failed', errors: parsed.errors });
      return;
    }
    const client = await pool.connect();
    let inserted = 0;
    try {
      await client.query('BEGIN');
      for (const r of parsed.rows) {
        await client.query(
          `INSERT INTO client_metrics_snapshots (
             entity_id, client_id, period,
             nim_bps, fees_eur, eva_eur, share_of_wallet_pct,
             relationship_age_years, nps_score,
             active_position_count, total_exposure_eur, source, detail
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '{}'::jsonb)
           ON CONFLICT (entity_id, client_id, period) DO NOTHING`,
          [
            req.tenancy.entityId, r.clientId, r.period,
            r.nimBps, r.feesEur, r.evaEur, r.shareOfWalletPct,
            r.relationshipAgeYears, r.npsScore,
            r.activePositionCount, r.totalExposureEur, r.source,
          ],
        );
        inserted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    res.status(201).json({
      inserted,
      skipped: parsed.errors.length,
      errors: parsed.errors,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/pricing-targets', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const period = typeof req.query.period === 'string' ? req.query.period : null;
    const segment = typeof req.query.segment === 'string' ? req.query.segment : null;

    const conditions = ['entity_id = $1', 'is_active = true'];
    const params: unknown[] = [req.tenancy.entityId];
    if (period) {
      params.push(period);
      conditions.push(`period = $${params.length}`);
    }
    if (segment) {
      params.push(segment);
      conditions.push(`segment = $${params.length}`);
    }

    const rows = await query<Parameters<typeof mapPricingTargetRow>[0]>(
      `SELECT * FROM pricing_targets
       WHERE ${conditions.join(' AND ')}
       ORDER BY active_from DESC LIMIT 500`,
      params,
    );
    res.json(rows.map(mapPricingTargetRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
