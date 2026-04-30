import { pool } from './db';

const SCHEMA = `
-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Pending',
  client_id TEXT,
  client_type TEXT,
  business_unit TEXT,
  funding_business_unit TEXT,
  business_line TEXT,
  product_type TEXT,
  currency TEXT DEFAULT 'USD',
  amount NUMERIC,
  start_date DATE DEFAULT CURRENT_DATE,
  duration_months INTEGER,
  amortization TEXT,
  repricing_freq TEXT,
  margin_target NUMERIC,
  behavioural_model_id TEXT,
  risk_weight NUMERIC,
  capital_ratio NUMERIC,
  target_roe NUMERIC,
  operational_cost_bps NUMERIC,
  lcr_outflow_pct NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'Asset',
  drawn_amount NUMERIC DEFAULT 0,
  undrawn_amount NUMERIC DEFAULT 0,
  is_committed BOOLEAN DEFAULT false,
  lcr_classification TEXT,
  deposit_type TEXT,
  behavioral_maturity_override NUMERIC,
  transition_risk TEXT,
  physical_risk TEXT,
  liquidity_spread NUMERIC,
  _liquidity_premium_details JSONB,
  _clc_charge_details JSONB,
  entity_id TEXT,
  version INTEGER DEFAULT 1,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  pricing_snapshot JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal versions
CREATE TABLE IF NOT EXISTS deal_versions (
  id BIGSERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  pricing_result JSONB,
  changed_by TEXT NOT NULL,
  change_reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT,
  description TEXT,
  details JSONB
);

-- Behavioural models
CREATE TABLE IF NOT EXISTS behavioural_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  nmd_method TEXT DEFAULT 'Caterpillar',
  description TEXT,
  core_ratio NUMERIC,
  decay_rate NUMERIC,
  beta_factor NUMERIC,
  replication_profile JSONB,
  cpr NUMERIC,
  penalty_exempt NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yield curves
CREATE TABLE IF NOT EXISTS yield_curves (
  id BIGSERIAL PRIMARY KEY,
  currency TEXT NOT NULL,
  as_of_date DATE DEFAULT CURRENT_DATE,
  grid_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yield curve history
CREATE TABLE IF NOT EXISTS yield_curve_history (
  id BIGSERIAL PRIMARY KEY,
  curve_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  points JSONB NOT NULL,
  UNIQUE (curve_id, snapshot_date)
);

-- System config key-value store
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing rules
CREATE TABLE IF NOT EXISTS rules (
  id BIGSERIAL PRIMARY KEY,
  business_unit TEXT,
  product TEXT,
  segment TEXT,
  tenor TEXT,
  base_method TEXT,
  base_reference TEXT,
  spread_method TEXT,
  liquidity_reference TEXT,
  strategic_spread NUMERIC
);

-- Rule versions
CREATE TABLE IF NOT EXISTS rule_versions (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL,
  version INTEGER NOT NULL,
  business_unit TEXT,
  product TEXT,
  segment TEXT,
  tenor TEXT,
  base_method TEXT,
  base_reference TEXT,
  spread_method TEXT,
  liquidity_reference TEXT,
  strategic_spread NUMERIC,
  formula_spec JSONB,
  effective_from DATE,
  effective_to DATE,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  segment TEXT,
  rating TEXT DEFAULT 'BBB',
  country TEXT DEFAULT 'ES',
  lei_code TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Backfill entity_id for tables created before Phase 6
ALTER TABLE clients ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Customer 360 / CLV tables (Phase 6)
CREATE TABLE IF NOT EXISTS client_positions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL,
  client_id       TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id      TEXT,
  product_type    TEXT        NOT NULL,
  category        TEXT,
  deal_id         TEXT,
  amount          NUMERIC(20,4),
  currency        TEXT        DEFAULT 'EUR',
  margin_bps      NUMERIC(10,4),
  start_date      DATE,
  maturity_date   DATE,
  status          TEXT        DEFAULT 'Active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_positions_entity_client ON client_positions (entity_id, client_id);

CREATE TABLE IF NOT EXISTS client_metrics_snapshots (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id               UUID        NOT NULL,
  client_id               TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period                  TEXT        NOT NULL,
  computed_at             TIMESTAMPTZ DEFAULT NOW(),
  nim_bps                 NUMERIC(10,4),
  fees_eur                NUMERIC(20,4),
  eva_eur                 NUMERIC(20,4),
  share_of_wallet_pct     NUMERIC(8,6),
  relationship_age_years  NUMERIC(8,4),
  nps_score               INTEGER,
  active_position_count   INTEGER,
  total_exposure_eur      NUMERIC(20,4),
  source                  TEXT,
  detail                  JSONB       DEFAULT '{}'::jsonb,
  UNIQUE (entity_id, client_id, period)
);
CREATE INDEX IF NOT EXISTS idx_client_metrics_entity_client ON client_metrics_snapshots (entity_id, client_id);

CREATE TABLE IF NOT EXISTS client_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID        NOT NULL,
  client_id   TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  event_ts    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source      TEXT,
  amount_eur  NUMERIC(20,4),
  payload     JSONB       DEFAULT '{}'::jsonb,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_events_entity_client ON client_events (entity_id, client_id, event_ts DESC);

CREATE TABLE IF NOT EXISTS client_ltv_snapshots (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id            UUID        NOT NULL,
  client_id            TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  as_of_date           DATE        NOT NULL,
  computed_at          TIMESTAMPTZ DEFAULT NOW(),
  horizon_years        NUMERIC(6,2),
  discount_rate        NUMERIC(8,6),
  clv_point_eur        NUMERIC(20,4),
  clv_p5_eur           NUMERIC(20,4),
  clv_p95_eur          NUMERIC(20,4),
  churn_hazard_annual  NUMERIC(8,6),
  renewal_prob         NUMERIC(8,6),
  share_of_wallet_est  NUMERIC(8,6),
  share_of_wallet_gap  NUMERIC(8,6),
  breakdown            JSONB       DEFAULT '{}'::jsonb,
  assumptions          JSONB       DEFAULT '{}'::jsonb,
  assumptions_hash     TEXT,
  engine_version       TEXT,
  computed_by          TEXT,
  UNIQUE (entity_id, client_id, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_client_ltv_entity_client ON client_ltv_snapshots (entity_id, client_id, as_of_date DESC);

CREATE TABLE IF NOT EXISTS client_nba_recommendations (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                UUID        NOT NULL,
  client_id                TEXT        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recommended_product      TEXT        NOT NULL,
  recommended_rate_bps     NUMERIC(10,4),
  recommended_volume_eur   NUMERIC(20,4),
  recommended_currency     TEXT        DEFAULT 'EUR',
  expected_clv_delta_eur   NUMERIC(20,4),
  confidence               NUMERIC(5,4),
  reason_codes             JSONB       DEFAULT '[]'::jsonb,
  rationale                TEXT,
  source                   TEXT,
  generated_at             TIMESTAMPTZ DEFAULT NOW(),
  consumed_at              TIMESTAMPTZ,
  consumed_by              TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_nba_entity_client ON client_nba_recommendations (entity_id, client_id, created_at DESC);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  default_amortization TEXT DEFAULT 'Bullet',
  default_repricing TEXT DEFAULT 'Fixed',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Business units
CREATE TABLE IF NOT EXISTS business_units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  parent_id TEXT REFERENCES business_units(id),
  is_funding_unit BOOLEAN DEFAULT false,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Governance / Pricing Methodology (Phase 6 Wave 1)
CREATE TABLE IF NOT EXISTS methodology_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT        NOT NULL,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  governance_request_id UUID,
  methodology_hash TEXT,
  notes           TEXT,
  entity_id       UUID,
  is_current      BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_methodology_entity ON methodology_snapshots (entity_id, is_current);

-- Target grid cells — per snapshot, entity-scoped (Phase 6 Wave 2)
CREATE TABLE IF NOT EXISTS target_grid_cells (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          UUID        NOT NULL REFERENCES methodology_snapshots(id) ON DELETE CASCADE,
  entity_id            UUID        NOT NULL,
  product              TEXT        NOT NULL,
  segment              TEXT        NOT NULL,
  tenor_bucket         TEXT        NOT NULL,
  currency             TEXT        DEFAULT 'EUR',
  canonical_deal_input JSONB       DEFAULT '{}'::jsonb,
  ftp                  NUMERIC(10,6),
  liquidity_premium    NUMERIC(10,6),
  capital_charge       NUMERIC(10,6),
  esg_adjustment       NUMERIC(10,6),
  target_margin        NUMERIC(10,6),
  target_client_rate   NUMERIC(10,6),
  target_raroc         NUMERIC(10,6),
  components           JSONB       DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tgc_snapshot ON target_grid_cells (snapshot_id, entity_id);

-- Tolerance bands — pricing discipline thresholds (Phase 6 Wave 3)
CREATE TABLE IF NOT EXISTS tolerance_bands (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id            UUID        NOT NULL,
  product              TEXT,
  segment              TEXT,
  tenor_bucket         TEXT,
  currency             TEXT        DEFAULT 'EUR',
  ftp_bps_tolerance    NUMERIC(10,4),
  raroc_pp_tolerance   NUMERIC(10,4),
  margin_bps_tolerance NUMERIC(10,4),
  priority             INTEGER     DEFAULT 1000,
  active               BOOLEAN     DEFAULT true,
  effective_from       DATE,
  effective_to         DATE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tolerance_entity ON tolerance_bands (entity_id, active, priority);

-- Pricing targets — per-entity segment/product benchmarks for Customer 360
CREATE TABLE IF NOT EXISTS pricing_targets (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id            UUID        NOT NULL,
  segment              TEXT        NOT NULL,
  product_type         TEXT        NOT NULL,
  currency             TEXT        DEFAULT 'EUR',
  period               TEXT        NOT NULL,
  target_margin_bps    NUMERIC(10,4),
  target_raroc_pct     NUMERIC(10,4),
  target_volume_eur    NUMERIC(20,2),
  pre_approved_rate_bps NUMERIC(10,4),
  hard_floor_rate_bps  NUMERIC(10,4),
  active_from          DATE,
  active_to            DATE,
  is_active            BOOLEAN     DEFAULT true,
  created_by           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricing_targets_entity ON pricing_targets (entity_id, is_active, segment, product_type);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT,
  status TEXT,
  last_login TIMESTAMPTZ,
  department TEXT
);

-- Liquidity curves
CREATE TABLE IF NOT EXISTS liquidity_curves (
  id BIGSERIAL PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'USD',
  curve_type TEXT DEFAULT 'unsecured',
  last_update DATE DEFAULT CURRENT_DATE,
  points JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing results
CREATE TABLE IF NOT EXISTS pricing_results (
  id BIGSERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  base_rate NUMERIC,
  liquidity_spread NUMERIC,
  strategic_spread NUMERIC,
  option_cost NUMERIC,
  regulatory_cost NUMERIC,
  lcr_cost NUMERIC,
  nsfr_cost NUMERIC,
  operational_cost NUMERIC,
  capital_charge NUMERIC,
  esg_transition_charge NUMERIC,
  esg_physical_charge NUMERIC,
  floor_price NUMERIC,
  technical_price NUMERIC,
  target_price NUMERIC,
  total_ftp NUMERIC,
  final_client_rate NUMERIC,
  raroc NUMERIC,
  economic_profit NUMERIC,
  approval_level TEXT,
  matched_methodology TEXT,
  match_reason TEXT,
  formula_used TEXT,
  behavioral_maturity_used NUMERIC,
  incentivisation_adj NUMERIC,
  capital_income NUMERIC,
  calculated_by TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  deal_snapshot JSONB
);

-- Deal comments
CREATE TABLE IF NOT EXISTS deal_comments (
  id BIGSERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  action TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  deal_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups (multi-entity)
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT,
  country TEXT,
  base_currency TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id),
  name TEXT NOT NULL,
  legal_name TEXT,
  short_code TEXT,
  country TEXT,
  base_currency TEXT,
  timezone TEXT DEFAULT 'Europe/Madrid',
  approval_matrix JSONB DEFAULT '{}',
  sdr_config JSONB DEFAULT '{}',
  lr_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity users
CREATE TABLE IF NOT EXISTS entity_users (
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT,
  default_bu_id TEXT,
  is_primary_entity BOOLEAN DEFAULT false,
  PRIMARY KEY (entity_id, user_id)
);

-- Report schedules
CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  name TEXT NOT NULL,
  report_type TEXT,
  frequency TEXT,
  format TEXT,
  recipients JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report runs
CREATE TABLE IF NOT EXISTS report_runs (
  id BIGSERIAL PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  entity_id TEXT,
  status TEXT,
  output_url TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Seed default system config
INSERT INTO system_config (key, value) VALUES ('shocks', '{"interestRate": 0, "liquiditySpread": 0}') ON CONFLICT (key) DO NOTHING;

-- Seed default group
INSERT INTO groups (id, name, short_code, country, base_currency, config, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'NFQ Advisory Group', 'NFQ', 'ES', 'EUR', '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Seed default entity
INSERT INTO entities (id, group_id, name, legal_name, short_code, country, base_currency, timezone, approval_matrix, sdr_config, lr_config, is_active)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'NFQ Spain', 'NFQ Advisory S.L.', 'NFQ-ES', 'ES', 'EUR', 'Europe/Madrid', '{}', '{}', '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Seed demo user
INSERT INTO users (id, name, email, role, status)
VALUES ('00000000-0000-0000-0000-000000000100', 'Demo User', 'demo@nfq.es', 'Trader', 'active')
ON CONFLICT (id) DO NOTHING;

-- Link demo user to default entity
INSERT INTO entity_users (entity_id, user_id, role, is_primary_entity)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000100', 'Trader', true)
ON CONFLICT (entity_id, user_id) DO NOTHING;
-- Phase 0 runtime minimums — these are superseded by supabase/migrations/20260602*
-- but applied inline here so the Node-only dev runtime can load the tenancy
-- middleware without running the Supabase migration pipeline.

-- Tenancy violations log (append-only)
CREATE TABLE IF NOT EXISTS tenancy_violations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id      TEXT,
  user_email      TEXT,
  endpoint        TEXT,
  claimed_entity  UUID,
  actual_entities UUID[],
  error_code      TEXT        NOT NULL,
  detail          JSONB       DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_tenancy_violations_recent
  ON tenancy_violations (occurred_at DESC);

-- Helpers needed by the middleware — kept in sync with
-- supabase/migrations/20260602000001_tenancy_helpers.sql
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $fn$
BEGIN
  RETURN coalesce(current_setting('app.current_user_role', true), '');
END;
$fn$;

-- -----------------------------------------------------------------------
-- Incremental ALTER TABLE for columns added after initial schema deployment
-- These are idempotent — they succeed when the column already exists too.
-- -----------------------------------------------------------------------
ALTER TABLE client_nba_recommendations
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS consumed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_by  TEXT;

ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS entity_id UUID;

ALTER TABLE target_grid_cells
  ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ DEFAULT NOW();

-- -----------------------------------------------------------------------
-- Campaigns: per-entity promotional pricing campaigns
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_campaigns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL,
  code              TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  segment           TEXT        NOT NULL,
  product_type      TEXT        NOT NULL,
  currency          TEXT        DEFAULT 'EUR',
  channel           TEXT,
  rate_delta_bps    NUMERIC(10,4) NOT NULL DEFAULT 0,
  max_volume_eur    NUMERIC(20,2),
  consumed_volume_eur NUMERIC(20,2) NOT NULL DEFAULT 0,
  active_from       DATE        NOT NULL DEFAULT CURRENT_DATE,
  active_to         DATE        NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
  status            TEXT        NOT NULL DEFAULT 'draft',
  version           INT         NOT NULL DEFAULT 1,
  parent_version_id UUID,
  created_by        TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_campaigns_code_entity ON pricing_campaigns (entity_id, code);
CREATE INDEX IF NOT EXISTS idx_pricing_campaigns_entity_status ON pricing_campaigns (entity_id, status);

-- -----------------------------------------------------------------------
-- Model inventory: governance model tracking (MRM)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_inventory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID,
  kind              TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  version           TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'candidate',
  owner_email       TEXT,
  validation_doc_url TEXT,
  validated_at      DATE,
  effective_from    DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_inventory_entity ON model_inventory (entity_id, status);

-- -----------------------------------------------------------------------
-- Signed committee dossiers: cryptographically signed deal approvals
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signed_committee_dossiers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID        NOT NULL,
  deal_id             TEXT,
  pricing_snapshot_id UUID,
  dossier_payload     JSONB       NOT NULL DEFAULT '{}',
  payload_hash        TEXT        NOT NULL,
  signature_hex       TEXT        NOT NULL,
  signed_by_email     TEXT,
  signed_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signed_dossiers_entity ON signed_committee_dossiers (entity_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signed_dossiers_deal ON signed_committee_dossiers (deal_id);

-- -----------------------------------------------------------------------
-- Approval escalations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_escalations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID        NOT NULL,
  deal_id       TEXT,
  exception_id  TEXT,
  level         TEXT        NOT NULL DEFAULT 'L1',
  due_at        TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'open',
  opened_by     TEXT,
  current_notes TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_escalations_entity ON approval_escalations (entity_id, status);

CREATE TABLE IF NOT EXISTS approval_escalation_configs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID        NOT NULL,
  level               TEXT        NOT NULL,
  timeout_hours       INT         NOT NULL DEFAULT 24,
  notify_before_hours INT         NOT NULL DEFAULT 0,
  channel_type        TEXT        NOT NULL DEFAULT 'email',
  channel_config      JSONB       NOT NULL DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_id, level)
);

-- -----------------------------------------------------------------------
-- Ola 8 — Atribuciones jerárquicas (delegated authority)
--   Versión completa con RLS estricto + trigger de validación de hash
--   chain vive en supabase/migrations/20260620000001_attributions.sql.
--   Aquí se inline-ean las tablas y los índices para que dev/Replit
--   arranquen sin la secuencia completa de migrations Supabase.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attribution_levels (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID         NOT NULL,
  name         TEXT         NOT NULL,
  parent_id    UUID         REFERENCES attribution_levels(id),
  level_order  INT          NOT NULL CHECK (level_order >= 1),
  rbac_role    TEXT         NOT NULL,
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, name)
);
CREATE INDEX IF NOT EXISTS idx_attribution_levels_entity
  ON attribution_levels (entity_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_levels_parent
  ON attribution_levels (parent_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_levels_order
  ON attribution_levels (entity_id, level_order) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS attribution_thresholds (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID         NOT NULL,
  level_id            UUID         NOT NULL REFERENCES attribution_levels(id),
  scope               JSONB        NOT NULL,
  deviation_bps_max   NUMERIC(10,4),
  raroc_pp_min        NUMERIC(10,4),
  volume_eur_max      NUMERIC(20,2),
  active_from         DATE         NOT NULL DEFAULT CURRENT_DATE,
  active_to           DATE,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (
    deviation_bps_max IS NOT NULL
    OR raroc_pp_min    IS NOT NULL
    OR volume_eur_max  IS NOT NULL
  ),
  CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_level
  ON attribution_thresholds (level_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_entity
  ON attribution_thresholds (entity_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_scope
  ON attribution_thresholds USING GIN (scope) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS attribution_decisions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                UUID        NOT NULL,
  deal_id                  TEXT        NOT NULL,
  required_level_id        UUID        NOT NULL REFERENCES attribution_levels(id),
  decided_by_level_id      UUID        REFERENCES attribution_levels(id),
  decided_by_user          TEXT,
  decision                 TEXT        NOT NULL
                            CHECK (decision IN ('approved','rejected','escalated','expired','reverted')),
  reason                   TEXT,
  pricing_snapshot_hash    TEXT        NOT NULL,
  routing_metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decided_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_deal
  ON attribution_decisions (deal_id);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_user
  ON attribution_decisions (decided_by_user);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_snapshot
  ON attribution_decisions (pricing_snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_entity_decided
  ON attribution_decisions (entity_id, decided_at DESC);

-- -----------------------------------------------------------------------
-- Ola 10 Bloque B — Attribution threshold recalibrations.
--   RLS estricto + trigger validation viven en
--   supabase/migrations/20260630000001_attribution_threshold_recalibrations.sql.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attribution_threshold_recalibrations (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                   UUID         NOT NULL,
  threshold_id                UUID         NOT NULL REFERENCES attribution_thresholds(id),
  proposed_deviation_bps_max  NUMERIC(10,4),
  proposed_raroc_pp_min       NUMERIC(10,4),
  proposed_volume_eur_max     NUMERIC(20,2),
  rationale                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status                      TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected','superseded')),
  proposed_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  decided_at                  TIMESTAMPTZ,
  decided_by_user             TEXT,
  reason                      TEXT,
  CHECK (
    proposed_deviation_bps_max IS NOT NULL
    OR proposed_raroc_pp_min    IS NOT NULL
    OR proposed_volume_eur_max  IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_attr_recal_entity_status
  ON attribution_threshold_recalibrations (entity_id, status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_recal_threshold
  ON attribution_threshold_recalibrations (threshold_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attr_recal_pending
  ON attribution_threshold_recalibrations (threshold_id)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------
-- Ola 10 Bloque C — push_subscriptions for mobile-first cockpit.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID         NOT NULL,
  user_email   TEXT         NOT NULL,
  endpoint     TEXT         NOT NULL,
  keys_p256dh  TEXT         NOT NULL,
  keys_auth    TEXT         NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, user_email, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_entity_user
  ON push_subscriptions (entity_id, user_email);

-- -----------------------------------------------------------------------
-- Pricing snapshots: immutable engine input/output records
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL,
  deal_id           TEXT,
  pricing_result_id UUID,
  request_id        TEXT,
  engine_version    TEXT        NOT NULL DEFAULT '0.0.0',
  as_of_date        DATE,
  used_mock_for     TEXT[]      NOT NULL DEFAULT '{}',
  input             JSONB       NOT NULL DEFAULT '{}',
  context           JSONB       NOT NULL DEFAULT '{}',
  output            JSONB       NOT NULL DEFAULT '{}',
  input_hash        TEXT        NOT NULL DEFAULT '',
  output_hash       TEXT        NOT NULL DEFAULT '',
  scenario_id       TEXT,
  scenario_source   TEXT,
  prev_output_hash  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Handle dev DBs created before the scenario columns landed.
ALTER TABLE pricing_snapshots ADD COLUMN IF NOT EXISTS scenario_id     TEXT;
ALTER TABLE pricing_snapshots ADD COLUMN IF NOT EXISTS scenario_source TEXT;
-- Ola 6 Bloque C — hash chain link.
ALTER TABLE pricing_snapshots ADD COLUMN IF NOT EXISTS prev_output_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_entity ON pricing_snapshots (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_deal ON pricing_snapshots (deal_id);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_scenario
  ON pricing_snapshots (entity_id, scenario_id, created_at DESC)
  WHERE scenario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pricing_snapshots_prev_hash
  ON pricing_snapshots (entity_id, prev_output_hash)
  WHERE prev_output_hash IS NOT NULL;

-- -----------------------------------------------------------------------
-- Ola 8 / Ola 10 B — Attribution data-integrity triggers.
--
-- Replicados desde supabase/migrations/{20260620000001_attributions,
-- 20260630000001_attribution_threshold_recalibrations}.sql para que el
-- arranque Node-only (dev / Replit) tenga los mismos guardrails que el
-- entorno Supabase. RLS sigue viviendo solo en las migrations Supabase
-- (no hay multi-tenant real en Replit), pero la validación de integridad
-- aplica a todas las DBs.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_attribution_decision_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pricing_snapshots
    WHERE output_hash = NEW.pricing_snapshot_hash
      AND entity_id   = NEW.entity_id
  ) THEN
    RAISE EXCEPTION
      'attribution_decision rejects unknown pricing_snapshot_hash % for entity %',
      NEW.pricing_snapshot_hash, NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_attribution_decision ON attribution_decisions;
CREATE TRIGGER trg_validate_attribution_decision
  BEFORE INSERT ON attribution_decisions
  FOR EACH ROW
  EXECUTE FUNCTION validate_attribution_decision_hash();

CREATE OR REPLACE FUNCTION validate_attr_recal_threshold_entity()
RETURNS TRIGGER AS $$
DECLARE
  threshold_entity UUID;
BEGIN
  SELECT entity_id INTO threshold_entity
  FROM attribution_thresholds
  WHERE id = NEW.threshold_id;

  IF threshold_entity IS NULL THEN
    RAISE EXCEPTION
      'attribution_threshold_recalibration rejects unknown threshold_id %',
      NEW.threshold_id;
  END IF;
  IF threshold_entity <> NEW.entity_id THEN
    RAISE EXCEPTION
      'cross-tenant recalibration rejected: threshold % belongs to entity %, recalibration claims %',
      NEW.threshold_id, threshold_entity, NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_attr_recal_entity ON attribution_threshold_recalibrations;
CREATE TRIGGER trg_validate_attr_recal_entity
  BEFORE INSERT OR UPDATE OF threshold_id, entity_id
  ON attribution_threshold_recalibrations
  FOR EACH ROW
  EXECUTE FUNCTION validate_attr_recal_threshold_entity();

-- -----------------------------------------------------------------------
-- Metering: daily usage aggregates and feature flags
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_aggregates_daily (
  entity_id     UUID        NOT NULL,
  day           DATE        NOT NULL,
  event_kind    TEXT        NOT NULL,
  event_count   BIGINT      NOT NULL DEFAULT 0,
  units_total   NUMERIC(20,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_id, day, event_kind)
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  entity_id UUID        NOT NULL,
  flag      TEXT        NOT NULL,
  enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  set_by    TEXT,
  set_at    TIMESTAMPTZ DEFAULT NOW(),
  notes     TEXT,
  PRIMARY KEY (entity_id, flag)
);

-- -----------------------------------------------------------------------
-- Channel API: keys and request log for external channel integrations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_api_keys (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        UUID        NOT NULL,
  channel          TEXT        NOT NULL,
  key_hash         TEXT        NOT NULL UNIQUE,
  rate_limit_rpm   INT         NOT NULL DEFAULT 60,
  rate_limit_burst INT         NOT NULL DEFAULT 10,
  daily_quota      INT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  revoked_at       TIMESTAMPTZ,
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_api_keys_entity ON channel_api_keys (entity_id);

CREATE TABLE IF NOT EXISTS channel_request_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID        NOT NULL,
  api_key_id  UUID,
  channel     TEXT,
  endpoint    TEXT,
  status_code INT,
  duration_ms INT,
  request_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_request_log_entity ON channel_request_log (entity_id, created_at DESC);

-- -----------------------------------------------------------------------
-- Canonical deal templates: reference inputs per product/segment/tenor
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canonical_deal_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID,
  product         TEXT        NOT NULL,
  segment         TEXT        NOT NULL,
  tenor_bucket    TEXT        NOT NULL,
  currency        TEXT        NOT NULL DEFAULT 'EUR',
  template        JSONB       NOT NULL DEFAULT '{}',
  editable_by_role JSONB      NOT NULL DEFAULT '["methodologist","admin"]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canonical_templates_entity ON canonical_deal_templates (entity_id, product, segment);

-- -----------------------------------------------------------------------
-- Observability: alert rules
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID,
  name        TEXT        NOT NULL,
  metric_name TEXT        NOT NULL,
  operator    TEXT        NOT NULL DEFAULT '>',
  threshold   NUMERIC(20,6) NOT NULL DEFAULT 0,
  recipients  JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity ON alert_rules (entity_id, is_active);

-- -----------------------------------------------------------------------
-- Market benchmarks (pivot §Bloque H, Ola 6 §Bloque D)
-- Cross-tenant reference data (BBG / Refinitiv / BdE / EBA surveys).
-- No entity_id / no RLS — shared across tenants by design.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_benchmarks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  tenor_bucket TEXT NOT NULL,
  client_type  TEXT NOT NULL,
  currency     TEXT NOT NULL,
  rate         NUMERIC NOT NULL,
  source       TEXT NOT NULL,
  as_of_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'market_benchmarks' AND constraint_name = 'market_benchmarks_tenor_check') THEN
    ALTER TABLE market_benchmarks ADD CONSTRAINT market_benchmarks_tenor_check
      CHECK (tenor_bucket IN ('ST', 'MT', 'LT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'market_benchmarks' AND constraint_name = 'market_benchmarks_rate_check') THEN
    ALTER TABLE market_benchmarks ADD CONSTRAINT market_benchmarks_rate_check
      CHECK (rate >= 0 AND rate <= 50);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_benchmarks_latest
  ON market_benchmarks (product_type, tenor_bucket, client_type, currency, as_of_date);
CREATE INDEX IF NOT EXISTS idx_market_benchmarks_lookup
  ON market_benchmarks (product_type, client_type, currency, as_of_date DESC);
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA);
    console.info('[migrate] Database schema created/verified');
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
