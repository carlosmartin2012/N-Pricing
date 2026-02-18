-- N PRICING SYSTEM: SUPABASE FIXES
-- This script disables RLS and ensures Realtime replication is active for all relevant tables.

-- 1. Habilitar permisos para Audit Log y otras tablas
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit Insert Public" ON audit_log;
DROP POLICY IF EXISTS "Audit Select Public" ON audit_log;
CREATE POLICY "Audit Insert Public" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Audit Select Public" ON audit_log FOR SELECT USING (true);

-- 2. Habilitar permisos para el resto del sistema
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
CREATE POLICY "Public Access Deals" ON deals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
CREATE POLICY "Public Access Config" ON system_config FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "Public Access Curves" ON yield_curves FOR ALL USING (true) WITH CHECK (true);

-- Temporally disabling RLS for rules, behavioural_models and users to ensure full access as requested previously
ALTER TABLE rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE behavioural_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 3. IMPORTANTE: Activar Realtime para que los usuarios vean cambios en vivo
-- Check if publication exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE yield_curves;
ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE behavioural_models;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
