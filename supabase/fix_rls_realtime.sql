-- N PRICING SYSTEM: DRASTIC PERMISSION FIX
-- This script grants ALL permissions to anon and authenticated roles to fix error 42501.

-- 1. Permisos Explícitos a Roles y Secuencias (CRÍTICO para BIGSERIAL/IDENTITY)
-- Para audit_log
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE audit_log TO anon, authenticated, service_role;

-- Para yield_curves
GRANT USAGE, SELECT ON SEQUENCE yield_curves_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE yield_curves TO anon, authenticated, service_role;

-- Para deals (ID es texto, no requiere secuencia)
GRANT ALL ON TABLE deals TO anon, authenticated, service_role;

-- 2. Políticas de Acceso Total (Blanket Policies)
-- Asegurar que RLS esté activo pero con una política que permita TODO
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_policy" ON audit_log;
DROP POLICY IF EXISTS "Public Audit Access" ON audit_log;
CREATE POLICY "audit_log_policy" ON audit_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deals_policy" ON deals;
DROP POLICY IF EXISTS "Public Access Deals" ON deals;
CREATE POLICY "deals_policy" ON deals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE yield_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yield_curves_policy" ON yield_curves;
DROP POLICY IF EXISTS "Public Access Curves" ON yield_curves;
CREATE POLICY "yield_curves_policy" ON yield_curves FOR ALL USING (true) WITH CHECK (true);

-- 3. Forzar la publicación en Realtime
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
COMMIT;
