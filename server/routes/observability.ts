import { randomUUID } from 'crypto';
import { Router } from 'express';
import { execute, query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { adapterRegistry } from '../../integrations/registry';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const entityId = String(req.tenancy?.entityId ?? req.query.entity_id ?? '').trim();
    if (!entityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', error: 'entity_id required' });
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
    const entityId = String(req.tenancy?.entityId ?? req.query.entity_id ?? '').trim();
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
    const entityId = String(req.tenancy?.entityId ?? req.query.entity_id ?? '').trim();
    if (!entityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', error: 'entity_id required' });
    }
    const rows = await query(
      'SELECT * FROM alert_rules WHERE entity_id = $1 ORDER BY is_active DESC, created_at DESC LIMIT 500',
      [entityId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/alert-rules', async (req, res) => {
  try {
    const rule = req.body ?? {};
    const tenantEntityId = req.tenancy?.entityId ?? null;
    if (!tenantEntityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', error: 'x-entity-id required' });
    }
    if (rule.entity_id && rule.entity_id !== tenantEntityId) {
      return res.status(403).json({
        code: 'tenancy_forbidden_write',
        message: 'body.entity_id does not match the authenticated tenancy',
      });
    }
    const id = String(rule.id ?? randomUUID());
    const row = await queryOne(
      `INSERT INTO alert_rules (
         id, entity_id, name, metric_name, operator, threshold, recipients, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         metric_name = EXCLUDED.metric_name,
         operator = EXCLUDED.operator,
         threshold = EXCLUDED.threshold,
         recipients = EXCLUDED.recipients,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       WHERE alert_rules.entity_id = $2
       RETURNING *`,
      [
        id,
        tenantEntityId,
        rule.name,
        rule.metric_name,
        rule.operator,
        rule.threshold,
        JSON.stringify(rule.recipients ?? []),
        rule.is_active ?? true,
      ],
    );
    if (!row) {
      return res.status(409).json({
        code: 'entity_mismatch',
        message: 'Alert rule id exists in another entity',
      });
    }
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
    const tenantEntityId = req.tenancy?.entityId ?? null;
    if (!tenantEntityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', error: 'x-entity-id required' });
    }

    const row = await queryOne(
      'UPDATE alert_rules SET is_active = $3, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *',
      [req.params.id, tenantEntityId, isActive],
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
    const tenantEntityId = req.tenancy?.entityId ?? null;
    if (!tenantEntityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', error: 'x-entity-id required' });
    }
    await execute('DELETE FROM alert_rules WHERE id = $1 AND entity_id = $2', [
      req.params.id,
      tenantEntityId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── SLO summary (Phase 0) ─────────────────────────────────────────────────
// Returns current percentiles per endpoint from metrics, plus tenancy + mock
// counters derived from the raw metrics table. The materialised view
// pricing_slo_minute isn't strictly required here — we read from metrics
// directly to keep the endpoint working even if pg_cron isn't set up yet.
router.get('/slo-summary', async (req, res) => {
  try {
    const entityId = String(req.tenancy?.entityId ?? req.query.entity_id ?? '').trim();
    if (!entityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', message: 'entity_id required' });
    }

    const [latencySingle, latencyBatch, tenancyViolations, mockCalls, snapshotFailures, alerts] =
      await Promise.all([
        queryOne<{ p50: string | null; p95: string | null; p99: string | null; n: string }>(
          `SELECT
             percentile_cont(0.5)  WITHIN GROUP (ORDER BY metric_value)::text AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)::text AS p95,
             percentile_cont(0.99) WITHIN GROUP (ORDER BY metric_value)::text AS p99,
             COUNT(*)::text AS n
           FROM metrics
           WHERE entity_id = $1
             AND metric_name = 'pricing_single_latency_ms'
             AND recorded_at >= NOW() - INTERVAL '1 hour'`,
          [entityId],
        ),
        queryOne<{ p50: string | null; p95: string | null; p99: string | null; n: string }>(
          `SELECT
             percentile_cont(0.5)  WITHIN GROUP (ORDER BY metric_value)::text AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)::text AS p95,
             percentile_cont(0.99) WITHIN GROUP (ORDER BY metric_value)::text AS p99,
             COUNT(*)::text AS n
           FROM metrics
           WHERE entity_id = $1
             AND metric_name = 'pricing_batch_latency_ms_per_deal'
             AND recorded_at >= NOW() - INTERVAL '1 hour'`,
          [entityId],
        ),
        queryOne<{ n: string }>(
          `SELECT COUNT(*)::text AS n
           FROM tenancy_violations
           WHERE occurred_at >= NOW() - INTERVAL '1 hour'
             AND (claimed_entity = $1 OR $1 = ANY (actual_entities))`,
          [entityId],
        ),
        queryOne<{ total: string; mocked: string }>(
          `SELECT
             COUNT(*)::text AS total,
             COUNT(*) FILTER (
               WHERE (dimensions->>'used_mock_for') IS NOT NULL
                 AND (dimensions->>'used_mock_for') <> '[]'
             )::text AS mocked
           FROM metrics
           WHERE entity_id = $1
             AND metric_name LIKE 'pricing_%_latency_ms'
             AND recorded_at >= NOW() - INTERVAL '1 hour'`,
          [entityId],
        ),
        queryOne<{ n: string }>(
          `SELECT COUNT(*)::text AS n
           FROM metrics
           WHERE entity_id = $1
             AND metric_name = 'snapshot_write_failures_total'
             AND recorded_at >= NOW() - INTERVAL '5 minutes'`,
          [entityId],
        ),
        query<{
          id: string;
          name: string;
          metric_name: string;
          severity: string;
          last_triggered_at: string | null;
        }>(
          `SELECT id, name, metric_name,
                  COALESCE(severity, 'warning') AS severity,
                  last_triggered_at
           FROM alert_rules
           WHERE entity_id = $1 AND is_active = true
           ORDER BY last_triggered_at DESC NULLS LAST
           LIMIT 50`,
          [entityId],
        ),
      ]);

    const slos = [
      {
        name: 'pricing_single_latency_ms',
        target: 300,
        current: Number(latencySingle?.p95 ?? 0),
        status: Number(latencySingle?.p95 ?? 0) <= 300 ? 'ok' : 'breached',
        window: '1h',
        percentiles: {
          p50: Number(latencySingle?.p50 ?? 0),
          p95: Number(latencySingle?.p95 ?? 0),
          p99: Number(latencySingle?.p99 ?? 0),
        },
        sampleCount: Number(latencySingle?.n ?? '0'),
      },
      {
        name: 'pricing_batch_latency_ms_per_deal',
        target: 50,
        current: Number(latencyBatch?.p95 ?? 0),
        status: Number(latencyBatch?.p95 ?? 0) <= 50 ? 'ok' : 'breached',
        window: '1h',
        percentiles: {
          p50: Number(latencyBatch?.p50 ?? 0),
          p95: Number(latencyBatch?.p95 ?? 0),
          p99: Number(latencyBatch?.p99 ?? 0),
        },
        sampleCount: Number(latencyBatch?.n ?? '0'),
      },
      {
        name: 'tenancy_violations_total',
        target: 0,
        current: Number(tenancyViolations?.n ?? '0'),
        status: Number(tenancyViolations?.n ?? '0') === 0 ? 'ok' : 'breached',
        window: '1h',
      },
      {
        name: 'mock_fallback_rate',
        target: 0.05,
        current: Number(mockCalls?.total ?? '0') > 0
          ? Number(mockCalls?.mocked ?? '0') / Number(mockCalls?.total ?? '1')
          : 0,
        status: (() => {
          const total = Number(mockCalls?.total ?? '0');
          if (total === 0) return 'ok';
          const rate = Number(mockCalls?.mocked ?? '0') / total;
          return rate < 0.05 ? 'ok' : rate < 0.1 ? 'warning' : 'breached';
        })(),
        window: '1h',
      },
      {
        name: 'snapshot_write_failures_total',
        target: 0,
        current: Number(snapshotFailures?.n ?? '0'),
        status: Number(snapshotFailures?.n ?? '0') === 0 ? 'ok' : 'breached',
        window: '5m',
      },
    ];

    res.json({
      entityId,
      generatedAt: new Date().toISOString(),
      window: '1h',
      slos,
      activeAlerts: alerts.map((a) => ({
        ruleId: a.id,
        name: a.name,
        sli: a.metric_name,
        severity: a.severity,
        lastTriggeredAt: a.last_triggered_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Tenancy violations (Ola 6 Bloque A — canary widget) ───────────────────
// Groups-by-endpoint breakdown of tenancy_violations for the caller's entity
// over a configurable window (default 1 h). Feeds the SLOPanel widget used
// during the 48-h warn-mode observation before flipping TENANCY_STRICT=on.
// The SLO summary already reports the total count; this endpoint adds the
// per-endpoint rollup needed to pinpoint which code paths are leaking.
router.get('/tenancy-violations', async (req, res) => {
  try {
    const entityId = String(req.tenancy?.entityId ?? req.query.entity_id ?? '').trim();
    if (!entityId) {
      return res.status(400).json({ code: 'tenancy_missing_header', message: 'entity_id required' });
    }
    const rawWindow = parseInt(String(req.query.window_minutes ?? '60'), 10);
    const windowMinutes = Math.min(Math.max(Number.isFinite(rawWindow) ? rawWindow : 60, 1), 1440);

    const [totalRow, breakdown] = await Promise.all([
      queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n
         FROM tenancy_violations
         WHERE occurred_at >= NOW() - ($2::int || ' minutes')::interval
           AND (claimed_entity = $1 OR $1 = ANY (actual_entities))`,
        [entityId, windowMinutes],
      ),
      query<{ endpoint: string | null; error_code: string; n: string }>(
        `SELECT
           COALESCE(endpoint, '(unknown)') AS endpoint,
           error_code,
           COUNT(*)::text AS n
         FROM tenancy_violations
         WHERE occurred_at >= NOW() - ($2::int || ' minutes')::interval
           AND (claimed_entity = $1 OR $1 = ANY (actual_entities))
         GROUP BY endpoint, error_code
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [entityId, windowMinutes],
      ),
    ]);

    res.json({
      entityId,
      windowMinutes,
      since: new Date(Date.now() - windowMinutes * 60_000).toISOString(),
      total: Number(totalRow?.n ?? '0'),
      topEndpoints: breakdown.map((r) => ({
        endpoint: r.endpoint ?? '(unknown)',
        errorCode: r.error_code,
        count: Number(r.n),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Integrations health (Phase 4 follow-up) ───────────────────────────────
// Returns the registry's view of each connected adapter (core banking, CRM,
// market data, SSO when added). Not entity-scoped: adapter health is global
// infrastructure state. Anyone authenticated may read; the UI surface is
// gated behind the Admin/Health dashboard.
router.get('/integrations/health', async (_req, res) => {
  try {
    const entries = await adapterRegistry.healthAll();
    res.json({
      generatedAt: new Date().toISOString(),
      adapters: entries.map((e) => ({
        kind: e.kind,
        name: e.name,
        ok: e.health.ok,
        latencyMs: e.health.latencyMs ?? null,
        message: e.health.message ?? null,
        checkedAt: e.health.checkedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
