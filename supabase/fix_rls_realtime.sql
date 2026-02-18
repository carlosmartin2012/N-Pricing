-- N PRICING SYSTEM: SUPABASE FIXES
-- This script enables public access to audit_log and ensures Realtime replication.

-- 1. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Enable read access for all users" ON audit_log;
DROP POLICY IF EXISTS "Enable insert for all users" ON audit_log;
DROP POLICY IF EXISTS "Audit Insert Public" ON audit_log;
DROP POLICY IF EXISTS "Audit Select Public" ON audit_log;
DROP POLICY IF EXISTS "Enable insert for everyone" ON audit_log;
DROP POLICY IF EXISTS "Enable select for everyone" ON audit_log;

-- 2. Habilitar RLS pero permitir todo el tráfico público para esta tabla específica
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Audit"
ON audit_log FOR SELECT
USING (true);

CREATE POLICY "Public Insert Audit"
ON audit_log FOR INSERT
WITH CHECK (true);

-- 3. Forzar la publicación en Realtime
-- Ensure publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add table to publication (ignore if already added)
BEGIN;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS audit_log;
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
COMMIT;

-- Ensure other tables also have public access as backup/pervious request
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
CREATE POLICY "Public Access Deals" ON deals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
CREATE POLICY "Public Access Config" ON system_config FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "Public Access Curves" ON yield_curves FOR ALL USING (true) WITH CHECK (true);
