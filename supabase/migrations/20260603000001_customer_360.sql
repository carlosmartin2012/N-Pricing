-- Customer 360 foundation (Phase 1 — Sprint 1).
--
-- Three tables make the existing one-shot `clients` row evolve into a
-- relationship view:
--   1. client_positions           — per-product holdings (active deals + status)
--   2. client_metrics_snapshots   — periodic NIM/fees/EVA aggregates per client
--   3. pricing_targets            — top-down targets bandera→sucursal per
--                                   (entity × segment × product × period)
--
-- All three are entity-scoped and follow the same RLS pattern as the rest of
-- Phase 0 hardening (read = accessible_entity_ids, write = current entity +
-- author role).

-- ---------- 1) client_positions ----------
-- One row per active product position per client. Sourced from deal data
-- (one row per deal that is still alive) but kept materialised so we can
-- compute relationship aggregates without scanning deals every time.

CREATE TABLE IF NOT EXISTS client_positions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID        NOT NULL REFERENCES entities(id),
  client_id     TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id    TEXT        REFERENCES products(id),
  product_type  TEXT        NOT NULL,
  category      TEXT        NOT NULL CHECK (category IN ('Asset', 'Liability', 'Off-Balance', 'Service')),
  deal_id       UUID        REFERENCES deals(id) ON DELETE SET NULL,

  amount         NUMERIC(20,2) NOT NULL,
  currency       TEXT          NOT NULL DEFAULT 'EUR',
  margin_bps     NUMERIC(10,4),
  start_date     DATE          NOT NULL,
  maturity_date  DATE,

  status         TEXT          NOT NULL DEFAULT 'Active'
                  CHECK (status IN ('Active', 'Matured', 'Cancelled')),

  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_positions_client    ON client_positions (client_id);
CREATE INDEX IF NOT EXISTS idx_client_positions_entity    ON client_positions (entity_id);
CREATE INDEX IF NOT EXISTS idx_client_positions_active
  ON client_positions (client_id, status) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_client_positions_deal      ON client_positions (deal_id);

ALTER TABLE client_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_positions_read   ON client_positions;
DROP POLICY IF EXISTS client_positions_insert ON client_positions;
DROP POLICY IF EXISTS client_positions_update ON client_positions;
DROP POLICY IF EXISTS client_positions_delete ON client_positions;

CREATE POLICY client_positions_read ON client_positions
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY client_positions_insert ON client_positions
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

CREATE POLICY client_positions_update ON client_positions
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

CREATE POLICY client_positions_delete ON client_positions
  FOR DELETE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

COMMENT ON TABLE client_positions IS
  'Materialised view of active product positions per client. Sourced from deals + manually maintained off-balance positions (services, undrawn commitments).';

-- ---------- 2) client_metrics_snapshots ----------
-- Append-only periodic snapshot of relationship economics: NIM, fees,
-- accumulated EVA, share-of-wallet, NPS. One row per (client, period).

CREATE TABLE IF NOT EXISTS client_metrics_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  client_id       TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period          TEXT        NOT NULL,            -- e.g. '2026-Q2', '2026-04'
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  nim_bps                NUMERIC(10,4),
  fees_eur               NUMERIC(18,2),
  eva_eur                NUMERIC(18,2),
  share_of_wallet_pct    NUMERIC(6,4),    -- 0..1
  relationship_age_years NUMERIC(6,2),
  nps_score              INTEGER          CHECK (nps_score IS NULL OR (nps_score BETWEEN -100 AND 100)),

  active_position_count  INTEGER          NOT NULL DEFAULT 0,
  total_exposure_eur     NUMERIC(20,2)    NOT NULL DEFAULT 0,

  source                 TEXT             NOT NULL DEFAULT 'computed'
                          CHECK (source IN ('computed', 'imported', 'manual')),
  detail                 JSONB            DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_metrics_period_pk
  ON client_metrics_snapshots (entity_id, client_id, period);
CREATE INDEX IF NOT EXISTS idx_client_metrics_client
  ON client_metrics_snapshots (client_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_metrics_entity_period
  ON client_metrics_snapshots (entity_id, period);

ALTER TABLE client_metrics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_metrics_snapshots_read   ON client_metrics_snapshots;
DROP POLICY IF EXISTS client_metrics_snapshots_insert ON client_metrics_snapshots;

CREATE POLICY client_metrics_snapshots_read ON client_metrics_snapshots
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY client_metrics_snapshots_insert ON client_metrics_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Append-only: no UPDATE / DELETE policy ⇒ blocked by default.

COMMENT ON TABLE client_metrics_snapshots IS
  'Periodic relationship economics snapshot per client. Append-only — recomputed every period to preserve historical view.';

-- ---------- 3) pricing_targets ----------
-- Top-down commercial targets bandera→red. Drives "this segment must price
-- at least X bps margin in Q2" enforcement. The tracking of how a deal
-- complies (variance) lives in deal_variance_snapshots from Ola 2.

CREATE TABLE IF NOT EXISTS pricing_targets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  segment         TEXT        NOT NULL,
  product_type    TEXT        NOT NULL,
  currency        TEXT        NOT NULL DEFAULT 'EUR',
  period          TEXT        NOT NULL,         -- e.g. '2026-Q2', '2026'

  target_margin_bps      NUMERIC(10,4),
  target_raroc_pct       NUMERIC(10,4),
  target_volume_eur      NUMERIC(20,2),
  pre_approved_rate_bps  NUMERIC(10,4),         -- branch may book up to this without escalation
  hard_floor_rate_bps    NUMERIC(10,4),         -- below this requires committee

  active_from   DATE        NOT NULL,
  active_to     DATE,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,

  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    pre_approved_rate_bps IS NULL
    OR hard_floor_rate_bps IS NULL
    OR pre_approved_rate_bps >= hard_floor_rate_bps
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_targets_unique
  ON pricing_targets (entity_id, segment, product_type, currency, period)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pricing_targets_lookup
  ON pricing_targets (entity_id, period, segment, product_type, currency)
  WHERE is_active = true;

ALTER TABLE pricing_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_targets_read   ON pricing_targets;
DROP POLICY IF EXISTS pricing_targets_insert ON pricing_targets;
DROP POLICY IF EXISTS pricing_targets_update ON pricing_targets;
DROP POLICY IF EXISTS pricing_targets_delete ON pricing_targets;

CREATE POLICY pricing_targets_read ON pricing_targets
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY pricing_targets_insert ON pricing_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY pricing_targets_update ON pricing_targets
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY pricing_targets_delete ON pricing_targets
  FOR DELETE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  );

COMMENT ON TABLE pricing_targets IS
  'Top-down pricing commitments per (entity, segment, product, currency, period). Pre-approved rates skip approval; hard floors trigger committee.';
