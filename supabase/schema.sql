-- N PRICING SYSTEM: SUPABASE DATABASE SCHEMA
-- Execute this script in the SQL Editor of your Supabase Dashboard

-- 1. DEALS TABLE (Pricing Blotter)
CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Booked', 'Pending', 'Rejected', 'Review')),
    client_id TEXT NOT NULL,
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
    id TEXT PRIMARY KEY,
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
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    department TEXT
);

-- 6. ENABLE REALTIME ON ALL TABLES
-- (In Supabase dashboard, you must also check the 'Realtime' box for these tables in Database > Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE behavioural_models;
ALTER PUBLICATION supabase_realtime ADD TABLE yield_curves;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
