-- N PRICING SYSTEM: SUPABASE FIXES
-- This script disables RLS and ensures Realtime replication is active for all relevant tables.
-- Execute this in the Supabase SQL Editor.

-- 1. DISABLE RLS TEMPORARILY OR ADD PUBLIC POLICIES
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE behavioural_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE yield_curves DISABLE ROW LEVEL SECURITY;
ALTER TABLE rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. ENSURE PUBLIC ACCESS POLICIES
DO $$ 
DECLARE 
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('deals', 'audit_log', 'behavioural_models', 'yield_curves', 'rules', 'system_config', 'users')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Public Full Access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- 3. ENABLE REALTIME SYNC
-- Check if publication exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE behavioural_models;
ALTER PUBLICATION supabase_realtime ADD TABLE yield_curves;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Ensure audit_log is publicly insertable (even if RLS is re-enabled)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY; -- Briefly enable to set policy
DROP POLICY IF EXISTS "Enable insert for everyone" ON audit_log;
CREATE POLICY "Enable insert for everyone" ON audit_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable select for everyone" ON audit_log FOR SELECT TO public USING (true);
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY; -- Disable again as requested
