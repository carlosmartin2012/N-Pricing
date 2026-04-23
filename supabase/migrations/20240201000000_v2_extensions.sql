-- N PRICING SYSTEM: V2 SCHEMA EXTENSIONS
-- Migration: 20240201000000_v2_extensions
-- Description: Extensions from schema_v2.sql — new tables, altered columns,
--              enhanced constraints, triggers, grants, and seed data.
-- Depends on: 20240101000000_initial_schema

-- ============================================================
-- SECTION 1: ENHANCED REFERENCE DATA TABLES
-- These use IF NOT EXISTS so they are safe to run even if the
-- tables already exist from the initial migration. The v2
-- versions add NOT NULL constraints, new columns, and UNIQUE
-- constraints not present in v1.
-- ============================================================

-- Clients: v2 adds NOT NULL on type, default rating, country, lei_code, updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='country') THEN
        ALTER TABLE clients ADD COLUMN country TEXT DEFAULT 'ES';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lei_code') THEN
        ALTER TABLE clients ADD COLUMN lei_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='updated_at') THEN
        ALTER TABLE clients ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Products: v2 adds NOT NULL on category, default_repricing, description, is_active
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='default_repricing') THEN
        ALTER TABLE products ADD COLUMN default_repricing TEXT DEFAULT 'Fixed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description') THEN
        ALTER TABLE products ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Business Units: v2 adds UNIQUE on code, parent_id, is_funding_unit
DO $$
BEGIN
    -- Add UNIQUE constraint on code if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'business_units' AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE business_units ADD CONSTRAINT business_units_code_key UNIQUE (code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_units' AND column_name='parent_id') THEN
        ALTER TABLE business_units ADD COLUMN parent_id TEXT REFERENCES business_units(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_units' AND column_name='is_funding_unit') THEN
        ALTER TABLE business_units ADD COLUMN is_funding_unit BOOLEAN DEFAULT false;
    END IF;
END $$;

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
    deal_id TEXT NOT NULL,  -- matches deals.id TEXT (see #57 successor)
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
-- SECTION 5: UPDATED_AT TRIGGER
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

-- ============================================================
-- SECTION 6: HELPER FUNCTION FOR RLS
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

-- ============================================================
-- SECTION 7: GRANTS (authenticated only, not anon)
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
-- SECTION 8: REALTIME for new tables
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
-- SECTION 9: SEED REFERENCE DATA
-- ============================================================

-- Seed clients (matching MOCK_CLIENTS in constants.ts)
-- Using deterministic UUIDs since clients.id is now UUID
INSERT INTO clients (id, name, type, segment, rating) VALUES
    ('c1001000-0000-4000-a000-000000001001', 'Industrias Omega S.A.', 'Corporate', 'Large Corporate', 'BBB'),
    ('c1002000-0000-4000-a000-000000001002', 'TechVentures GmbH', 'Corporate', 'Mid-Market', 'BB+'),
    ('c2001000-0000-4000-a000-000000002001', 'Global Shipping Ltd.', 'Corporate', 'Large Corporate', 'B'),
    ('c3001000-0000-4000-a000-000000003001', 'Sovereign Wealth Fund Alpha', 'Institution', 'Institutional', 'AA'),
    ('c4001000-0000-4000-a000-000000004001', 'Green Energy Corp.', 'Corporate', 'Mid-Market', 'A')
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
