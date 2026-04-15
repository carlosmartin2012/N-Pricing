-- Extend alert_rules to support multiple delivery channels and severities.
-- Legacy rows (email-only) are migrated idempotently into channel_config.

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS channel_type      TEXT        NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS channel_config    JSONB                DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS severity          TEXT        NOT NULL DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS window_seconds    INTEGER     NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cooldown_seconds  INTEGER     NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_channel_type_check;
ALTER TABLE alert_rules
  ADD CONSTRAINT alert_rules_channel_type_check
  CHECK (channel_type IN ('email','slack','pagerduty','webhook','opsgenie'));

ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_severity_check;
ALTER TABLE alert_rules
  ADD CONSTRAINT alert_rules_severity_check
  CHECK (severity IN ('info','warning','page','critical'));

-- Backfill: rows that still have the empty default jsonb inherit their
-- recipients[] into the email channel. Safe to re-run.
UPDATE alert_rules
SET channel_config = jsonb_build_object('recipients', recipients)
WHERE channel_type = 'email'
  AND channel_config = '{}'::jsonb
  AND recipients IS NOT NULL;

-- ---------- Alert invocations audit log ----------
CREATE TABLE IF NOT EXISTS alert_invocations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id   UUID        NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric_value    NUMERIC     NOT NULL,
  threshold       NUMERIC     NOT NULL,
  payload_sent    JSONB       NOT NULL,
  delivery_status TEXT        NOT NULL
    CHECK (delivery_status IN ('pending','sent','failed','deduped')),
  delivery_error  TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_invocations_rule
  ON alert_invocations (alert_rule_id, triggered_at DESC);

ALTER TABLE alert_invocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_invocations_read ON alert_invocations;
CREATE POLICY alert_invocations_read ON alert_invocations
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
-- Writes happen via service role / server pool. No authenticated write.
