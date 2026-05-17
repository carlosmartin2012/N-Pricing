import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

function requireTenant(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): string | null {
  const entityId = req.tenancy?.entityId;
  if (!entityId) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return entityId;
}

// --- Behavioural Models ---
router.get('/models', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    res.json(await query(
      'SELECT * FROM behavioural_models WHERE entity_id = $1 ORDER BY updated_at DESC LIMIT 1000',
      [entityId],
    ));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/models', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    const m = req.body;
    const id = m.id || randomUUID();
    const row = await queryOne(
      `INSERT INTO behavioural_models (id,entity_id,name,type,nmd_method,description,core_ratio,decay_rate,beta_factor,replication_profile,cpr,penalty_exempt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,nmd_method=EXCLUDED.nmd_method,description=EXCLUDED.description,core_ratio=EXCLUDED.core_ratio,decay_rate=EXCLUDED.decay_rate,beta_factor=EXCLUDED.beta_factor,replication_profile=EXCLUDED.replication_profile,cpr=EXCLUDED.cpr,penalty_exempt=EXCLUDED.penalty_exempt,updated_at=NOW()
       WHERE behavioural_models.entity_id = EXCLUDED.entity_id
       RETURNING *`,
      [id, entityId, m.name, m.type, m.nmd_method, m.description, m.core_ratio, m.decay_rate, m.beta_factor, m.replication_profile ? JSON.stringify(m.replication_profile) : null, m.cpr, m.penalty_exempt],
    );
    if (!row) {
      res.status(409).json({ code: 'cross_tenant_conflict', message: 'Model id belongs to another entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/models/:id', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    await execute('DELETE FROM behavioural_models WHERE id=$1 AND entity_id=$2', [req.params.id, entityId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Yield Curves ---
router.get('/yield-curves', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    res.json(await query(
      'SELECT * FROM yield_curves WHERE entity_id = $1 ORDER BY as_of_date DESC, id DESC LIMIT 1000',
      [entityId],
    ));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/yield-curves', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    const { currency, as_of_date, grid_data } = req.body;
    await execute(
      'INSERT INTO yield_curves (entity_id,currency,as_of_date,grid_data) VALUES ($1,$2,$3,$4)',
      [entityId, currency, as_of_date, JSON.stringify(grid_data)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Yield Curve History ---
async function listYieldCurveHistory(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    const curveId = String(req.query.curve_id ?? req.query.curveId ?? '');
    const { months = 12 } = req.query;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(String(months)));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const rows = await query(
      'SELECT id, curve_id, currency, snapshot_date AS as_of_date, points AS grid_data FROM yield_curve_history WHERE entity_id=$1 AND curve_id=$2 AND snapshot_date >= $3 ORDER BY snapshot_date DESC',
      [entityId, curveId, cutoffStr],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
}

router.get('/yield-curve-history', listYieldCurveHistory);
router.get('/yield-curves/history', listYieldCurveHistory);

router.post('/yield-curve-history', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    const { curve_id, currency, snapshot_date, points } = req.body;
    await execute(
      'INSERT INTO yield_curve_history (entity_id,curve_id,currency,snapshot_date,points) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (entity_id,curve_id,snapshot_date) DO UPDATE SET points=EXCLUDED.points',
      [entityId, curve_id, currency, snapshot_date, JSON.stringify(points)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Liquidity Curves ---
router.get('/liquidity-curves', async (req, res) => {
  try {
    const entityId = requireTenant(req, res);
    if (!entityId) return;
    res.json(await query(
      'SELECT * FROM liquidity_curves WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1000',
      [entityId],
    ));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
