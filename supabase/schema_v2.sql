-- LEGACY: This file is kept for reference. Use supabase/migrations/ for all schema changes.
--
-- N PRICING SYSTEM: DATABASE SCHEMA V2
-- Run this AFTER schema.sql to upgrade to production-ready schema.
-- Adds: clients, products, business_units tables, FK constraints,
-- deal workflow columns, deal_versions, indexes, and proper RLS.

-- ============================================================
-- SECTION 1: REFERENCE DATA TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Corporate', 'Retail', 'SME', 'Institution', 'Gov')),
    segment TEXT,
    rating TEXT NOT NULL DEFAULT 'BBB',
    country TEXT DEFAULT 'ES',
    lei_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Asset', 'Liability', 'Off-Balance')),
    default_amortization TEXT DEFAULT 'Bullet',
    default_repricing TEXT DEFAULT 'Fixed',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    parent_id TEXT REFERENCES business_units(id),
    is_funding_unit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 2: DEAL WORKFLOW COLUMNS
-- ============================================================

-- Add workflow and versioning columns to deals
DO $$
BEGIN
    -- Expand status to include workflow states
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;
    ALTER TABLE deals ADD CONSTRAINT deals_status_check
        CHECK (status IN ('Draft', 'Pending', 'Pending_Approval', 'Approved', 'Booked', 'Rejected', 'Review'));

    -- Version tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='version') THEN
        ALTER TABLE deals ADD COLUMN version INTEGER DEFAULT 1;
    END IF;

    -- Pricing lock-in
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='locked_at') THEN
        ALTER TABLE deals ADD COLUMN locked_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='locked_by') THEN
        ALTER TABLE deals ADD COLUMN locked_by TEXT;
    END IF;

    -- Approval workflow
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='approved_by') THEN
        ALTER TABLE deals ADD COLUMN approved_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='approved_at') THEN
        ALTER TABLE deals ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;

    -- Frozen pricing snapshot at booking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='pricing_snapshot') THEN
        ALTER TABLE deals ADD COLUMN pricing_snapshot JSONB;
    END IF;

    -- Additional fields for complete deal data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='category') THEN
        ALTER TABLE deals ADD COLUMN category TEXT DEFAULT 'Asset';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='lcr_outflow_pct') THEN
        ALTER TABLE deals ADD COLUMN lcr_outflow_pct NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='is_operational_segment') THEN
        ALTER TABLE deals ADD COLUMN is_operational_segment BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='undrawn_amount') THEN
        ALTER TABLE deals ADD COLUMN undrawn_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='created_by') THEN
        ALTER TABLE deals ADD COLUMN created_by TEXT;
    END IF;
END $$;

-- ============================================================
-- SECTION 3: DEAL VERSIONS TABLE (audit trail)
-- ============================================================

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

-- ============================================================
-- SECTION 4: FTP RATE CARDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ftp_rate_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Liquidity', 'Basis', 'Commercial', 'Credit')),
    currency TEXT DEFAULT 'USD',
    points JSONB NOT NULL, -- Array of {tenor, rate}
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 5: ESG GRIDS
-- ============================================================

CREATE TABLE IF NOT EXISTS esg_transition_grid (
    id SERIAL PRIMARY KEY,
    classification TEXT NOT NULL CHECK (classification IN ('Brown', 'Amber', 'Neutral', 'Green')),
    sector TEXT,
    adjustment_bps NUMERIC NOT NULL DEFAULT 0,
    description TEXT
);

CREATE TABLE IF NOT EXISTS esg_physical_grid (
    id SERIAL PRIMARY KEY,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('High', 'Medium', 'Low')),
    location_type TEXT,
    adjustment_bps NUMERIC NOT NULL DEFAULT 0,
    description TEXT
);

-- ============================================================
-- SECTION 6: LIQUIDITY CURVES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS liquidity_curves (
    id BIGSERIAL PRIMARY KEY,
    currency TEXT NOT NULL,
    as_of_date DATE DEFAULT CURRENT_DATE,
    points JSONB NOT NULL, -- Array of {tenor, wholesaleSpread, termLP}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 7: PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_business_unit ON deals(business_unit);
CREATE INDEX IF NOT EXISTS idx_deals_product_type ON deals(product_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);

CREATE INDEX IF NOT EXISTS idx_yield_curves_currency_date ON yield_curves(currency, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_rules_bu_product ON rules(business_unit, product);

CREATE INDEX IF NOT EXISTS idx_deal_versions_deal ON deal_versions(deal_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_clients_rating ON clients(rating);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);

-- ============================================================
-- SECTION 8: PROPER RLS POLICIES
-- (Replaces the blanket USING(true) policies)
-- ============================================================

-- Helper function: get user role from users table
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM users
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- DEALS ---
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals_policy" ON deals;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
-- Authenticated users can read all deals
CREATE POLICY "deals_select" ON deals FOR SELECT
    TO authenticated USING (true);
-- Authenticated users can insert deals
CREATE POLICY "deals_insert" ON deals FOR INSERT
    TO authenticated WITH CHECK (true);
-- Authenticated users can update non-booked deals (booked deals are locked)
CREATE POLICY "deals_update" ON deals FOR UPDATE
    TO authenticated USING (
        status != 'Booked'
        OR get_user_role() IN ('Admin', 'Risk_Manager')
    );
-- Only Admin/Risk_Manager can delete deals
CREATE POLICY "deals_delete" ON deals FOR DELETE
    TO authenticated USING (
        get_user_role() IN ('Admin', 'Risk_Manager')
    );

-- --- AUDIT LOG ---
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_policy" ON audit_log;
DROP POLICY IF EXISTS "Public Audit Access" ON audit_log;
-- Everyone can read audit log
CREATE POLICY "audit_select" ON audit_log FOR SELECT
    TO authenticated USING (true);
-- Everyone can insert (logging)
CREATE POLICY "audit_insert" ON audit_log FOR INSERT
    TO authenticated WITH CHECK (true);
-- No updates or deletes on audit log (immutable)

-- --- SYSTEM CONFIG ---
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_config_policy" ON system_config;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
-- Everyone can read config
CREATE POLICY "config_select" ON system_config FOR SELECT
    TO authenticated USING (true);
-- Only Admin can modify config
CREATE POLICY "config_modify" ON system_config FOR ALL
    TO authenticated USING (
        get_user_role() = 'Admin'
    ) WITH CHECK (
        get_user_role() = 'Admin'
    );

-- --- REFERENCE DATA (clients, products, business_units, rules) ---
-- Read: all authenticated. Write: Admin/Risk_Manager only.

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_policy" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_modify" ON clients FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_policy" ON products;
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_modify" ON products FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- business_units
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_units_policy" ON business_units;
CREATE POLICY "bu_select" ON business_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "bu_modify" ON business_units FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- rules
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules_policy" ON rules;
CREATE POLICY "rules_select" ON rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_modify" ON rules FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- yield_curves
ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yield_curves_policy" ON yield_curves;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "curves_select" ON yield_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "curves_modify" ON yield_curves FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- behavioural_models
ALTER TABLE behavioural_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "behavioural_models_policy" ON behavioural_models;
CREATE POLICY "models_select" ON behavioural_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "models_modify" ON behavioural_models FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_policy" ON users;
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_modify" ON users FOR ALL TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- deal_versions
ALTER TABLE deal_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_versions_select" ON deal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_versions_insert" ON deal_versions FOR INSERT TO authenticated WITH CHECK (true);

-- ftp_rate_cards
ALTER TABLE ftp_rate_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_cards_select" ON ftp_rate_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "rate_cards_modify" ON ftp_rate_cards FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- liquidity_curves
ALTER TABLE liquidity_curves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liq_curves_select" ON liquidity_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "liq_curves_modify" ON liquidity_curves FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- esg grids
ALTER TABLE esg_transition_grid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esg_trans_select" ON esg_transition_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_trans_modify" ON esg_transition_grid FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

ALTER TABLE esg_physical_grid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esg_phys_select" ON esg_physical_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_phys_modify" ON esg_physical_grid FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- ============================================================
-- SECTION 9: GRANTS (authenticated only, not anon)
-- ============================================================

-- Revoke anon access from sensitive tables
REVOKE ALL ON TABLE deals FROM anon;
REVOKE ALL ON TABLE audit_log FROM anon;
REVOKE ALL ON TABLE system_config FROM anon;
REVOKE ALL ON TABLE users FROM anon;

-- Grant to authenticated and service_role
GRANT ALL ON TABLE clients TO authenticated, service_role;
GRANT ALL ON TABLE products TO authenticated, service_role;
GRANT ALL ON TABLE business_units TO authenticated, service_role;
GRANT ALL ON TABLE deal_versions TO authenticated, service_role;
GRANT ALL ON TABLE ftp_rate_cards TO authenticated, service_role;
GRANT ALL ON TABLE esg_transition_grid TO authenticated, service_role;
GRANT ALL ON TABLE esg_physical_grid TO authenticated, service_role;
GRANT ALL ON TABLE liquidity_curves TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE deal_versions_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE esg_transition_grid_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE esg_physical_grid_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE liquidity_curves_id_seq TO authenticated, service_role;

-- ============================================================
-- SECTION 10: REALTIME for new tables
-- ============================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE clients;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE business_units;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE deal_versions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ftp_rate_cards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE liquidity_curves;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SECTION 11: SEED REFERENCE DATA
-- ============================================================

-- Seed clients (matching MOCK_CLIENTS in constants.ts)
INSERT INTO clients (id, name, type, segment, rating) VALUES
    ('CL-1001', 'Industrias Omega S.A.', 'Corporate', 'Large Corporate', 'BBB'),
    ('CL-1002', 'TechVentures GmbH', 'Corporate', 'Mid-Market', 'BB+'),
    ('CL-2001', 'Global Shipping Ltd.', 'Corporate', 'Large Corporate', 'B'),
    ('CL-3001', 'Sovereign Wealth Fund Alpha', 'Institution', 'Institutional', 'AA'),
    ('CL-4001', 'Green Energy Corp.', 'Corporate', 'Mid-Market', 'A')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    segment = EXCLUDED.segment,
    rating = EXCLUDED.rating;

-- Seed products (matching MOCK_PRODUCTS in constants.ts)
INSERT INTO products (id, name, category, default_amortization) VALUES
    ('LOAN_COMM', 'Commercial Loan', 'Asset', 'Bullet'),
    ('LOAN_MORTG', 'Mortgage Loan', 'Asset', 'French'),
    ('CRED_LINE', 'Credit Line', 'Off-Balance', 'Bullet'),
    ('DEP_TERM', 'Term Deposit', 'Liability', 'Bullet'),
    ('DEP_DEMAND', 'Demand Deposit', 'Liability', 'Bullet'),
    ('BOND_CORP', 'Corporate Bond', 'Asset', 'Bullet'),
    ('GUARANTEE', 'Bank Guarantee', 'Off-Balance', 'Bullet')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category;

-- Seed business units (matching MOCK_BUSINESS_UNITS in constants.ts)
INSERT INTO business_units (id, name, code, is_funding_unit) VALUES
    ('BU-001', 'Corporate Banking', 'CB', false),
    ('BU-002', 'Retail Banking', 'RB', false),
    ('BU-003', 'Investment Banking', 'IB', false),
    ('BU-900', 'Central Treasury', 'CT', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    is_funding_unit = EXCLUDED.is_funding_unit;

-- Seed ESG transition grid
INSERT INTO esg_transition_grid (classification, sector, adjustment_bps, description) VALUES
    ('Brown', 'Oil & Gas', 25, 'High carbon intensity sector'),
    ('Amber', 'Manufacturing', 10, 'Transitioning sector'),
    ('Neutral', 'Services', 0, 'Low direct emissions'),
    ('Green', 'Renewable Energy', -15, 'Green taxonomy aligned')
ON CONFLICT DO NOTHING;

-- Seed ESG physical grid
INSERT INTO esg_physical_grid (risk_level, location_type, adjustment_bps, description) VALUES
    ('High', 'Coastal Flood Zone', 20, 'High physical risk area'),
    ('Medium', 'Moderate Climate Risk', 8, 'Some climate exposure'),
    ('Low', 'Low Risk Region', 0, 'Minimal physical risk')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 12: UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
