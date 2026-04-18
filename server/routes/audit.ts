import { Router } from 'express';
import { query, execute } from '../db';
import { safeError } from '../middleware/errorHandler';
import { entityScopedClause, tenancyScope } from '../middleware/requireTenancy';

const router = Router();

// All audit queries are entity-scoped when tenancy middleware populated
// req.tenancy. In legacy (TENANCY_ENFORCE=off) mode the scope is a no-op so
// existing deployments keep their pre-tenancy semantics.

router.get('/', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    const sql = `SELECT * FROM audit_log ${scope.where} ORDER BY timestamp DESC LIMIT 100`;
    const rows = await query(sql, scope.params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/paginated', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'));
    const pageSize = parseInt(String(req.query.pageSize ?? '100'));
    const offset = (page - 1) * pageSize;
    const scope = entityScopedClause(req, 1);
    const rowsSql =
      `SELECT * FROM audit_log ${scope.where} ORDER BY timestamp DESC ` +
      `LIMIT $${scope.params.length + 1} OFFSET $${scope.params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int as count FROM audit_log ${scope.where}`;
    const [rows, countRows] = await Promise.all([
      query(rowsSql, [...scope.params, pageSize, offset]),
      query<{ count: string }>(countSql, scope.params),
    ]);
    res.json({ data: rows, total: parseInt(countRows[0]?.count ?? '0') });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user_email, user_name, action, module, description, details, timestamp } = req.body;
    const scope = tenancyScope(req);
    // In strict mode the entity_id comes from the authenticated tenancy
    // context — never from the client body. In legacy mode we fall back to
    // the table default (Default Entity) by passing NULL so existing callers
    // keep working without sending an entity_id.
    await execute(
      `INSERT INTO audit_log
         (timestamp, user_email, user_name, action, module, description, details, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::uuid, '00000000-0000-0000-0000-000000000010'::uuid))`,
      [
        timestamp || new Date().toISOString(),
        user_email,
        user_name,
        action,
        module,
        description,
        details ? JSON.stringify(details) : null,
        scope.entityId,
      ],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
