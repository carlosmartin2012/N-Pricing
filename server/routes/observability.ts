import { randomUUID } from 'crypto';
import { Router } from 'express';
import { execute, query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const entityId = String(req.query.entity_id ?? '').trim();
    if (!entityId) {
      return res.status(400).json({ error: 'entity_id required' });
    }

    const [latencyRow, errorRow, dealRow, alertRow] = await Promise.all([
      queryOne<{
        p50_ms: string | null;
        p95_ms: string | null;
        sample_count: number;
      }>(
        `SELECT
           ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value))::numeric, 2) AS p50_ms,
           ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value))::numeric, 2) AS p95_ms,
           COUNT(*)::int AS sample_count
         FROM metrics
         WHERE entity_id = $1
           AND metric_name = 'pricing_latency_ms'
           AND recorded_at >= NOW() - INTERVAL '24 hours'`,
        [entityId],
      ),
      queryOne<{ error_events_24h: string }>(
        `SELECT COALESCE(SUM(metric_value), 0)::numeric::text AS error_events_24h
         FROM metrics
         WHERE entity_id = $1
           AND metric_name = 'error_count'
           AND recorded_at >= NOW() - INTERVAL '24 hours'`,
        [entityId],
      ),
      queryOne<{ deal_count: string }>(
        'SELECT COUNT(*)::int::text AS deal_count FROM deals WHERE entity_id = $1',
        [entityId],
      ),
      queryOne<{ active_alert_rules: string }>(
        'SELECT COUNT(*)::int::text AS active_alert_rules FROM alert_rules WHERE entity_id = $1 AND is_active = true',
        [entityId],
      ),
    ]);

    res.json({
      entityId,
      pricingLatencyP50Ms:
        latencyRow?.p50_ms != null ? Number(latencyRow.p50_ms) : null,
      pricingLatencyP95Ms:
        latencyRow?.p95_ms != null ? Number(latencyRow.p95_ms) : null,
      latencySampleCount24h: Number(latencyRow?.sample_count ?? 0),
      errorEvents24h: Number(errorRow?.error_events_24h ?? '0'),
      dealCount: Number(dealRow?.deal_count ?? '0'),
      activeAlertRules: Number(alertRow?.active_alert_rules ?? '0'),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/metrics/recent', async (req, res) => {
  try {
    const entityId = String(req.query.entity_id ?? '').trim();
    const metricName = String(req.query.metric_name ?? '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);

    if (!entityId || !metricName) {
      return res.status(400).json({ error: 'entity_id and metric_name required' });
    }

    const rows = await query(
      `SELECT metric_value, recorded_at
       FROM metrics
       WHERE entity_id = $1 AND metric_name = $2
       ORDER BY recorded_at DESC
       LIMIT $3`,
      [entityId, metricName, limit],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/alert-rules', async (req, res) => {
  try {
    const entityId = String(req.query.entity_id ?? '').trim();
    const rows = entityId
      ? await query(
          'SELECT * FROM alert_rules WHERE entity_id = $1 ORDER BY is_active DESC, created_at DESC LIMIT 500',
          [entityId],
        )
      : await query('SELECT * FROM alert_rules ORDER BY is_active DESC, created_at DESC LIMIT 500');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/alert-rules', async (req, res) => {
  try {
    const rule = req.body ?? {};
    const id = String(rule.id ?? randomUUID());
    const row = await queryOne(
      `INSERT INTO alert_rules (
         id, entity_id, name, metric_name, operator, threshold, recipients, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (id) DO UPDATE SET
         entity_id = EXCLUDED.entity_id,
         name = EXCLUDED.name,
         metric_name = EXCLUDED.metric_name,
         operator = EXCLUDED.operator,
         threshold = EXCLUDED.threshold,
         recipients = EXCLUDED.recipients,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        rule.entity_id,
        rule.name,
        rule.metric_name,
        rule.operator,
        rule.threshold,
        JSON.stringify(rule.recipients ?? []),
        rule.is_active ?? true,
      ],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/alert-rules/:id/toggle', async (req, res) => {
  try {
    const isActive = req.body?.is_active;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'is_active boolean required' });
    }

    const row = await queryOne(
      'UPDATE alert_rules SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id, isActive],
    );
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/alert-rules/:id', async (req, res) => {
  try {
    await execute('DELETE FROM alert_rules WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
