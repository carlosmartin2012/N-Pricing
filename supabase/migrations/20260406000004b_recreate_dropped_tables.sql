-- 20260406000004a_reset_legacy_tables.sql was introduced with an earlier timestamp
-- than 20260406000005_observability.sql, but ran in a later server-start because
-- 20260406000005 was already recorded as applied.  Result: metrics and alert_rules
-- were dropped by the cleanup and will never be recreated by the migration runner
-- (20260406000005 is skipped as already-applied).
--
-- This migration restores the two tables so that downstream migrations that
-- reference them (20260602000005_slo_metrics.sql, 20260602000006_alert_channels.sql)
-- work correctly.
--
-- RLS policies are intentionally omitted here:
--   * Dev  — 20260406000005 is already applied and skipped; omitting keeps it idempotent.
--   * Prod — 20260406000005 has not run yet and will add the policies itself.

CREATE TABLE IF NOT EXISTS metrics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID        REFERENCES entities(id),
  metric_name  TEXT        NOT NULL,
  metric_value NUMERIC     NOT NULL,
  dimensions   JSONB       NOT NULL DEFAULT '{}',
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_entity_name
  ON metrics (entity_id, metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_recent
  ON metrics (recorded_at DESC);

ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS alert_rules (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL REFERENCES entities(id),
  name              TEXT        NOT NULL,
  metric_name       TEXT        NOT NULL,
  operator          TEXT        NOT NULL CHECK (operator IN ('gt','lt','gte','lte','eq')),
  threshold         NUMERIC     NOT NULL,
  recipients        JSONB       NOT NULL DEFAULT '[]',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity ON alert_rules (entity_id);
