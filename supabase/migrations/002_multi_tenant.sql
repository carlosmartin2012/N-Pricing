-- Multi-Tenant Support for N-Pricing
-- Adds tenant_id to all data tables for schema-based isolation.
-- Each financial institution gets its own tenant scope.
--
-- Strategy: Column-level isolation (tenant_id on every table)
-- + RLS policies filter by tenant automatically.
--
-- This migration is additive — existing single-tenant data gets
-- assigned to a default tenant 'DEFAULT'.

-- ============================================================
-- SECTION 1: TENANTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  country TEXT DEFAULT 'ES',
  base_currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default tenant for existing data
INSERT INTO tenants (id, name, short_code, country)
VALUES ('DEFAULT', 'Default Institution', 'DEF', 'ES')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 2: ADD tenant_id TO ALL DATA TABLES
-- ============================================================

-- Helper function to add tenant_id column if not exists
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'products', 'business_units', 'deals',
      'rules', 'users', 'behavioural_models', 'yield_curves',
      'rate_cards', 'liquidity_curves', 'esg_transition_grid',
      'esg_physical_grid', 'audit_log', 'pricing_results'
    ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT ''DEFAULT'' REFERENCES tenants(id)',
      tbl
    );
    -- Index for fast tenant filtering
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_tenant ON %I(tenant_id)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================
-- SECTION 3: USER-TENANT ASSOCIATION
-- ============================================================

CREATE TABLE IF NOT EXISTS user_tenants (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL DEFAULT 'Trader' CHECK (role IN ('Admin', 'Trader', 'Risk_Manager', 'Auditor')),
  is_primary BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by TEXT,
  UNIQUE(user_email, tenant_id)
);

ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tenants_read" ON user_tenants
  FOR SELECT TO authenticated
  USING (user_email = auth.jwt()->>'email');

CREATE POLICY "user_tenants_admin_write" ON user_tenants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_email = auth.jwt()->>'email'
      AND ut.tenant_id = user_tenants.tenant_id
      AND ut.role = 'Admin'
    )
  );

-- ============================================================
-- SECTION 4: HELPER FUNCTION FOR TENANT CONTEXT
-- ============================================================

-- Function to get current user's active tenant from JWT or session
CREATE OR REPLACE FUNCTION get_current_tenant() RETURNS TEXT AS $$
BEGIN
  -- First check JWT claim (set by app)
  RETURN COALESCE(
    current_setting('app.current_tenant', true),
    (
      SELECT tenant_id FROM user_tenants
      WHERE user_email = auth.jwt()->>'email'
      AND is_primary = true
      LIMIT 1
    ),
    'DEFAULT'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- SECTION 5: TENANT-SCOPED RLS POLICIES (examples)
-- ============================================================

-- These policies should be applied to each table.
-- Example for deals table:

-- Drop existing broad policies and replace with tenant-scoped ones
-- (In production, you'd carefully migrate existing policies)

-- CREATE POLICY "deals_tenant_read" ON deals
--   FOR SELECT TO authenticated
--   USING (tenant_id = get_current_tenant());

-- CREATE POLICY "deals_tenant_write" ON deals
--   FOR INSERT TO authenticated
--   WITH CHECK (tenant_id = get_current_tenant());

-- CREATE POLICY "deals_tenant_update" ON deals
--   FOR UPDATE TO authenticated
--   USING (tenant_id = get_current_tenant());

-- NOTE: Policies are commented out to avoid breaking existing single-tenant
-- setup. Uncomment and adapt when ready to go multi-tenant.

-- ============================================================
-- SECTION 6: TENANT-SPECIFIC CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_config (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(tenant_id, config_key)
);

ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_config_read" ON tenant_config
  FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant());

CREATE POLICY "tenant_config_admin_write" ON tenant_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.user_email = auth.jwt()->>'email'
      AND ut.tenant_id = tenant_config.tenant_id
      AND ut.role = 'Admin'
    )
  );

-- ============================================================
-- SECTION 7: SEED DEFAULT TENANT CONFIG
-- ============================================================

INSERT INTO tenant_config (tenant_id, config_key, config_value, description) VALUES
  ('DEFAULT', 'approval_matrix', '{"autoApprovalThreshold": 15, "l1Threshold": 10, "l2Threshold": 5}', 'RAROC thresholds for deal approval'),
  ('DEFAULT', 'sdr_config', '{"stableDepositRatio": 0.75, "sdrFloor": 0.60, "sdrImpactMultiplier": 0.8, "externalFundingPct": 0.35}', 'Stable Deposit Ratio modulation'),
  ('DEFAULT', 'lr_config', '{"totalBufferCostBps": 22, "riskAppetiteAddon": 1.3, "buAllocations": {}}', 'Liquidity Recharge allocation'),
  ('DEFAULT', 'base_currency', '"EUR"', 'Default pricing currency'),
  ('DEFAULT', 'session_timeout_hours', '8', 'User session timeout')
ON CONFLICT (tenant_id, config_key) DO NOTHING;
