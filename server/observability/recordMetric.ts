import { execute } from '../db';
import { createLogger } from '../logger';

const logger = createLogger('recordMetric');

/**
 * Emit a single observability metric into the `metrics` table.
 *
 * The repo has had an empty `metrics` table since the SLO panel was wired —
 * the schema was created but no code path INSERTed anything. As a result
 * `/observability/slo-summary` returns 0/null for every percentile because
 * the table is empty.
 *
 * This helper is the canonical write path. It is best-effort by design:
 * a failed INSERT must NEVER break the calling business path (a worker
 * loop, a pricing call, a request handler). Errors are logged but
 * swallowed.
 *
 * Cost: one INSERT per call. Acceptable for low-cardinality counters
 * (drift signals, snapshot writes) and percentile feeds at moderate
 * throughput. For high-frequency paths (per-request pricing latency)
 * consider batching upstream before calling this.
 *
 * Schema (see supabase/migrations/20260406000004b_recreate_dropped_tables.sql):
 *   id UUID PK
 *   entity_id UUID NULL (REFERENCES entities)
 *   metric_name TEXT NOT NULL
 *   metric_value NUMERIC NOT NULL
 *   dimensions JSONB DEFAULT '{}'
 *   recorded_at TIMESTAMPTZ DEFAULT NOW()
 */

export interface RecordMetricOptions {
  /** Entity scope. Pass null for global metrics (worker health, infra). */
  entityId: string | null;
  /** Catalogued in types/phase0.ts:PRICING_SLOS or a documented operational counter. */
  metricName: string;
  /** Numeric value: latency in ms, count, ratio, etc. */
  value: number;
  /** Optional cardinality dimensions (endpoint, severity, source...). */
  dimensions?: Record<string, unknown>;
}

export async function recordMetric(opts: RecordMetricOptions): Promise<void> {
  if (!Number.isFinite(opts.value)) {
    // Guard against NaN/Infinity slipping into NUMERIC columns. Log so the
    // caller learns about a bug; do not throw — observability emission must
    // be transparent to the business path.
    logger.warn('skipped non-finite metric', {
      metricName: opts.metricName,
      value: String(opts.value),
    });
    return;
  }
  try {
    await execute(
      `INSERT INTO metrics (entity_id, metric_name, metric_value, dimensions)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        opts.entityId,
        opts.metricName,
        opts.value,
        JSON.stringify(opts.dimensions ?? {}),
      ],
    );
  } catch (err) {
    logger.error('metrics INSERT failed', { metricName: opts.metricName }, err instanceof Error ? err : undefined);
  }
}
