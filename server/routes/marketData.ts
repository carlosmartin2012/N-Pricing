import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

// --- Behavioural Models ---
router.get('/models', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM behavioural_models LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/models', async (req, res) => {
  try {
    const m = req.body;
    const id = m.id || randomUUID();
    const row = await queryOne(
      `INSERT INTO behavioural_models (id,name,type,nmd_method,description,core_ratio,decay_rate,beta_factor,replication_profile,cpr,penalty_exempt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,nmd_method=EXCLUDED.nmd_method,description=EXCLUDED.description,core_ratio=EXCLUDED.core_ratio,decay_rate=EXCLUDED.decay_rate,beta_factor=EXCLUDED.beta_factor,replication_profile=EXCLUDED.replication_profile,cpr=EXCLUDED.cpr,penalty_exempt=EXCLUDED.penalty_exempt
       RETURNING *`,
      [id, m.name, m.type, m.nmd_method, m.description, m.core_ratio, m.decay_rate, m.beta_factor, m.replication_profile ? JSON.stringify(m.replication_profile) : null, m.cpr, m.penalty_exempt],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/models/:id', async (req, res) => {
  try {
    await execute('DELETE FROM behavioural_models WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Yield Curves ---
router.get('/yield-curves', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM yield_curves ORDER BY as_of_date DESC LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/yield-curves', async (req, res) => {
  try {
    const { currency, as_of_date, grid_data } = req.body;
    await execute(
      'INSERT INTO yield_curves (currency,as_of_date,grid_data) VALUES ($1,$2,$3)',
      [currency, as_of_date, JSON.stringify(grid_data)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Yield Curve History ---
router.get('/yield-curve-history', async (req, res) => {
  try {
    const { curve_id, months = 12 } = req.query;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(String(months)));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const rows = await query(
      'SELECT snapshot_date, points FROM yield_curve_history WHERE curve_id=$1 AND snapshot_date >= $2 ORDER BY snapshot_date DESC',
      [curve_id, cutoffStr],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/yield-curve-history', async (req, res) => {
  try {
    const { curve_id, currency, snapshot_date, points } = req.body;
    await execute(
      'INSERT INTO yield_curve_history (curve_id,currency,snapshot_date,points) VALUES ($1,$2,$3,$4) ON CONFLICT (curve_id,snapshot_date) DO UPDATE SET points=EXCLUDED.points',
      [curve_id, currency, snapshot_date, JSON.stringify(points)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Liquidity Curves ---
router.get('/liquidity-curves', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM liquidity_curves ORDER BY created_at DESC LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
