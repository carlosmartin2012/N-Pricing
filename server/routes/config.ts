import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';
import { tenancyScope, entityScopedClause } from '../middleware/requireTenancy';

const router = Router();
const nowIso = () => new Date().toISOString();

// Every entity-scoped CRUD path below follows the same pattern:
//   - READ  → WHERE entity_id filter (no-op in legacy mode via entityScopedClause)
//   - WRITE → pass tenancy.entityId as the row's entity_id. If the middleware
//             is not mounted (legacy mode), fall back to the Default Entity
//             default so pre-tenancy callers keep working unchanged.
//   - DELETE → extra AND entity_id = ... clause so a client cannot erase
//              another tenant's record by guessing an id.
//
// `notifications` is intentionally not entity-scoped here: the migration
// series never added entity_id to it; isolation happens by recipient_email.
// `system_config` is a singleton key/value store (e.g. global shock
// defaults) and stays global. Both are revisited in the review doc.

// --- Rules ---
router.get('/rules', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    const rows = await query(
      `SELECT * FROM rules ${scope.where} LIMIT 500`,
      scope.params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rules', async (req, res) => {
  try {
    const r = req.body;
    const scope = tenancyScope(req);
    if (r.id) {
      const row = await queryOne(
        `UPDATE rules SET business_unit=$2, product=$3, segment=$4, tenor=$5,
           base_method=$6, base_reference=$7, spread_method=$8,
           liquidity_reference=$9, strategic_spread=$10
         WHERE id=$1 ${scope.entityId ? 'AND entity_id=$11' : ''}
         RETURNING *`,
        scope.entityId
          ? [r.id, r.business_unit, r.product, r.segment, r.tenor, r.base_method, r.base_reference, r.spread_method, r.liquidity_reference, r.strategic_spread, scope.entityId]
          : [r.id, r.business_unit, r.product, r.segment, r.tenor, r.base_method, r.base_reference, r.spread_method, r.liquidity_reference, r.strategic_spread],
      );
      if (!row) {
        res.status(404).json({ code: 'not_found', message: 'Rule not found in this entity' });
        return;
      }
      return res.json(row);
    }
    const row = await queryOne(
      `INSERT INTO rules (business_unit, product, segment, tenor, base_method,
         base_reference, spread_method, liquidity_reference, strategic_spread, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
         COALESCE($10::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
       RETURNING *`,
      [r.business_unit, r.product, r.segment, r.tenor, r.base_method, r.base_reference, r.spread_method, r.liquidity_reference, r.strategic_spread, scope.entityId],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM rules WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM rules WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Rule versions inherit tenancy from the parent rule. The JOIN keeps the
// isolation even though rule_versions itself has no entity_id column.
router.get('/rules/:id/versions', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    const rows = scope.entityId
      ? await query(
          `SELECT rv.* FROM rule_versions rv
             JOIN rules r ON r.id = rv.rule_id
           WHERE rv.rule_id = $1 AND r.entity_id = $2
           ORDER BY rv.version DESC`,
          [req.params.id, scope.entityId],
        )
      : await query(
          'SELECT * FROM rule_versions WHERE rule_id = $1 ORDER BY version DESC',
          [req.params.id],
        );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/rules/:id/versions', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const r = req.body ?? {};
    const today = new Date().toISOString().split('T')[0];
    const scope = tenancyScope(req);
    // Run the max-version lookup, the close of the current version and the
    // insert of the new version inside a single transaction so two concurrent
    // writers cannot both land on `version = N+1` and produce duplicate rows.
    // The FOR UPDATE lock pins the latest version row for the duration of the
    // transaction.
    const newVersion = await withTransaction(async (tx) => {
      if (scope.entityId) {
        // Validate the rule belongs to the caller's entity before writing a version.
        const parent = await tx.queryOne<{ id: string }>(
          'SELECT id FROM rules WHERE id = $1 AND entity_id = $2',
          [ruleId, scope.entityId],
        );
        if (!parent) {
          const err = new Error('not_found') as Error & { statusCode: number };
          err.statusCode = 404;
          throw err;
        }
      }
      const existing = await tx.query<{ version: number }>(
        'SELECT version FROM rule_versions WHERE rule_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE',
        [ruleId],
      );
      const currentMax = Number(existing[0]?.version ?? 0);
      const nextVersion = currentMax + 1;
      if (currentMax > 0) {
        await tx.execute(
          'UPDATE rule_versions SET effective_to=$1 WHERE rule_id=$2 AND version=$3',
          [today, ruleId, currentMax],
        );
      }
      await tx.execute(
        'INSERT INTO rule_versions (rule_id,version,business_unit,product,segment,tenor,base_method,base_reference,spread_method,liquidity_reference,strategic_spread,formula_spec,effective_from,effective_to,changed_by,change_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,$15)',
        [ruleId, nextVersion, r.businessUnit, r.product, r.segment, r.tenor, r.baseMethod, r.baseReference, r.spreadMethod, r.liquidityReference, r.strategicSpread ?? 0, r.formulaSpec ? JSON.stringify(r.formulaSpec) : null, today, r.changedBy, r.changeReason],
      );
      return nextVersion;
    });
    res.json({ ok: true, version: newVersion });
  } catch (err) {
    const e = err as { statusCode?: number; message?: string };
    if (e?.statusCode === 404) {
      res.status(404).json({ code: 'not_found', message: 'Rule not found in this entity' });
      return;
    }
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Clients ---
router.get('/clients', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    res.json(await query(`SELECT * FROM clients ${scope.where} LIMIT 1000`, scope.params));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const c = req.body;
    const id = c.id || randomUUID();
    const scope = tenancyScope(req);
    const row = await queryOne(
      `INSERT INTO clients (id, name, type, segment, rating, country, lei_code, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, type=EXCLUDED.type, segment=EXCLUDED.segment,
         rating=EXCLUDED.rating, country=EXCLUDED.country, lei_code=EXCLUDED.lei_code
       ${scope.entityId ? 'WHERE clients.entity_id = EXCLUDED.entity_id' : ''}
       RETURNING *`,
      [id, c.name, c.type, c.segment, c.rating ?? 'BBB', c.country ?? 'ES', c.lei_code, scope.entityId],
    );
    if (!row) {
      // ON CONFLICT ... WHERE did not match → id exists in another entity.
      res.status(409).json({ code: 'entity_mismatch', message: 'Client id exists in another entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM clients WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM clients WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Products ---
router.get('/products', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    res.json(await query(`SELECT * FROM products ${scope.where} LIMIT 1000`, scope.params));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/products', async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || randomUUID();
    const scope = tenancyScope(req);
    const row = await queryOne(
      `INSERT INTO products (id, name, category, default_amortization, default_repricing,
         description, is_active, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         COALESCE($8::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, category=EXCLUDED.category,
         default_amortization=EXCLUDED.default_amortization,
         default_repricing=EXCLUDED.default_repricing,
         description=EXCLUDED.description, is_active=EXCLUDED.is_active
       ${scope.entityId ? 'WHERE products.entity_id = EXCLUDED.entity_id' : ''}
       RETURNING *`,
      [id, p.name, p.category, p.default_amortization ?? 'Bullet', p.default_repricing ?? 'Fixed', p.description, p.is_active ?? true, scope.entityId],
    );
    if (!row) {
      res.status(409).json({ code: 'entity_mismatch', message: 'Product id exists in another entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM products WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM products WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Business Units ---
router.get('/business-units', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    res.json(await query(`SELECT * FROM business_units ${scope.where} LIMIT 1000`, scope.params));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/business-units', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || randomUUID();
    const scope = tenancyScope(req);
    const row = await queryOne(
      `INSERT INTO business_units (id, name, code, parent_id, is_funding_unit, entity_id)
       VALUES ($1,$2,$3,$4,$5,
         COALESCE($6::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, code=EXCLUDED.code,
         parent_id=EXCLUDED.parent_id, is_funding_unit=EXCLUDED.is_funding_unit
       ${scope.entityId ? 'WHERE business_units.entity_id = EXCLUDED.entity_id' : ''}
       RETURNING *`,
      [id, b.name, b.code, b.parent_id ?? null, b.is_funding_unit ?? false, scope.entityId],
    );
    if (!row) {
      res.status(409).json({ code: 'entity_mismatch', message: 'Business unit id exists in another entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/business-units/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM business_units WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM business_units WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Users ---
// users.entity_id is set per row; a user can belong to several entities via
// entity_users. This CRUD surface only affects the profile row inside the
// calling entity — use /api/entities/* for cross-entity membership.
router.get('/users', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    res.json(await query(`SELECT * FROM users ${scope.where} LIMIT 1000`, scope.params));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/users', async (req, res) => {
  try {
    const u = req.body;
    const id = u.id || `USR-${randomUUID().slice(0, 8)}`;
    const scope = tenancyScope(req);
    const row = await queryOne(
      `INSERT INTO users (id, name, email, role, status, last_login, department, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         COALESCE($8::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role,
         status=EXCLUDED.status, last_login=EXCLUDED.last_login,
         department=EXCLUDED.department
       ${scope.entityId ? 'WHERE users.entity_id = EXCLUDED.entity_id' : ''}
       RETURNING *`,
      [id, u.name, u.email, u.role, u.status, u.last_login ?? u.lastLogin, u.department, scope.entityId],
    );
    if (!row) {
      res.status(409).json({ code: 'entity_mismatch', message: 'User id exists in another entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM users WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM users WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Notifications ---
// Not entity-scoped: isolation is by recipient_email (user's own mailbox).
// Migration 20260406000001 deliberately excluded notifications from the
// entity_id backfill.
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
    // Scoped by recipient_email in the WHERE so another user cannot mark
    // somebody else's notification as read by guessing the id.
    const { email } = req.body ?? {};
    if (email) {
      await execute('UPDATE notifications SET is_read=true WHERE id=$1 AND recipient_email=$2', [req.params.id, email]);
    } else {
      await execute('UPDATE notifications SET is_read=true WHERE id=$1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- System Config (global singleton) ---
// Shocks and other global engine defaults live here — NOT entity-scoped on
// purpose. If/when per-tenant overrides land, this becomes entity_id-aware.
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
    const scope = tenancyScope(req);
    const errors: string[] = [];
    if (clients?.length) {
      for (const c of clients) {
        try {
          await execute(
            `INSERT INTO clients (id, name, type, segment, rating, entity_id)
             VALUES ($1,$2,$3,$4,$5,
               COALESCE($6::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
             ON CONFLICT (id) DO NOTHING`,
            [c.id, c.name, c.type, c.segment, c.rating ?? 'BBB', scope.entityId],
          );
        } catch { errors.push('client:' + c.id); }
      }
    }
    if (users?.length) {
      for (const u of users) {
        try {
          await execute(
            `INSERT INTO users (id, name, email, role, status, entity_id)
             VALUES ($1,$2,$3,$4,$5,
               COALESCE($6::uuid, '00000000-0000-0000-0000-000000000010'::uuid))
             ON CONFLICT (id) DO NOTHING`,
            [u.id, u.name, u.email, u.role, u.status, scope.entityId],
          );
        } catch { errors.push('user:' + u.email); }
      }
    }
    res.json({ success: errors.length === 0, errors });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
