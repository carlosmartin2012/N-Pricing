-- N PRICING SYSTEM: FULL REALTIME & PERMISSIONS MIGRATION
-- Activates Realtime and blanket RLS policies for ALL application tables.

-- ============================================================
-- SECTION 1: GRANT permissions to all roles for all tables
-- ============================================================

-- audit_log
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE audit_log TO anon, authenticated, service_role;

-- yield_curves
GRANT USAGE, SELECT ON SEQUENCE yield_curves_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE yield_curves TO anon, authenticated, service_role;

-- deals
GRANT ALL ON TABLE deals TO anon, authenticated, service_role;

-- behavioural_models
GRANT ALL ON TABLE behavioural_models TO anon, authenticated, service_role;

-- rules
GRANT ALL ON TABLE rules TO anon, authenticated, service_role;

-- clients
GRANT ALL ON TABLE clients TO anon, authenticated, service_role;

-- products
GRANT ALL ON TABLE products TO anon, authenticated, service_role;

-- business_units
GRANT ALL ON TABLE business_units TO anon, authenticated, service_role;

-- system_config
GRANT ALL ON TABLE system_config TO anon, authenticated, service_role;

-- users
GRANT ALL ON TABLE users TO anon, authenticated, service_role;

-- ============================================================
-- SECTION 2: BLANKET RLS POLICIES (allow ALL to ALL roles)
-- ============================================================

-- audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_policy" ON audit_log;
DROP POLICY IF EXISTS "Public Audit Access" ON audit_log;
CREATE POLICY "audit_log_policy" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- deals
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals_policy" ON deals;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
CREATE POLICY "deals_policy" ON deals FOR ALL USING (true) WITH CHECK (true);

-- yield_curves
ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yield_curves_policy" ON yield_curves;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "yield_curves_policy" ON yield_curves FOR ALL USING (true) WITH CHECK (true);

-- behavioural_models
ALTER TABLE behavioural_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "behavioural_models_policy" ON behavioural_models;
CREATE POLICY "behavioural_models_policy" ON behavioural_models FOR ALL USING (true) WITH CHECK (true);

-- rules
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules_policy" ON rules;
CREATE POLICY "rules_policy" ON rules FOR ALL USING (true) WITH CHECK (true);

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_policy" ON clients;
CREATE POLICY "clients_policy" ON clients FOR ALL USING (true) WITH CHECK (true);

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_policy" ON products;
CREATE POLICY "products_policy" ON products FOR ALL USING (true) WITH CHECK (true);

-- business_units
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_units_policy" ON business_units;
CREATE POLICY "business_units_policy" ON business_units FOR ALL USING (true) WITH CHECK (true);

-- system_config
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_config_policy" ON system_config;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
CREATE POLICY "system_config_policy" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_policy" ON users;
CREATE POLICY "users_policy" ON users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SECTION 3: REALTIME PUBLICATION for all tables
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

BEGIN;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS audit_log;
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS deals;
    ALTER PUBLICATION supabase_realtime ADD TABLE deals;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS yield_curves;
    ALTER PUBLICATION supabase_realtime ADD TABLE yield_curves;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS behavioural_models;
    ALTER PUBLICATION supabase_realtime ADD TABLE behavioural_models;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS rules;
    ALTER PUBLICATION supabase_realtime ADD TABLE rules;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS clients;
    ALTER PUBLICATION supabase_realtime ADD TABLE clients;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS products;
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS business_units;
    ALTER PUBLICATION supabase_realtime ADD TABLE business_units;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS system_config;
    ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS users;
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
COMMIT;
