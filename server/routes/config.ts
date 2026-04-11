import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();
const nowIso = () => new Date().toISOString();


// --- Rules ---
router.get('/rules', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM rules LIMIT 500'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const r = req.body;
    if (r.id) {
      const row = await queryOne(
        'UPDATE rules SET business_unit=$2,product=$3,segment=$4,tenor=$5,base_method=$6,base_reference=$7,spread_method=$8,liquidity_reference=$9,strategic_spread=$10 WHERE id=$1 RETURNING *',
        [r.id, r.business_unit, r.product, r.segment, r.tenor, r.base_method, r.base_reference, r.spread_method, r.liquidity_reference, r.strategic_spread],
      );
      return res.json(row);
    }
    const row = await queryOne(
      'INSERT INTO rules (business_unit,product,segment,tenor,base_method,base_reference,spread_method,liquidity_reference,strategic_spread) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [r.business_unit, r.product, r.segment, r.tenor, r.base_method, r.base_reference, r.spread_method, r.liquidity_reference, r.strategic_spread],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    await execute('DELETE FROM rules WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/rules/:id/versions', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM rule_versions WHERE rule_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rules/:id/versions', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const r = req.body;
    const existing = await query<{ version: number }>('SELECT version FROM rule_versions WHERE rule_id = $1 ORDER BY version DESC LIMIT 1', [ruleId]);
    const currentMax = existing[0]?.version ?? 0;
    const newVersion = currentMax + 1;
    const today = new Date().toISOString().split('T')[0];
    if (currentMax > 0) {
      await execute('UPDATE rule_versions SET effective_to=$1 WHERE rule_id=$2 AND version=$3', [today, ruleId, currentMax]);
    }
    await execute(
      'INSERT INTO rule_versions (rule_id,version,business_unit,product,segment,tenor,base_method,base_reference,spread_method,liquidity_reference,strategic_spread,formula_spec,effective_from,effective_to,changed_by,change_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,$15)',
      [ruleId, newVersion, r.businessUnit, r.product, r.segment, r.tenor, r.baseMethod, r.baseReference, r.spreadMethod, r.liquidityReference, r.strategicSpread ?? 0, r.formulaSpec ? JSON.stringify(r.formulaSpec) : null, today, r.changedBy, r.changeReason],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Clients ---
router.get('/clients', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM clients LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const c = req.body;
    const id = c.id || randomUUID();
    const row = await queryOne(
      'INSERT INTO clients (id,name,type,segment,rating,country,lei_code) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,segment=EXCLUDED.segment,rating=EXCLUDED.rating,country=EXCLUDED.country,lei_code=EXCLUDED.lei_code RETURNING *',
      [id, c.name, c.type, c.segment, c.rating ?? 'BBB', c.country ?? 'ES', c.lei_code],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    await execute('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Products ---
router.get('/products', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM products LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/products', async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || randomUUID();
    const row = await queryOne(
      'INSERT INTO products (id,name,category,default_amortization,default_repricing,description,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,default_amortization=EXCLUDED.default_amortization,default_repricing=EXCLUDED.default_repricing,description=EXCLUDED.description,is_active=EXCLUDED.is_active RETURNING *',
      [id, p.name, p.category, p.default_amortization ?? 'Bullet', p.default_repricing ?? 'Fixed', p.description, p.is_active ?? true],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await execute('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Business Units ---
router.get('/business-units', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM business_units LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/business-units', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || randomUUID();
    const row = await queryOne(
      'INSERT INTO business_units (id,name,code,parent_id,is_funding_unit) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,code=EXCLUDED.code,parent_id=EXCLUDED.parent_id,is_funding_unit=EXCLUDED.is_funding_unit RETURNING *',
      [id, b.name, b.code, b.parent_id ?? null, b.is_funding_unit ?? false],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/business-units/:id', async (req, res) => {
  try {
    await execute('DELETE FROM business_units WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Users ---
router.get('/users', async (_req, res) => {
  try {
    res.json(await query('SELECT * FROM users LIMIT 1000'));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/users', async (req, res) => {
  try {
    const u = req.body;
    const id = u.id || `USR-${randomUUID().slice(0, 8)}`;
    const row = await queryOne(
      'INSERT INTO users (id,name,email,role,status,last_login,department) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,status=EXCLUDED.status,last_login=EXCLUDED.last_login,department=EXCLUDED.department RETURNING *',
      [id, u.name, u.email, u.role, u.status, u.last_login ?? u.lastLogin, u.department],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await execute('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Notifications ---
router.get('/notifications', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM notifications WHERE recipient_email=$1 ORDER BY created_at DESC LIMIT 50', [req.query.email]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/notifications/unread-count', async (req, res) => {
  try {
    const rows = await query<{ count: string }>('SELECT COUNT(*)::int as count FROM notifications WHERE recipient_email=$1 AND is_read=false', [req.query.email]);
    res.json({ count: parseInt(rows[0]?.count ?? '0') });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { recipient, sender, type, title, message, dealId } = req.body;
    await execute('INSERT INTO notifications (recipient_email,sender_email,type,title,message,deal_id) VALUES ($1,$2,$3,$4,$5,$6)', [recipient, sender, type, title, message, dealId ?? null]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    await execute('UPDATE notifications SET is_read = true WHERE recipient_email = $1 AND is_read = false', [email]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await execute('UPDATE notifications SET is_read=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- System Config ---
router.get('/system-config/:key', async (req, res) => {
  try {
    const row = await queryOne<{ value: unknown }>('SELECT value FROM system_config WHERE key=$1', [req.params.key]);
    res.json({ value: row?.value ?? null });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/system-config/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await execute(
      'INSERT INTO system_config (key,value,updated_at) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at',
      [req.params.key, JSON.stringify(value), nowIso()],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Seed ---
router.post('/seed', async (req, res) => {
  try {
    // Only `clients` and `users` are currently seeded. The other entities
    // (products, business_units, models, deals, rules, yield_curve) are
    // accepted in the payload but not yet persisted by this endpoint.
    const { clients, users } = req.body;
    const errors: string[] = [];
    if (clients?.length) {
      for (const c of clients) {
        try {
          await execute('INSERT INTO clients (id,name,type,segment,rating) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', [c.id, c.name, c.type, c.segment, c.rating ?? 'BBB']);
        } catch { errors.push('client:' + c.id); }
      }
    }
    if (users?.length) {
      for (const u of users) {
        try {
          await execute('INSERT INTO users (id,name,email,role,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', [u.id, u.name, u.email, u.role, u.status]);
        } catch { errors.push('user:' + u.email); }
      }
    }
    res.json({ success: errors.length === 0, errors });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
