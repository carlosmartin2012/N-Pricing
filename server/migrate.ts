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
  client_id       TEXT        NOT NULL,
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
  client_id               TEXT        NOT NULL,
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
  client_id   TEXT        NOT NULL,
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
  client_id            TEXT        NOT NULL,
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
  client_id                TEXT        NOT NULL,
  recommended_product      TEXT        NOT NULL,
  recommended_rate_bps     NUMERIC(10,4),
  recommended_volume_eur   NUMERIC(20,4),
  recommended_currency     TEXT        DEFAULT 'EUR',
  expected_clv_delta_eur   NUMERIC(20,4),
  confidence               NUMERIC(5,4),
  reason_codes             JSONB       DEFAULT '[]'::jsonb,
  rationale                TEXT,
  source                   TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business units
CREATE TABLE IF NOT EXISTS business_units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  parent_id TEXT REFERENCES business_units(id),
  is_funding_unit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
