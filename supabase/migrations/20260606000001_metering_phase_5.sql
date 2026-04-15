-- Phase 5 Sprint 1 — billing-grade metering + tenant feature flags.
--
-- Tables:
--   1. tenant_feature_flags  — per-tenant kill switches & beta gates
--   2. usage_events          — append-only, billable usage facts
--   3. usage_aggregates_daily — materialised per-day totals for invoicing
--
-- Phase 0/1/2/3/4 systems already write metrics, audit log, snapshots —
-- this layer is specifically for **what we charge for**: pricing calls,
-- snapshot writes, channel quotes, governance dossier signs. Kept separate
-- from metrics so accounting can audit it independently.

-- ---------- 1) tenant_feature_flags ----------
CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  entity_id    UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  flag         TEXT        NOT NULL,
  enabled      BOOLEAN     NOT NULL,
  set_by       TEXT,
  set_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT,
  PRIMARY KEY (entity_id, flag)
);

ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_feature_flags_read  ON tenant_feature_flags;
DROP POLICY IF EXISTS tenant_feature_flags_write ON tenant_feature_flags;

CREATE POLICY tenant_feature_flags_read ON tenant_feature_flags
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY tenant_feature_flags_write ON tenant_feature_flags
  FOR ALL TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  )
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  );

COMMENT ON TABLE tenant_feature_flags IS
  'Per-tenant feature toggles. Common keys: pricing_enabled, channel_api_enabled, ai_assistant_enabled, kill_switch.';

-- ---------- 2) usage_events ----------
CREATE TABLE IF NOT EXISTS usage_events (
  id           BIGSERIAL    PRIMARY KEY,
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  entity_id    UUID         NOT NULL REFERENCES entities(id),
  event_kind   TEXT         NOT NULL CHECK (event_kind IN (
    'pricing_call','snapshot_write','channel_quote','dossier_sign','batch_reprice','elasticity_recalibrate','raroc_realize'
  )),
  units        INTEGER      NOT NULL DEFAULT 1,           -- e.g. batch reprice = N
  detail       JSONB        DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_events_recent
  ON usage_events (entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_kind
  ON usage_events (entity_id, event_kind, occurred_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_events_read ON usage_events;
CREATE POLICY usage_events_read ON usage_events
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
-- Writes via service role / server only.

-- ---------- 3) usage_aggregates_daily ----------
DROP MATERIALIZED VIEW IF EXISTS usage_aggregates_daily;
CREATE MATERIALIZED VIEW usage_aggregates_daily AS
SELECT
  entity_id,
  date_trunc('day', occurred_at)::date AS day,
  event_kind,
  count(*)::bigint            AS event_count,
  COALESCE(sum(units), 0)::bigint AS units_total
FROM usage_events
GROUP BY entity_id, day, event_kind;

CREATE UNIQUE INDEX idx_usage_aggregates_pk
  ON usage_aggregates_daily (entity_id, day, event_kind);

COMMENT ON MATERIALIZED VIEW usage_aggregates_daily IS
  'Per-day usage totals per (entity, kind). Refresh via pg_cron at 00:30 local each day for billing.';
