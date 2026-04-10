import { Router } from 'express';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

// --- Groups ---
router.get('/groups', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM groups ORDER BY name LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/groups/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM groups WHERE id=$1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const g = req.body;
    const id = g.id || crypto.randomUUID();
    const row = await queryOne(
      'INSERT INTO groups (id,name,short_code,country,base_currency,config,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,short_code=EXCLUDED.short_code,country=EXCLUDED.country,base_currency=EXCLUDED.base_currency,config=EXCLUDED.config,is_active=EXCLUDED.is_active RETURNING *',
      [id, g.name, g.short_code, g.country, g.base_currency, g.config ? JSON.stringify(g.config) : '{}', g.is_active ?? true],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Entities ---
router.get('/entities', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM entities ORDER BY name LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/entities/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM entities WHERE id=$1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/entities', async (req, res) => {
  try {
    const e = req.body;
    const id = e.id || crypto.randomUUID();
    const row = await queryOne(
      `INSERT INTO entities (id,group_id,name,legal_name,short_code,country,base_currency,timezone,approval_matrix,sdr_config,lr_config,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id,name=EXCLUDED.name,legal_name=EXCLUDED.legal_name,short_code=EXCLUDED.short_code,country=EXCLUDED.country,base_currency=EXCLUDED.base_currency,timezone=EXCLUDED.timezone,approval_matrix=EXCLUDED.approval_matrix,sdr_config=EXCLUDED.sdr_config,lr_config=EXCLUDED.lr_config,is_active=EXCLUDED.is_active
       RETURNING *`,
      [id, e.group_id, e.name, e.legal_name ?? '', e.short_code, e.country, e.base_currency, e.timezone ?? 'Europe/Madrid', e.approval_matrix ? JSON.stringify(e.approval_matrix) : '{}', e.sdr_config ? JSON.stringify(e.sdr_config) : '{}', e.lr_config ? JSON.stringify(e.lr_config) : '{}', e.is_active ?? true],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Entity Users ---
router.get('/entity-users', async (req, res) => {
  try {
    const { entity_id, user_id, email } = req.query;
    if (email) {
      // Look up entity-users by user email (join with users table)
      res.json(await query(
        'SELECT eu.* FROM entity_users eu JOIN users u ON u.id=eu.user_id WHERE u.email=$1',
        [email],
      ));
    } else if (entity_id) {
      res.json(await query('SELECT * FROM entity_users WHERE entity_id=$1', [entity_id]));
    } else if (user_id) {
      res.json(await query('SELECT * FROM entity_users WHERE user_id=$1', [user_id]));
    } else {
      res.json(await query('SELECT * FROM entity_users LIMIT 1000'));
    }
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/entity-users', async (req, res) => {
  try {
    const { entity_id, user_id, role, is_primary_entity } = req.body;
    await execute(
      'INSERT INTO entity_users (entity_id,user_id,role,is_primary_entity) VALUES ($1,$2,$3,$4) ON CONFLICT (entity_id,user_id) DO UPDATE SET role=EXCLUDED.role,is_primary_entity=EXCLUDED.is_primary_entity',
      [entity_id, user_id, role, is_primary_entity ?? false],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
