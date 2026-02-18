-- N PRICING SYSTEM: SUPABASE FIXES
-- This script enables public access for 'anon' users to the audit_log and deals tables.

-- 1. Permisos para el rol anónimo (anon)
-- Supabase usa el rol anon para peticiones sin JWT o con la anon key
GRANT SELECT, INSERT ON TABLE audit_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE deals TO anon;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO anon;

-- 2. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Enable read access for all users" ON audit_log;
DROP POLICY IF EXISTS "Enable insert for all users" ON audit_log;
DROP POLICY IF EXISTS "Audit Insert Public" ON audit_log;
DROP POLICY IF EXISTS "Audit Select Public" ON audit_log;
DROP POLICY IF EXISTS "Public Audit Access" ON audit_log;

-- 3. Habilitar RLS pero permitir todo el tráfico para 'anon'
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Audit Access" 
ON audit_log FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 4. Forzar la publicación en Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

BEGIN;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS audit_log;
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
COMMIT;

-- 5. Asegurar acceso a otras tablas para anon
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
CREATE POLICY "Public Access Deals" ON deals FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Config" ON system_config;
CREATE POLICY "Public Access Config" ON system_config FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "Public Access Curves" ON yield_curves FOR ALL TO anon USING (true) WITH CHECK (true);
