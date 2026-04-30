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
    const { user_name, action, module, description, details, timestamp } = req.body;
    const scope = tenancyScope(req);
    // user_email se toma del tenancy verificado (JWT), nunca del body.
    // Aceptarlo del body permitía a un cliente autenticado insertar
    // entradas de audit suplantando a otro usuario. El audit trail es
    // regulatoriamente vinculante (SR 11-7) — la integridad del actor
    // no es negociable.
    const verifiedUserEmail = req.tenancy?.userEmail
      ?? (req.user as { email?: string } | null)?.email
      ?? 'system';
    // user_name puede venir del body porque es display-only, no security-relevant.
    const user_name_safe = typeof req.body?.user_name === 'string' ? req.body.user_name : null;
    void user_name; // eslint
    await execute(
      `INSERT INTO audit_log
         (timestamp, user_email, user_name, action, module, description, details, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::uuid, '00000000-0000-0000-0000-000000000010'::uuid))`,
      [
        timestamp || new Date().toISOString(),
        verifiedUserEmail,
        user_name_safe,
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
