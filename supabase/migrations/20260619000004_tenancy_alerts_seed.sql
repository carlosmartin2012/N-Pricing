-- Ola 6 Bloque A — Seed the 3 canonical alert rules required before
-- flipping `TENANCY_STRICT=on` in production.
--
-- Mirrors `scripts/seed-tenancy-alerts.ts` so the flip no longer depends
-- on operators remembering to run an ad-hoc script. The migration runs
-- once per deploy and is idempotent — existing rules with the same
-- (entity_id, name) are left untouched so ops tuning does not get
-- clobbered on every deploy.
--
-- Channel config is intentionally seeded empty:
--   - Slack webhook URLs and PagerDuty routing keys are tenant-scoped
--     secrets that live in env vars (SEED_SLACK_WEBHOOK_URL /
--     SEED_PAGERDUTY_ROUTING_KEY) or the ops UI.
--   - Migrations run with no process env exposure. Rather than embed
--     fake credentials, we emit rules with `{}` so the channel dispatcher
--     treats them as "not yet routable" and the existing UI shows the
--     rule as needing configuration.
--   - The TS script remains the supported path to fill in secrets
--     post-deploy.
--
-- Scope: only active entities at migration time. New tenants provisioned
-- later inherit the same rules via `scripts/provision-tenant.ts` calling
-- this same seed logic (follow-up — tracked in the provision script's
-- default-flags path).

DO $$
DECLARE
  ent     RECORD;
  rule    RECORD;
  seed_rules CONSTANT JSONB := '[
    {
      "name": "pricing p95 breach",
      "metric_name": "pricing_single_latency_ms",
      "operator": "gt",
      "threshold": 300,
      "severity": "warning",
      "window_seconds": 300,
      "cooldown_seconds": 600,
      "channel_type": "slack"
    },
    {
      "name": "tenancy violation",
      "metric_name": "tenancy_violations_total",
      "operator": "gt",
      "threshold": 0,
      "severity": "critical",
      "window_seconds": 300,
      "cooldown_seconds": 300,
      "channel_type": "pagerduty"
    },
    {
      "name": "snapshot write failure",
      "metric_name": "snapshot_write_failures_total",
      "operator": "gt",
      "threshold": 0,
      "severity": "page",
      "window_seconds": 300,
      "cooldown_seconds": 300,
      "channel_type": "pagerduty"
    }
  ]'::JSONB;
BEGIN
  FOR ent IN SELECT id FROM entities WHERE is_active = TRUE LOOP
    FOR rule IN
      SELECT * FROM jsonb_to_recordset(seed_rules) AS x(
        name             TEXT,
        metric_name      TEXT,
        operator         TEXT,
        threshold        NUMERIC,
        severity         TEXT,
        window_seconds   INTEGER,
        cooldown_seconds INTEGER,
        channel_type     TEXT
      )
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM alert_rules
        WHERE entity_id = ent.id AND name = rule.name
      ) THEN
        INSERT INTO alert_rules (
          entity_id, name, metric_name, operator, threshold,
          severity, window_seconds, cooldown_seconds,
          channel_type, channel_config, recipients, is_active
        ) VALUES (
          ent.id,
          rule.name,
          rule.metric_name,
          rule.operator,
          rule.threshold,
          rule.severity,
          rule.window_seconds,
          rule.cooldown_seconds,
          rule.channel_type,
          '{}'::JSONB,
          '[]'::JSONB,
          TRUE
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
