-- SLO surface: per-minute percentile aggregates + error budget tracking.
-- Supports the observability dashboard and the alert evaluator worker.

-- ---------- 1) Materialised view over metrics ----------

DROP MATERIALIZED VIEW IF EXISTS pricing_slo_minute;
CREATE MATERIALIZED VIEW pricing_slo_minute AS
SELECT
  entity_id,
  date_trunc('minute', recorded_at)                              AS bucket,
  (dimensions->>'endpoint')                                      AS endpoint,
  count(*)                                                       AS n_requests,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value)     AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)     AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY metric_value)     AS p99_ms,
  avg(metric_value)                                              AS avg_ms,
  max(metric_value)                                              AS max_ms,
  count(*) FILTER (
    WHERE (dimensions->>'status_code') ~ '^[0-9]+$'
      AND (dimensions->>'status_code')::int >= 500
  )                                                              AS n_errors
FROM metrics
WHERE metric_name LIKE 'pricing_%_latency_ms'
GROUP BY entity_id, bucket, endpoint;

CREATE UNIQUE INDEX idx_pricing_slo_minute_pk
  ON pricing_slo_minute (entity_id, bucket, endpoint);

-- Refresh handled by the alert evaluator worker or pg_cron (if enabled):
--   SELECT cron.schedule('refresh-slo-minute', '* * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY pricing_slo_minute');

-- ---------- 2) Error budget tracker ----------

CREATE TABLE IF NOT EXISTS error_budget (
  entity_id     UUID        NOT NULL REFERENCES entities(id),
  slo_name      TEXT        NOT NULL,
  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,
  budget_total  NUMERIC     NOT NULL,
  budget_used   NUMERIC     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_id, slo_name, period_start)
);

ALTER TABLE error_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS error_budget_read  ON error_budget;
DROP POLICY IF EXISTS error_budget_write ON error_budget;

CREATE POLICY error_budget_read ON error_budget
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY error_budget_write ON error_budget
  FOR ALL TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

-- ---------- 3) Extra metric dimension indexes ----------

CREATE INDEX IF NOT EXISTS idx_metrics_endpoint
  ON metrics ((dimensions->>'endpoint'), recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_request_id
  ON metrics ((dimensions->>'request_id'));
