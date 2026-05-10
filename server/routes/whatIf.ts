import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { execute, query, queryOne, withTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

const SANDBOX_STATUSES = new Set(['draft', 'computing', 'ready', 'published', 'archived']);
const BACKTEST_STATUSES = new Set(['pending', 'running', 'completed', 'failed']);
const METHODOLOGY_AUTHOR_ROLES = new Set(['Admin', 'Risk_Manager', 'Methodologist', 'admin', 'risk_manager', 'methodologist']);
const TENOR_TO_BENCHMARK: Record<string, 'ST' | 'MT' | 'LT'> = {
  '0-1Y': 'ST',
  '1-3Y': 'MT',
  '3-5Y': 'LT',
  '5-10Y': 'LT',
  '10Y+': 'LT',
  ST: 'ST',
  MT: 'MT',
  LT: 'LT',
};

interface ImpactTotals {
  currentNii: number;
  projectedNii: number;
  currentRaroc: number;
  projectedRaroc: number;
  volume: number;
  volumeAtRisk: number;
}

function tenant(req: Request, res: Response) {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return req.tenancy;
}

function requireMethodologyAuthor(req: Request, res: Response): boolean {
  const role = req.tenancy?.role ?? req.user?.role ?? '';
  if (!METHODOLOGY_AUTHOR_ROLES.has(role)) {
    res.status(403).json({ code: 'forbidden', message: 'Admin, Risk_Manager or Methodologist role required' });
    return false;
  }
  return true;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

function dateOnly(value: unknown): string {
  return isoDate(value).slice(0, 10);
}

function listParam(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => listParam(v));
  if (typeof value !== 'string') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function addAnyFilter(filters: string[], params: unknown[], column: string, values: string[]): void {
  if (values.length === 0) return;
  params.push(values);
  filters.push(`${column} = ANY($${params.length}::text[])`);
}

function userEmail(req: Request): string {
  return req.tenancy?.userEmail ?? req.user?.email ?? 'system@n-pricing.local';
}

function userName(req: Request): string {
  return req.user?.name ?? req.tenancy?.userEmail ?? 'System';
}

async function resolveSnapshotId(entityId: string, candidate: unknown): Promise<string | null> {
  const provided = asString(candidate);
  if (provided) return provided;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM methodology_snapshots
     WHERE entity_id = $1
     ORDER BY is_current DESC, approved_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [entityId],
  );
  return row?.id ?? null;
}

function sandboxToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description == null ? undefined : String(row.description),
    baseSnapshotId: String(row.base_snapshot_id ?? ''),
    status: String(row.status ?? 'draft'),
    diffs: asJsonArray(row.diffs),
    createdAt: isoDate(row.created_at),
    createdByEmail: String(row.created_by_email ?? ''),
    createdByName: String(row.created_by_name ?? ''),
    updatedAt: isoDate(row.updated_at),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
  };
}

function gridCellToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    snapshotId: String(row.snapshot_id ?? ''),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    tenorBucket: String(row.tenor_bucket ?? ''),
    currency: String(row.currency ?? ''),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    canonicalDealInput: asJsonObject(row.canonical_deal_input),
    ftp: asNumber(row.ftp),
    liquidityPremium: row.liquidity_premium == null ? null : asNumber(row.liquidity_premium),
    capitalCharge: row.capital_charge == null ? null : asNumber(row.capital_charge),
    esgAdjustment: row.esg_adjustment == null ? null : asNumber(row.esg_adjustment),
    targetMargin: asNumber(row.target_margin),
    targetClientRate: asNumber(row.target_client_rate),
    targetRaroc: asNumber(row.target_raroc),
    components: asJsonObject(row.components),
    computedAt: isoDate(row.computed_at ?? row.created_at),
  };
}

function amountFromCell(row: Record<string, unknown>): number {
  const input = asJsonObject(row.canonical_deal_input);
  return asNumber(input.amount ?? input.principal ?? input.notional, 1_000_000);
}

function diffDeltaBps(diff: unknown): number {
  if (!diff || typeof diff !== 'object') return 0;
  const record = diff as Record<string, unknown>;
  const current = Number(record.currentValue);
  const proposed = Number(record.proposedValue);
  if (!Number.isFinite(current) || !Number.isFinite(proposed)) return 0;
  return proposed - current;
}

async function computeImpactReport(sandboxId: string, entityId: string, markReady: boolean) {
  const sandbox = await queryOne<Record<string, unknown>>(
    `SELECT * FROM sandbox_methodologies
     WHERE id = $1 AND entity_id = $2
     LIMIT 1`,
    [sandboxId, entityId],
  );
  if (!sandbox) return null;

  const diffs = asJsonArray(sandbox.diffs);
  const deltaBps = diffs.reduce<number>((sum, diff) => sum + diffDeltaBps(diff), 0);
  const baseSnapshotId = String(sandbox.base_snapshot_id ?? '');
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM target_grid_cells
     WHERE snapshot_id = $1 AND entity_id = $2
     ORDER BY product, segment, tenor_bucket, currency`,
    [baseSnapshotId, entityId],
  );

  const deltaPct = deltaBps / 100;
  const cellImpacts = rows.map((row) => {
    const currentCell = gridCellToDto(row);
    const proposedCell = {
      ...currentCell,
      ftp: currentCell.ftp + deltaPct,
      targetClientRate: currentCell.targetClientRate + deltaPct,
      targetRaroc: currentCell.targetRaroc - deltaPct,
    };
    return {
      product: currentCell.product,
      segment: currentCell.segment,
      tenorBucket: currentCell.tenorBucket,
      currency: currentCell.currency,
      currentCell,
      proposedCell,
      ftpDeltaBps: deltaBps,
      rarocDeltaPp: -deltaPct,
      clientRateDeltaBps: deltaBps,
      estimatedVolumeDelta: Math.abs(deltaBps) > 25 ? -Math.abs(deltaBps) / 100 : 0,
    };
  });

  const totals = rows.reduce<ImpactTotals>((acc, row) => {
    const amount = amountFromCell(row);
    const currentRate = asNumber(row.target_client_rate);
    const projectedRate = currentRate + deltaPct;
    const currentRaroc = asNumber(row.target_raroc);
    acc.currentNii += amount * (currentRate / 100);
    acc.projectedNii += amount * (projectedRate / 100);
    acc.currentRaroc += currentRaroc;
    acc.projectedRaroc += currentRaroc - deltaPct;
    acc.volume += amount;
    if (Math.abs(deltaBps) > 25) acc.volumeAtRisk += amount;
    return acc;
  }, {
    currentNii: 0,
    projectedNii: 0,
    currentRaroc: 0,
    projectedRaroc: 0,
    volume: 0,
    volumeAtRisk: 0,
  });

  const count = Math.max(rows.length, 1);
  const niiDelta = totals.projectedNii - totals.currentNii;
  const report = {
    sandboxId,
    baseSnapshotId,
    computedAt: new Date().toISOString(),
    summary: {
      totalCellsAffected: Math.abs(deltaBps) > 0 ? rows.length : 0,
      avgFtpChangeBps: deltaBps,
      avgRarocChangePp: -deltaPct,
      estimatedNiiDelta: niiDelta,
      estimatedNiiDeltaPct: totals.currentNii === 0 ? 0 : (niiDelta / totals.currentNii) * 100,
      volumeAtRisk: totals.volumeAtRisk,
      volumeAtRiskPct: totals.volume === 0 ? 0 : (totals.volumeAtRisk / totals.volume) * 100,
    },
    cellImpacts,
    portfolioImpact: {
      currentNii: totals.currentNii,
      projectedNii: totals.projectedNii,
      niiDelta,
      currentAvgRaroc: totals.currentRaroc / count,
      projectedAvgRaroc: totals.projectedRaroc / count,
      rarocDelta: -deltaPct,
      dealCount: rows.length,
      affectedDealCount: Math.abs(deltaBps) > 0 ? rows.length : 0,
    },
  };

  if (markReady) {
    await execute(
      `UPDATE sandbox_methodologies
       SET status = 'ready', updated_at = now()
       WHERE id = $1 AND entity_id = $2`,
      [sandboxId, entityId],
    );
  }

  return report;
}

function backtestToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description == null ? undefined : String(row.description),
    sandboxId: row.sandbox_id == null ? undefined : String(row.sandbox_id),
    snapshotId: String(row.snapshot_id ?? ''),
    dateFrom: dateOnly(row.date_from),
    dateTo: dateOnly(row.date_to),
    status: String(row.status ?? 'pending'),
    dealCount: asNumber(row.deal_count),
    filters: row.filters == null ? undefined : asJsonObject(row.filters),
    startedAt: isoDate(row.started_at),
    completedAt: row.completed_at == null ? undefined : isoDate(row.completed_at),
    durationMs: row.duration_ms == null ? undefined : asNumber(row.duration_ms),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    createdByEmail: String(row.created_by_email ?? ''),
  };
}

function emptyBacktestResult(runId: string) {
  return {
    runId,
    simulatedPnl: 0,
    actualPnl: 0,
    pnlDelta: 0,
    pnlDeltaPct: 0,
    simulatedAvgRaroc: 0,
    actualAvgRaroc: 0,
    rarocDeltaPp: 0,
    periodBreakdown: [],
    cohortBreakdown: [],
  };
}

function benchmarkToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    productType: String(row.product_type ?? ''),
    tenorBucket: String(row.tenor_bucket ?? ''),
    clientType: String(row.client_type ?? ''),
    currency: String(row.currency ?? ''),
    rate: asNumber(row.rate),
    source: String(row.source ?? ''),
    asOfDate: dateOnly(row.as_of_date),
    notes: row.notes == null ? undefined : String(row.notes),
  };
}

function budgetToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    currency: String(row.currency ?? ''),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    period: String(row.period ?? ''),
    targetNii: asNumber(row.target_nii),
    targetVolume: asNumber(row.target_volume),
    targetRaroc: asNumber(row.target_raroc),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function elasticityToDto(row: Record<string, unknown>) {
  const [product = '', segment = ''] = String(row.segment_key ?? '').split('|');
  const method = String(row.method ?? '');
  return {
    id: String(row.id),
    product,
    segment,
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    slope: -Math.abs(asNumber(row.elasticity)),
    intercept: asNumber(row.baseline_conversion),
    rSquared: null,
    source: method === 'FREQUENTIST' ? 'empirical' : 'hybrid',
    sampleSize: asNumber(row.sample_size),
    calibratedAt: isoDate(row.calibrated_at),
    calibratedByEmail: 'system@n-pricing.local',
    validFrom: isoDate(row.calibrated_at),
    notes: `confidence=${String(row.confidence ?? 'LOW')}; method=${method || 'BAYESIAN'}`,
  };
}

// ---------------------------------------------------------------------------
// Sandboxes
// ---------------------------------------------------------------------------

router.get('/sandboxes', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM sandbox_methodologies
       WHERE entity_id = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(sandboxToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const row = await queryOne<Record<string, unknown>>(
      `SELECT * FROM sandbox_methodologies
       WHERE id = $1 AND entity_id = $2
       LIMIT 1`,
      [req.params.id, tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(sandboxToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    if (!name) {
      res.status(400).json({ code: 'invalid_payload', message: 'name required' });
      return;
    }
    const baseSnapshotId = await resolveSnapshotId(tenancy.entityId, body.baseSnapshotId);
    if (!baseSnapshotId) {
      res.status(400).json({ code: 'base_snapshot_required', message: 'No methodology snapshot exists for this entity' });
      return;
    }
    const status = SANDBOX_STATUSES.has(String(body.status)) ? String(body.status) : 'draft';
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO sandbox_methodologies
         (id, name, description, base_snapshot_id, status, diffs,
          created_by_email, created_by_name, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
       RETURNING *`,
      [
        asString(body.id, randomUUID()),
        name,
        body.description ?? null,
        baseSnapshotId,
        status,
        JSON.stringify(Array.isArray(body.diffs) ? body.diffs : []),
        asString(body.createdByEmail, userEmail(req)),
        asString(body.createdByName, userName(req)),
        tenancy.entityId,
      ],
    );
    res.status(201).json(row ? sandboxToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };

    if (body.name !== undefined) add('name', asString(body.name));
    if (body.description !== undefined) add('description', body.description ?? null);
    if (body.status !== undefined && SANDBOX_STATUSES.has(String(body.status))) add('status', String(body.status));
    if (body.diffs !== undefined) add('diffs', JSON.stringify(Array.isArray(body.diffs) ? body.diffs : []), '::jsonb');

    if (sets.length === 0) {
      const current = await queryOne<Record<string, unknown>>(
        `SELECT * FROM sandbox_methodologies WHERE id = $1 AND entity_id = $2 LIMIT 1`,
        [req.params.id, tenancy.entityId],
      );
      if (!current) {
        res.status(404).json({ code: 'not_found' });
        return;
      }
      res.json(sandboxToDto(current));
      return;
    }

    params.push(req.params.id, tenancy.entityId);
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE sandbox_methodologies
       SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND entity_id = $${params.length}
       RETURNING *`,
      params,
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(sandboxToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const rows = await query<{ id: string }>(
      `DELETE FROM sandbox_methodologies
       WHERE id = $1 AND entity_id = $2
       RETURNING id`,
      [req.params.id, tenancy.entityId],
    );
    if (rows.length === 0) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes/:id/impact', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const report = await computeImpactReport(req.params.id, tenancy.entityId, true);
    if (!report) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/sandboxes/:id/impact', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const report = await computeImpactReport(req.params.id, tenancy.entityId, false);
    if (!report) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes/:id/publish', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const row = await queryOne<{ id: string }>(
      `UPDATE sandbox_methodologies
       SET status = 'published', updated_at = now()
       WHERE id = $1 AND entity_id = $2
       RETURNING id`,
      [req.params.id, tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json({ governance_request_id: `GOV-${req.params.id.slice(0, 8).toUpperCase()}` });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Elasticity
// ---------------------------------------------------------------------------

router.get('/elasticity', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM elasticity_models
       WHERE is_active = true AND (entity_id IS NULL OR entity_id = $1)
       ORDER BY calibrated_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(elasticityToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/elasticity', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    if (!product || !segment) {
      res.status(400).json({ code: 'invalid_payload', message: 'product and segment required' });
      return;
    }
    const segmentKey = `${product}|${segment}|ALL|ALL`;
    const source = asString(body.source, 'expert');
    const method = source === 'empirical' ? 'FREQUENTIST' : 'BAYESIAN';
    const sampleSize = Math.max(0, asNumber(body.sampleSize, 0));
    const confidence = sampleSize >= 100 ? 'HIGH' : sampleSize >= 30 ? 'MEDIUM' : 'LOW';
    const row = await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE elasticity_models
         SET is_active = false
         WHERE segment_key = $1 AND COALESCE(entity_id, '') = $2`,
        [segmentKey, tenancy.entityId],
      );
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO elasticity_models
           (id, segment_key, elasticity, baseline_conversion, anchor_rate,
            sample_size, confidence, method, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          asString(body.id, randomUUID()),
          segmentKey,
          Math.abs(asNumber(body.slope, -0.05)),
          asNumber(body.intercept, 0),
          0,
          sampleSize,
          confidence,
          method,
          tenancy.entityId,
        ],
      );
    });
    res.status(201).json(row ? elasticityToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/elasticity/calibrate', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    if (!product || !segment) {
      res.status(400).json({ code: 'invalid_payload', message: 'product and segment required' });
      return;
    }
    const segmentKey = `${product}|${segment}|ALL|ALL`;
    const row = await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE elasticity_models
         SET is_active = false
         WHERE segment_key = $1 AND COALESCE(entity_id, '') = $2`,
        [segmentKey, tenancy.entityId],
      );
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO elasticity_models
           (id, segment_key, elasticity, baseline_conversion, anchor_rate,
            sample_size, confidence, method, entity_id)
         VALUES ($1, $2, $3, 0, 0, 0, 'LOW', 'BAYESIAN', $4)
         RETURNING *`,
        [randomUUID(), segmentKey, 0.05, tenancy.entityId],
      );
    });
    res.status(201).json(row ? elasticityToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/elasticity/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const rows = await query<{ id: string }>(
      `UPDATE elasticity_models
       SET is_active = false
       WHERE id = $1 AND (entity_id IS NULL OR entity_id = $2)
       RETURNING id`,
      [req.params.id, tenancy.entityId],
    );
    if (rows.length === 0) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Backtests
// ---------------------------------------------------------------------------

router.get('/backtests', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM backtesting_runs
       WHERE entity_id = $1
       ORDER BY started_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(backtestToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/backtests', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    if (!name) {
      res.status(400).json({ code: 'invalid_payload', message: 'name required' });
      return;
    }
    const snapshotId = await resolveSnapshotId(tenancy.entityId, body.snapshotId);
    if (!snapshotId) {
      res.status(400).json({ code: 'snapshot_required', message: 'snapshotId required' });
      return;
    }
    const id = asString(body.id, randomUUID());
    const result = emptyBacktestResult(id);
    const status = BACKTEST_STATUSES.has(String(body.status)) ? String(body.status) : 'completed';
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO backtesting_runs
         (id, name, description, sandbox_id, snapshot_id, date_from, date_to,
          status, deal_count, filters, completed_at, duration_ms, entity_id,
          created_by_email, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9::jsonb, now(), 0, $10, $11, $12::jsonb)
       RETURNING *`,
      [
        id,
        name,
        body.description ?? null,
        body.sandboxId ?? null,
        snapshotId,
        asString(body.dateFrom, new Date().toISOString().slice(0, 10)),
        asString(body.dateTo, new Date().toISOString().slice(0, 10)),
        status,
        JSON.stringify(body.filters ?? {}),
        tenancy.entityId,
        asString(body.createdByEmail, userEmail(req)),
        JSON.stringify(result),
      ],
    );
    res.status(201).json(row ? backtestToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/backtests/:runId/result', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const row = await queryOne<Record<string, unknown>>(
      `SELECT result FROM backtesting_runs
       WHERE id = $1 AND entity_id = $2
       LIMIT 1`,
      [req.params.runId, tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(asJsonObject(row.result).runId ? asJsonObject(row.result) : emptyBacktestResult(req.params.runId));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

router.get('/benchmarks', async (req, res) => {
  try {
    const products = listParam(req.query.products);
    const currencies = listParam(req.query.currencies);
    const filters: string[] = [];
    const params: unknown[] = [];
    addAnyFilter(filters, params, 'product_type', products);
    addAnyFilter(filters, params, 'currency', currencies);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM market_benchmarks ${where}
       ORDER BY as_of_date DESC, product_type ASC
       LIMIT 500`,
      params,
    );
    res.json(rows.map(benchmarkToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/benchmarks', async (req, res) => {
  try {
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const productType = asString(body.productType);
    const tenorBucket = asString(body.tenorBucket);
    const clientType = asString(body.clientType);
    const currency = asString(body.currency);
    const source = asString(body.source);
    const rate = asNumber(body.rate, Number.NaN);
    if (!productType || !tenorBucket || !clientType || !currency || !source || !Number.isFinite(rate)) {
      res.status(400).json({ code: 'invalid_payload' });
      return;
    }
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO market_benchmarks
         (id, product_type, tenor_bucket, client_type, currency, rate, source, as_of_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (product_type, tenor_bucket, client_type, currency, as_of_date)
       DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes
       RETURNING *`,
      [
        asString(body.id, randomUUID()),
        productType,
        tenorBucket,
        clientType,
        currency,
        rate,
        source,
        asString(body.asOfDate, new Date().toISOString().slice(0, 10)),
        body.notes ?? null,
      ],
    );
    res.status(201).json(row ? benchmarkToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/benchmarks/compare', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const snapshotId = asString(req.query.snapshot_id);
    if (!snapshotId) {
      res.status(400).json({ code: 'invalid_params', message: 'snapshot_id required' });
      return;
    }
    const cells = await query<Record<string, unknown>>(
      `SELECT * FROM target_grid_cells
       WHERE snapshot_id = $1 AND entity_id = $2
       ORDER BY product, segment, tenor_bucket, currency`,
      [snapshotId, tenancy.entityId],
    );
    const benchmarks = await query<Record<string, unknown>>(
      `SELECT * FROM market_benchmarks
       ORDER BY as_of_date DESC`,
    );
    const comparisons = cells.flatMap((cell) => {
      const targetTenor = TENOR_TO_BENCHMARK[String(cell.tenor_bucket ?? '')] ?? 'MT';
      const match = benchmarks.find((benchmark) => (
        String(benchmark.product_type) === String(cell.product) &&
        String(benchmark.tenor_bucket) === targetTenor &&
        String(benchmark.client_type) === String(cell.segment) &&
        String(benchmark.currency) === String(cell.currency)
      ));
      if (!match) return [];
      const targetRate = asNumber(cell.target_client_rate);
      const benchmarkRate = asNumber(match.rate);
      return [{
        product: String(cell.product),
        segment: String(cell.segment),
        tenorBucket: String(cell.tenor_bucket),
        currency: String(cell.currency),
        targetRate,
        benchmarkRate,
        deltaBps: (targetRate - benchmarkRate) * 100,
        source: String(match.source ?? ''),
        asOfDate: dateOnly(match.as_of_date),
      }];
    });
    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Budget targets
// ---------------------------------------------------------------------------

router.get('/budget', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM budget_targets
       WHERE entity_id = $1
       ORDER BY period DESC, product, segment, currency
       LIMIT 500`,
      [tenancy.entityId],
    );
    res.json(rows.map(budgetToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/budget', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    const currency = asString(body.currency);
    const period = asString(body.period);
    if (!product || !segment || !currency || !period) {
      res.status(400).json({ code: 'invalid_payload' });
      return;
    }
    const row = await withTransaction(async (tx) => {
      const updated = await tx.queryOne<Record<string, unknown>>(
        `UPDATE budget_targets
         SET target_nii = $1, target_volume = $2, target_raroc = $3, updated_at = now()
         WHERE product = $4 AND segment = $5 AND currency = $6 AND entity_id = $7 AND period = $8
         RETURNING *`,
        [
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
        ],
      );
      if (updated) return updated;
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO budget_targets
           (id, product, segment, currency, entity_id, period,
            target_nii, target_volume, target_raroc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          asString(body.id, randomUUID()),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
        ],
      );
    });
    res.status(201).json(row ? budgetToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/budget/consistency', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const snapshotId = asString(req.query.snapshot_id);
    if (!snapshotId) {
      res.status(400).json({ code: 'invalid_params', message: 'snapshot_id required' });
      return;
    }
    const [budgets, cells] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT * FROM budget_targets WHERE entity_id = $1 ORDER BY product, segment, currency`,
        [tenancy.entityId],
      ),
      query<Record<string, unknown>>(
        `SELECT * FROM target_grid_cells WHERE snapshot_id = $1 AND entity_id = $2`,
        [snapshotId, tenancy.entityId],
      ),
    ]);
    const comparisons = budgets.map((budget) => {
      const match = cells.find((cell) => (
        String(cell.product) === String(budget.product) &&
        String(cell.segment) === String(budget.segment) &&
        String(cell.currency) === String(budget.currency)
      ));
      const budgetNii = asNumber(budget.target_nii);
      const budgetVolume = asNumber(budget.target_volume);
      const gridRate = match ? asNumber(match.target_client_rate) : 0;
      const gridImpliedNii = budgetVolume * (gridRate / 100);
      const niiGap = gridImpliedNii - budgetNii;
      return {
        product: String(budget.product),
        segment: String(budget.segment),
        currency: String(budget.currency),
        budgetNii,
        gridImpliedNii,
        niiGap,
        niiGapPct: budgetNii === 0 ? 0 : (niiGap / budgetNii) * 100,
        budgetVolume,
        gridImpliedVolume: budgetVolume,
        volumeGap: 0,
        volumeGapPct: 0,
      };
    });
    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
