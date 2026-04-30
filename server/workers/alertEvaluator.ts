import { pool } from '../db';
import { dispatchAlert, type DeliveryResult } from '../integrations/alertChannels';
import { recordWorkerTickFailure, recordWorkerTickSuccess } from './workerHealth';
import type {
  AlertChannelConfig,
  AlertChannelType,
  AlertSeverity,
} from '../../types/phase0';
import {
  evaluateAlerts,
  type EvaluatorDeps,
  type EvaluatorRule,
} from './alertEvaluatorCore';

/**
 * Runtime adapters for the alert evaluator. The pure evaluation core lives
 * in `./alertEvaluatorCore.ts` so it stays testable without a Postgres
 * connection. This file wires real DB reads/writes + the channel dispatcher.
 */

export { evaluateAlerts, shouldTrigger } from './alertEvaluatorCore';
export type { EvaluatorRule, EvaluatorDeps, EvaluationReport } from './alertEvaluatorCore';

interface AlertRuleRow {
  id: string;
  entity_id: string;
  name: string;
  metric_name: string;
  operator: EvaluatorRule['operator'];
  threshold: string;
  severity: AlertSeverity;
  window_seconds: number;
  cooldown_seconds: number;
  channel_type: AlertChannelType;
  channel_config: AlertChannelConfig;
  is_active: boolean;
  last_triggered_at: string | null;
}

async function loadRulesFromDb(): Promise<EvaluatorRule[]> {
  const result = await pool.query<AlertRuleRow>(
    `SELECT id, entity_id, name, metric_name, operator, threshold,
            COALESCE(severity, 'warning') AS severity,
            COALESCE(window_seconds, 60)     AS window_seconds,
            COALESCE(cooldown_seconds, 300)  AS cooldown_seconds,
            COALESCE(channel_type, 'email')  AS channel_type,
            COALESCE(channel_config, '{}'::jsonb) AS channel_config,
            is_active, last_triggered_at
     FROM alert_rules
     WHERE is_active = true`,
  );
  return result.rows.map((r) => ({
    id: r.id,
    entityId: r.entity_id,
    name: r.name,
    metricName: r.metric_name,
    operator: r.operator,
    threshold: Number(r.threshold),
    severity: r.severity,
    windowSeconds: r.window_seconds,
    cooldownSeconds: r.cooldown_seconds,
    channelType: r.channel_type,
    channelConfig: r.channel_config,
    isActive: r.is_active,
    lastTriggeredAt: r.last_triggered_at ? new Date(r.last_triggered_at) : null,
  }));
}

async function lookupMetricInDb(rule: EvaluatorRule, now: Date): Promise<{ value: number; sampleCount: number }> {
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000).toISOString();

  if (
    rule.metricName === 'tenancy_violations_total' ||
    rule.metricName === 'snapshot_write_failures_total' ||
    rule.metricName === 'auth_failures_total'
  ) {
    if (rule.metricName === 'tenancy_violations_total') {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM tenancy_violations
         WHERE occurred_at >= $1
           AND (claimed_entity = $2 OR $2 = ANY (actual_entities))`,
        [windowStart, rule.entityId],
      );
      return { value: Number(rows[0]?.n ?? '0'), sampleCount: Number(rows[0]?.n ?? '0') };
    }
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COALESCE(SUM(metric_value), 0)::text AS n FROM metrics
       WHERE entity_id = $1 AND metric_name = $2 AND recorded_at >= $3`,
      [rule.entityId, rule.metricName, windowStart],
    );
    return { value: Number(rows[0]?.n ?? '0'), sampleCount: Number(rows[0]?.n ?? '0') };
  }

  const { rows } = await pool.query<{ p95: string | null; n: string }>(
    `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)::text AS p95,
            COUNT(*)::text AS n
     FROM metrics
     WHERE entity_id = $1 AND metric_name = $2 AND recorded_at >= $3`,
    [rule.entityId, rule.metricName, windowStart],
  );
  return {
    value: Number(rows[0]?.p95 ?? '0'),
    sampleCount: Number(rows[0]?.n ?? '0'),
  };
}

async function recordInvocationInDb(params: {
  rule: EvaluatorRule;
  metricValue: number;
  delivery: DeliveryResult;
  triggeredAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO alert_invocations
       (alert_rule_id, entity_id, triggered_at, metric_value, threshold,
        payload_sent, delivery_status, delivery_error)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      params.rule.id,
      params.rule.entityId,
      params.triggeredAt.toISOString(),
      params.metricValue,
      params.rule.threshold,
      JSON.stringify(params.delivery.payload ?? {}),
      params.delivery.status,
      params.delivery.error ?? null,
    ],
  );
}

async function touchTriggeredInDb(ruleId: string, triggeredAt: Date): Promise<void> {
  await pool.query(
    `UPDATE alert_rules
     SET last_triggered_at = $2, last_evaluated_at = $2
     WHERE id = $1`,
    [ruleId, triggeredAt.toISOString()],
  );
}

export function buildProductionDeps(): EvaluatorDeps {
  return {
    loadRules:      loadRulesFromDb,
    lookupMetric:   lookupMetricInDb,
    dispatch:       (type, config, ctx) => dispatchAlert(type, config, ctx),
    record:         recordInvocationInDb,
    touchTriggered: touchTriggeredInDb,
    now:            () => new Date(),
  };
}

// ---------------------------------------------------------------------------
// Runtime loop — opt-in via ALERT_EVAL_INTERVAL_MS env var
// ---------------------------------------------------------------------------

let interval: ReturnType<typeof setInterval> | null = null;

export function startAlertEvaluator(): void {
  const ms = Number(process.env.ALERT_EVAL_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 1_000) {
    return;
  }
  if (interval) return;

  const deps = buildProductionDeps();
  interval = setInterval(async () => {
    try {
      const report = await evaluateAlerts(deps);
      if (report.triggered > 0 || report.errors.length > 0) {
        console.info('[alert-eval]', report);
      }
      recordWorkerTickSuccess('alert-eval');
    } catch (err) {
      recordWorkerTickFailure('alert-eval', err);
    }
  }, ms);
}

export function stopAlertEvaluator(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
