-- Phase 2 Sprint 1 — channels & bulk operations foundation.
--
-- Three new tables:
--   1. channel_api_keys      — credentials & quotas per delivery channel
--   2. pricing_campaigns     — versioned commercial campaigns (segment×product×period)
--   3. channel_request_log   — circular log of channel requests for SLO + abuse detection

-- ---------- 1) channel_api_keys ----------
CREATE TABLE IF NOT EXISTS channel_api_keys (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        UUID        NOT NULL REFERENCES entities(id),
  channel          TEXT        NOT NULL CHECK (channel IN ('branch','web','mobile','call_center','partner')),
  label            TEXT        NOT NULL,
  key_hash         TEXT        NOT NULL,           -- sha256 of the actual key (never store the key itself)
  rate_limit_rpm   INTEGER     NOT NULL DEFAULT 60,
  rate_limit_burst INTEGER     NOT NULL DEFAULT 20,
  daily_quota      INTEGER,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at     TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  UNIQUE (entity_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_channel_api_keys_entity  ON channel_api_keys (entity_id);
CREATE INDEX IF NOT EXISTS idx_channel_api_keys_active  ON channel_api_keys (entity_id, channel) WHERE is_active = true AND revoked_at IS NULL;

ALTER TABLE channel_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_api_keys_read   ON channel_api_keys;
DROP POLICY IF EXISTS channel_api_keys_write  ON channel_api_keys;

CREATE POLICY channel_api_keys_read ON channel_api_keys
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

-- Only Admins can mint or revoke API keys.
CREATE POLICY channel_api_keys_write ON channel_api_keys
  FOR ALL TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  )
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  );

-- ---------- 2) pricing_campaigns ----------
CREATE TABLE IF NOT EXISTS pricing_campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        UUID        NOT NULL REFERENCES entities(id),
  code             TEXT        NOT NULL,                  -- short identifier, e.g. 'SUMMER_2026_HIPO'
  name             TEXT        NOT NULL,
  segment          TEXT        NOT NULL,
  product_type     TEXT        NOT NULL,
  currency         TEXT        NOT NULL DEFAULT 'EUR',
  channel          TEXT        CHECK (channel IS NULL OR channel IN ('branch','web','mobile','call_center','partner')),

  rate_delta_bps   NUMERIC(10,4) NOT NULL DEFAULT 0,      -- delta vs. baseline pricing
  max_volume_eur   NUMERIC(20,2),
  consumed_volume_eur NUMERIC(20,2) NOT NULL DEFAULT 0,

  active_from      DATE        NOT NULL,
  active_to        DATE        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','active','exhausted','expired','cancelled')),
  version          INTEGER     NOT NULL DEFAULT 1,
  parent_version_id UUID       REFERENCES pricing_campaigns(id),

  created_by       TEXT,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (active_to >= active_from),
  CHECK (max_volume_eur IS NULL OR max_volume_eur > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_campaigns_active_code
  ON pricing_campaigns (entity_id, code, version);
CREATE INDEX IF NOT EXISTS idx_pricing_campaigns_lookup
  ON pricing_campaigns (entity_id, segment, product_type, currency, status)
  WHERE status IN ('approved','active');

ALTER TABLE pricing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_campaigns_read   ON pricing_campaigns;
DROP POLICY IF EXISTS pricing_campaigns_insert ON pricing_campaigns;
DROP POLICY IF EXISTS pricing_campaigns_update ON pricing_campaigns;

CREATE POLICY pricing_campaigns_read ON pricing_campaigns
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY pricing_campaigns_insert ON pricing_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY pricing_campaigns_update ON pricing_campaigns
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

-- ---------- 3) channel_request_log ----------
-- Lightweight per-request log for SLO + abuse detection. Purged by retention job.
CREATE TABLE IF NOT EXISTS channel_request_log (
  id           BIGSERIAL    PRIMARY KEY,
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  entity_id    UUID         NOT NULL REFERENCES entities(id),
  api_key_id   UUID         REFERENCES channel_api_keys(id) ON DELETE SET NULL,
  channel      TEXT         NOT NULL,
  endpoint     TEXT         NOT NULL,
  status_code  INTEGER      NOT NULL,
  duration_ms  INTEGER      NOT NULL,
  request_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_channel_request_log_entity_recent
  ON channel_request_log (entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_request_log_key
  ON channel_request_log (api_key_id, occurred_at DESC);

ALTER TABLE channel_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_request_log_read ON channel_request_log;
CREATE POLICY channel_request_log_read ON channel_request_log
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
-- INSERT happens via service role from the channel API.

COMMENT ON TABLE channel_api_keys IS 'Per-channel API credentials. The key itself is never stored; only sha256(key).';
COMMENT ON TABLE pricing_campaigns IS 'Versioned commercial campaigns. status transitions: draft → approved → active → (exhausted|expired|cancelled).';
COMMENT ON TABLE channel_request_log IS 'Append-only per-channel-call log. Retention recommendation: 90 days (purge job).';
