import { Router } from 'express';
import { query, execute } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/paginated', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'));
    const pageSize = parseInt(String(req.query.pageSize ?? '100'));
    const offset = (page - 1) * pageSize;
    const [rows, countRows] = await Promise.all([
      query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1 OFFSET $2', [pageSize, offset]),
      query<{ count: string }>('SELECT COUNT(*)::int as count FROM audit_log'),
    ]);
    res.json({ data: rows, total: parseInt(countRows[0]?.count ?? '0') });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_email, user_name, action, module, description, details, timestamp } = req.body;
    await execute(
      'INSERT INTO audit_log (timestamp, user_email, user_name, action, module, description, details) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [timestamp || new Date().toISOString(), user_email, user_name, action, module, description, details ? JSON.stringify(details) : null],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[audit] POST / error', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
