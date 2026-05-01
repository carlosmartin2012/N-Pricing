import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';
import { entityScopedClause, tenancyScope } from '../middleware/requireTenancy';

const router = Router();

// Sentinel usado en legacy mode (TENANCY_ENFORCE=off, sin req.tenancy).
// Mantiene el patrón de audit.ts: nunca escribir entity_id NULL.
const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';

// All report-schedule queries son entity-scoped cuando el middleware de
// tenancy ha poblado req.tenancy. En legacy mode (TENANCY_ENFORCE=off)
// el scope es no-op, así que despliegues existentes mantienen la
// semántica pre-tenancy hasta el flip a strict.

router.get('/', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    const sql = `SELECT * FROM report_schedules ${scope.where} ORDER BY created_at DESC LIMIT 1000`;
    res.json(await query(sql, scope.params));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const s = req.body ?? {};
    const id = s.id || randomUUID();
    const scope = tenancyScope(req);
    // body.entity_id se ignora deliberadamente — el tenant vinculante
    // viene del JWT verificado por tenancyMiddleware. Aceptarlo del
    // body permitía a un cliente del tenant A crear schedules para B.
    const entityId = scope.entityId ?? DEFAULT_ENTITY_ID;
    // ON CONFLICT con WHERE entity_id = $2: si el id existe pero pertenece
    // a otra entity, el UPSERT no actualiza nada y RETURNING devuelve null.
    // Esto evita filtración cross-tenant vía conflict-update.
    const row = await queryOne(
      `INSERT INTO report_schedules
         (id, entity_id, name, report_type, frequency, format, recipients, config, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         report_type = EXCLUDED.report_type,
         frequency = EXCLUDED.frequency,
         format = EXCLUDED.format,
         recipients = EXCLUDED.recipients,
         config = EXCLUDED.config,
         is_active = EXCLUDED.is_active
         WHERE report_schedules.entity_id = $2
       RETURNING *`,
      [
        id,
        entityId,
        s.name,
        s.report_type,
        s.frequency,
        s.format,
        JSON.stringify(s.recipients ?? []),
        JSON.stringify(s.config ?? {}),
        s.is_active ?? true,
        s.created_by,
      ],
    );
    if (!row) {
      // 404 deliberado para no revelar la existencia del id en otra entity.
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 2);
    const sql = `DELETE FROM report_schedules WHERE id=$1 ${scope.and}`;
    await execute(sql, [req.params.id, ...scope.params]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 3);
    const sql = `UPDATE report_schedules SET is_active=$1 WHERE id=$2 ${scope.and}`;
    await execute(sql, [req.body.is_active, req.params.id, ...scope.params]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id/runs', async (req, res) => {
  try {
    // report_runs.entity_id existe en ambos schemas (UUID en migration,
    // TEXT en migrate.ts inline). Filtramos por schedule_id + entity para
    // que conocer el id de un schedule de otra entity no leak runs.
    const scope = entityScopedClause(req, 2);
    const sql =
      `SELECT * FROM report_runs WHERE schedule_id=$1 ${scope.and} ` +
      `ORDER BY started_at DESC LIMIT 20`;
    const rows = await query(sql, [req.params.id, ...scope.params]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
