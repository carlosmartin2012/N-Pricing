import { Router } from 'express';
import { query, queryOne, execute } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { entity_id } = req.query;
    if (entity_id) {
      res.json(await query('SELECT * FROM report_schedules WHERE entity_id=$1 ORDER BY created_at DESC', [entity_id]));
    } else {
      res.json(await query('SELECT * FROM report_schedules ORDER BY created_at DESC'));
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const s = req.body;
    const id = s.id || crypto.randomUUID();
    const row = await queryOne(
      `INSERT INTO report_schedules (id,entity_id,name,report_type,frequency,format,recipients,config,is_active,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET entity_id=EXCLUDED.entity_id,name=EXCLUDED.name,report_type=EXCLUDED.report_type,frequency=EXCLUDED.frequency,format=EXCLUDED.format,recipients=EXCLUDED.recipients,config=EXCLUDED.config,is_active=EXCLUDED.is_active
       RETURNING *`,
      [id, s.entity_id, s.name, s.report_type, s.frequency, s.format, JSON.stringify(s.recipients ?? []), JSON.stringify(s.config ?? {}), s.is_active ?? true, s.created_by],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await execute('DELETE FROM report_schedules WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    await execute('UPDATE report_schedules SET is_active=$1 WHERE id=$2', [req.body.is_active, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/runs', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM report_runs WHERE schedule_id=$1 ORDER BY started_at DESC LIMIT 20', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
