-- N PRICING SYSTEM: INITIAL DATABASE SCHEMA
-- Migration: 20240101000000_initial_schema
-- Description: Core table creation from the original schema.sql
-- Tables: deals, audit_log, behavioural_models, yield_curves, system_config,
--         rules, users, pricing_results, clients, products, business_units,
--         rate_cards, liquidity_curves, esg_transition_grid, esg_physical_grid,
--         incentivisation_rules, approval_matrix

-- 0. DROP EXISTING EMPTY TABLES (production has these 6 tables, all empty, with UUID ids)
--    We drop and recreate to fix type mismatches (production used UUID, migrations had TEXT).
DROP TABLE IF EXISTS pricing_results CASCADE;
DROP TABLE IF EXISTS deal_versions CASCADE;
DROP TABLE IF EXISTS deal_comments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS behavioural_models CASCADE;
DROP TABLE IF EXISTS yield_curves CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. DEALS TABLE (Pricing Blotter)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Booked', 'Pending', 'Rejected', 'Review')),
    -- client_id references clients.id which is TEXT (see #56). Historical
    -- typo had this as UUID, which blocked integration tests that insert
    -- human-readable client IDs like 'CLIENT-1'. Inline server/migrate.ts
    -- schema has always declared this as TEXT; this line now matches.
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
    behavioural_model_id UUID,
    risk_weight NUMERIC,
    capital_ratio NUMERIC,
    target_roe NUMERIC,
    operational_cost_bps NUMERIC,
    transition_risk TEXT,
    physical_risk TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AUDIT LOG TABLE
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

-- 3. BEHAVIOURAL MODELS TABLE
CREATE TABLE IF NOT EXISTS behavioural_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- NMD_Replication or Prepayment_CPR
    nmd_method TEXT DEFAULT 'Caterpillar',
    description TEXT,
    core_ratio NUMERIC,
    decay_rate NUMERIC,
    beta_factor NUMERIC,
    replication_profile JSONB, -- Array of tranches
    cpr NUMERIC,
    penalty_exempt NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. YIELD CURVES TABLE
CREATE TABLE IF NOT EXISTS yield_curves (
    id BIGSERIAL PRIMARY KEY,
    currency TEXT NOT NULL,
    as_of_date DATE DEFAULT CURRENT_DATE,
    grid_data JSONB NOT NULL, -- Array of {tenor, rate}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SYSTEM CONFIG (Shocks, etc.)
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial shocks if not present
INSERT INTO system_config (key, value) VALUES ('shocks', '{"interestRate": 0, "liquiditySpread": 0}') ON CONFLICT (key) DO NOTHING;

-- 6. CONFIG TABLES
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

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    department TEXT
);

-- 7. PRICING RESULTS TABLE
CREATE TABLE IF NOT EXISTS pricing_results (
    id BIGSERIAL PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
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

-- 8. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
    -- clients.id is TEXT, matching (a) the application-layer usage of
    -- human-readable IDs like 'CL-1001', and (b) the server/migrate.ts
    -- inline schema that production runs at boot. A historical typo had
    -- this as UUID, which made it unusable on fresh CI DBs because every
    -- later migration (Customer 360, CLV 360) declares client_id TEXT FKs.
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('Corporate', 'Retail', 'SME', 'Institution', 'Gov')),
    segment TEXT,
    rating TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('Asset', 'Liability', 'Off-Balance')),
    default_amortization TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. BUSINESS UNITS TABLE
CREATE TABLE IF NOT EXISTS business_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. RATE CARDS TABLE
CREATE TABLE IF NOT EXISTS rate_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('Liquidity', 'Basis', 'Commercial', 'Credit')),
    currency TEXT DEFAULT 'USD',
    points JSONB NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    approved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12b. LIQUIDITY CURVES TABLE
CREATE TABLE IF NOT EXISTS liquidity_curves (
    id BIGSERIAL PRIMARY KEY,
    currency TEXT NOT NULL DEFAULT 'USD',
    curve_type TEXT DEFAULT 'unsecured' CHECK (curve_type IN ('unsecured', 'secured')),
    last_update DATE DEFAULT CURRENT_DATE,
    points JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ESG TRANSITION GRID TABLE
CREATE TABLE IF NOT EXISTS esg_transition_grid (
    id SERIAL PRIMARY KEY,
    classification TEXT CHECK (classification IN ('Brown', 'Amber', 'Neutral', 'Green')),
    sector TEXT NOT NULL,
    adjustment_bps NUMERIC NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ESG PHYSICAL GRID TABLE
CREATE TABLE IF NOT EXISTS esg_physical_grid (
    id SERIAL PRIMARY KEY,
    risk_level TEXT CHECK (risk_level IN ('High', 'Medium', 'Low')),
    location_type TEXT NOT NULL,
    adjustment_bps NUMERIC NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. INCENTIVISATION RULES TABLE
CREATE TABLE IF NOT EXISTS incentivisation_rules (
    id TEXT PRIMARY KEY,
    product_type TEXT,
    segment TEXT,
    subsidy_bps NUMERIC NOT NULL,
    valid_from DATE,
    valid_to DATE,
    max_volume NUMERIC,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. APPROVAL MATRIX TABLE
CREATE TABLE IF NOT EXISTS approval_matrix (
    id SERIAL PRIMARY KEY,
    auto_approval_threshold NUMERIC DEFAULT 15,
    l1_threshold NUMERIC DEFAULT 10,
    l2_threshold NUMERIC DEFAULT 5,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable audit log: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ENABLE REALTIME ON ALL TABLES
-- (In Supabase dashboard, you must also check the 'Realtime' box for these tables in Database > Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE behavioural_models;
ALTER PUBLICATION supabase_realtime ADD TABLE yield_curves;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_results;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE business_units;
ALTER PUBLICATION supabase_realtime ADD TABLE rate_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE liquidity_curves;
ALTER PUBLICATION supabase_realtime ADD TABLE esg_transition_grid;
ALTER PUBLICATION supabase_realtime ADD TABLE esg_physical_grid;
ALTER PUBLICATION supabase_realtime ADD TABLE incentivisation_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE approval_matrix;
