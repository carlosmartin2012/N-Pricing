-- CLV + 360º temporal (Phase 6).
--
-- Extends Customer 360 from "current-state snapshot" to "temporal + forward-
-- looking" view:
--
--   1. client_events                 — unified timeline (deals, crosssell,
--                                      claims, churn signals, CRM contacts).
--                                      Append-only, long-horizon narrative
--                                      source of truth.
--   2. client_ltv_snapshots          — projected CLV per client at a point in
--                                      time (point estimate + p5/p95 band +
--                                      hazard + renewal prob). Immutable and
--                                      auditable like pricing_snapshots.
--   3. client_nba_recommendations    — next-best-action per client (product,
--                                      rate, expected ΔCLV). Append; soft-
--                                      consume via consumed_at.
--
-- RLS pattern is identical to client_positions (read = accessible, insert =
-- current entity). Audit tables are append-only (no UPDATE/DELETE policy).

-- ---------- 1) client_events ----------
-- Long-running narrative for a client: onboarding, deal booked, crosssell
-- attempt, claim, churn signal, CRM contact, price review. Attribution to
-- deal_id / position_id is optional. payload_jsonb carries source-specific
-- context (email subject, CRM note, event reason codes).

CREATE TABLE IF NOT EXISTS client_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  client_id       TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  event_type      TEXT        NOT NULL
                    CHECK (event_type IN (
                      'onboarding',
                      'deal_booked',
                      'deal_cancelled',
                      'crosssell_attempt',
                      'crosssell_won',
                      'claim',
                      'churn_signal',
                      'contact',
                      'price_review',
                      'committee_review',
                      'nba_generated',
                      'nba_consumed'
                    )),
  event_ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT        NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual', 'pricing', 'crm', 'ops', 'ml', 'adapter')),

  deal_id         UUID        REFERENCES deals(id) ON DELETE SET NULL,
  position_id     UUID        REFERENCES client_positions(id) ON DELETE SET NULL,

  amount_eur      NUMERIC(20, 2),
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,

  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_events_client_ts
  ON client_events (entity_id, client_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_type
  ON client_events (event_type, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_deal
  ON client_events (deal_id) WHERE deal_id IS NOT NULL;

ALTER TABLE client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_events_read   ON client_events;
DROP POLICY IF EXISTS client_events_insert ON client_events;

CREATE POLICY client_events_read ON client_events
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY client_events_insert ON client_events
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Append-only (no UPDATE / DELETE policies ⇒ blocked by default).

COMMENT ON TABLE client_events IS
  'Unified timeline of relationship events. Append-only. Source of truth for 360º temporal view and for CLV hazard / renewal calibration.';

-- ---------- 2) client_ltv_snapshots ----------
-- A CLV snapshot IS an audit artefact: an immutable record of what the model
-- said, with which inputs, at which point in time. Mirrors the discipline of
-- pricing_snapshots so validators (SR 11-7 / EBA) see one coherent pattern.

CREATE TABLE IF NOT EXISTS client_ltv_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             UUID        NOT NULL REFERENCES entities(id),
  client_id             TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  as_of_date            DATE        NOT NULL,
  horizon_years         INTEGER     NOT NULL DEFAULT 10 CHECK (horizon_years BETWEEN 1 AND 30),
  discount_rate         NUMERIC(8, 6) NOT NULL DEFAULT 0.08,

  clv_point_eur         NUMERIC(20, 2) NOT NULL,
  clv_p5_eur            NUMERIC(20, 2),
  clv_p95_eur           NUMERIC(20, 2),

  churn_hazard_annual   NUMERIC(8, 6),      -- λ (annual). 0 ≤ λ ≤ 1 (clamped).
  renewal_prob          NUMERIC(8, 6),      -- 0..1
  share_of_wallet_est   NUMERIC(8, 6),      -- 0..1
  share_of_wallet_gap   NUMERIC(8, 6),      -- 1 - share_of_wallet_est

  breakdown             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Suggested shape:
  --   { nii_eur, crosssell_eur, fees_eur, churn_cost_eur,
  --     per_position: [{ position_id, contribution_eur }, ...] }

  assumptions           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Whatever went into the engine: market curves ids, hazard params, etc.
  -- Canonicalised and hashed below.
  assumptions_hash      CHAR(64)    NOT NULL,        -- sha256(canonicalJSON)
  engine_version        TEXT        NOT NULL DEFAULT 'dev-local',

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_ltv_snapshots_unique
  ON client_ltv_snapshots (entity_id, client_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_client_ltv_snapshots_client
  ON client_ltv_snapshots (client_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_ltv_snapshots_entity
  ON client_ltv_snapshots (entity_id, as_of_date DESC);

ALTER TABLE client_ltv_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_ltv_snapshots_read   ON client_ltv_snapshots;
DROP POLICY IF EXISTS client_ltv_snapshots_insert ON client_ltv_snapshots;

CREATE POLICY client_ltv_snapshots_read ON client_ltv_snapshots
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY client_ltv_snapshots_insert ON client_ltv_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Append-only — same reproducibility contract as pricing_snapshots.

COMMENT ON TABLE client_ltv_snapshots IS
  'Immutable CLV snapshot per client. Append-only; reproducible via engine_version + assumptions_hash.';

-- ---------- 3) client_nba_recommendations ----------
-- Next-Best-Action: (product × rate) candidate ranked by expected ΔCLV.
-- Append, soft-consume (consumed_at). A row can be "stale" (superseded by a
-- later generated recommendation) even if not consumed — callers filter by
-- generated_at DESC per client.

CREATE TABLE IF NOT EXISTS client_nba_recommendations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id               UUID        NOT NULL REFERENCES entities(id),
  client_id               TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  recommended_product     TEXT        NOT NULL,
  recommended_rate_bps    NUMERIC(10, 4),
  recommended_volume_eur  NUMERIC(20, 2),
  recommended_currency    TEXT        NOT NULL DEFAULT 'EUR',

  expected_clv_delta_eur  NUMERIC(20, 2) NOT NULL,
  confidence              NUMERIC(6, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),

  reason_codes            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. ["share_of_wallet_low", "renewal_window_open", "nim_below_target"]
  rationale               TEXT,

  source                  TEXT        NOT NULL DEFAULT 'engine'
                            CHECK (source IN ('engine', 'ml', 'manual', 'crm')),

  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at             TIMESTAMPTZ,
  consumed_by             TEXT
);

CREATE INDEX IF NOT EXISTS idx_nba_client_latest
  ON client_nba_recommendations (client_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nba_entity_unconsumed
  ON client_nba_recommendations (entity_id, generated_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE client_nba_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nba_read    ON client_nba_recommendations;
DROP POLICY IF EXISTS nba_insert  ON client_nba_recommendations;
DROP POLICY IF EXISTS nba_consume ON client_nba_recommendations;

CREATE POLICY nba_read ON client_nba_recommendations
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY nba_insert ON client_nba_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- UPDATE allowed only to flip consumed_at / consumed_by (enforced by handler;
-- RLS allows it as long as entity matches — keeps the policy simple).
CREATE POLICY nba_consume ON client_nba_recommendations
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

COMMENT ON TABLE client_nba_recommendations IS
  'Next-Best-Action candidates per client. Soft-consumed (consumed_at). Superseded by newer generated_at.';
