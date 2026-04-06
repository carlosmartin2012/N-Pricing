-- N PRICING SYSTEM: ROW LEVEL SECURITY POLICIES
-- Migration: 20240301000000_rls_policies
-- Description: All RLS enable statements and policy definitions.
--              Separated because policies are often modified independently.
-- Depends on: 20240201000000_v2_extensions (for get_user_role function)

-- ============================================================
-- DROP LEGACY POLICIES (from schema.sql blanket USING(true))
-- ============================================================

DROP POLICY IF EXISTS "deals_select_all" ON deals;
DROP POLICY IF EXISTS "deals_insert_active" ON deals;
DROP POLICY IF EXISTS "deals_update_active" ON deals;
DROP POLICY IF EXISTS "audit_read_all" ON audit_log;
DROP POLICY IF EXISTS "audit_insert_only" ON audit_log;
DROP POLICY IF EXISTS "pricing_results_read" ON pricing_results;
DROP POLICY IF EXISTS "pricing_results_insert" ON pricing_results;
DROP POLICY IF EXISTS "rules_read_all" ON rules;
DROP POLICY IF EXISTS "rules_write" ON rules;
DROP POLICY IF EXISTS "users_read_all" ON users;
DROP POLICY IF EXISTS "users_write" ON users;

-- ============================================================
-- DROP V2 POLICIES (idempotent — safe to re-run)
-- ============================================================

DROP POLICY IF EXISTS "deals_policy" ON deals;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
DROP POLICY IF EXISTS "deals_select" ON deals;
DROP POLICY IF EXISTS "deals_insert" ON deals;
DROP POLICY IF EXISTS "deals_update" ON deals;
DROP POLICY IF EXISTS "deals_delete" ON deals;

DROP POLICY IF EXISTS "audit_log_policy" ON audit_log;
DROP POLICY IF EXISTS "Public Audit Access" ON audit_log;
DROP POLICY IF EXISTS "audit_select" ON audit_log;
DROP POLICY IF EXISTS "audit_insert" ON audit_log;

DROP POLICY IF EXISTS "system_config_policy" ON system_config;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
DROP POLICY IF EXISTS "config_select" ON system_config;
DROP POLICY IF EXISTS "config_modify" ON system_config;

DROP POLICY IF EXISTS "clients_policy" ON clients;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_modify" ON clients;

DROP POLICY IF EXISTS "products_policy" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_modify" ON products;

DROP POLICY IF EXISTS "business_units_policy" ON business_units;
DROP POLICY IF EXISTS "bu_select" ON business_units;
DROP POLICY IF EXISTS "bu_modify" ON business_units;

DROP POLICY IF EXISTS "rules_policy" ON rules;
DROP POLICY IF EXISTS "rules_select" ON rules;
DROP POLICY IF EXISTS "rules_modify" ON rules;

DROP POLICY IF EXISTS "yield_curves_policy" ON yield_curves;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
DROP POLICY IF EXISTS "curves_select" ON yield_curves;
DROP POLICY IF EXISTS "curves_modify" ON yield_curves;

DROP POLICY IF EXISTS "behavioural_models_policy" ON behavioural_models;
DROP POLICY IF EXISTS "models_select" ON behavioural_models;
DROP POLICY IF EXISTS "models_modify" ON behavioural_models;

DROP POLICY IF EXISTS "users_policy" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_modify" ON users;

DROP POLICY IF EXISTS "deal_versions_select" ON deal_versions;
DROP POLICY IF EXISTS "deal_versions_insert" ON deal_versions;

DROP POLICY IF EXISTS "rate_cards_select" ON ftp_rate_cards;
DROP POLICY IF EXISTS "rate_cards_modify" ON ftp_rate_cards;

DROP POLICY IF EXISTS "liq_curves_select" ON liquidity_curves;
DROP POLICY IF EXISTS "liq_curves_modify" ON liquidity_curves;

DROP POLICY IF EXISTS "esg_trans_select" ON esg_transition_grid;
DROP POLICY IF EXISTS "esg_trans_modify" ON esg_transition_grid;

DROP POLICY IF EXISTS "esg_phys_select" ON esg_physical_grid;
DROP POLICY IF EXISTS "esg_phys_modify" ON esg_physical_grid;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioural_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ftp_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_curves ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_transition_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_physical_grid ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DEALS POLICIES
-- ============================================================

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

-- ============================================================
-- AUDIT LOG POLICIES
-- ============================================================

-- Everyone can read audit log
CREATE POLICY "audit_select" ON audit_log FOR SELECT
    TO authenticated USING (true);
-- Everyone can insert (logging)
CREATE POLICY "audit_insert" ON audit_log FOR INSERT
    TO authenticated WITH CHECK (true);
-- No updates or deletes on audit log (immutable via trigger)

-- ============================================================
-- PRICING RESULTS POLICIES
-- ============================================================

-- Read all, insert only (no updates/deletes)
CREATE POLICY "pricing_results_read" ON pricing_results FOR SELECT USING (true);
CREATE POLICY "pricing_results_insert" ON pricing_results FOR INSERT WITH CHECK (true);

-- ============================================================
-- SYSTEM CONFIG POLICIES
-- ============================================================

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

-- ============================================================
-- REFERENCE DATA POLICIES (clients, products, business_units, rules)
-- Read: all authenticated. Write: Admin/Risk_Manager only.
-- ============================================================

-- clients
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_modify" ON clients FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- products
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_modify" ON products FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- business_units
CREATE POLICY "bu_select" ON business_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "bu_modify" ON business_units FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- rules
CREATE POLICY "rules_select" ON rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_modify" ON rules FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- yield_curves
CREATE POLICY "curves_select" ON yield_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "curves_modify" ON yield_curves FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- behavioural_models
CREATE POLICY "models_select" ON behavioural_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "models_modify" ON behavioural_models FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- users
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_modify" ON users FOR ALL TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- deal_versions
CREATE POLICY "deal_versions_select" ON deal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_versions_insert" ON deal_versions FOR INSERT TO authenticated WITH CHECK (true);

-- ftp_rate_cards
CREATE POLICY "rate_cards_select" ON ftp_rate_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "rate_cards_modify" ON ftp_rate_cards FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- liquidity_curves
CREATE POLICY "liq_curves_select" ON liquidity_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "liq_curves_modify" ON liquidity_curves FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

-- esg grids
CREATE POLICY "esg_trans_select" ON esg_transition_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_trans_modify" ON esg_transition_grid FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));

CREATE POLICY "esg_phys_select" ON esg_physical_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_phys_modify" ON esg_physical_grid FOR ALL TO authenticated
    USING (get_user_role() IN ('Admin', 'Risk_Manager'))
    WITH CHECK (get_user_role() IN ('Admin', 'Risk_Manager'));
