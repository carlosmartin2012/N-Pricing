# Guia de Setup: Supabase para N-Pricing

## 1. Crear proyecto

1. Ir a [supabase.com](https://supabase.com) y crear cuenta
2. Crear nuevo proyecto (region: EU West recomendado)
3. Anotar:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOi...` (en Settings > API)
   - **Service Role Key**: solo para Edge Functions, nunca en frontend

## 2. Ejecutar schema

1. Ir a SQL Editor en el dashboard de Supabase
2. Ejecutar `supabase/schema.sql` (crea tablas base: deals, audit_log, etc.)
3. Ejecutar `supabase/schema_v2.sql` (upgrades: reference tables, RLS, workflow)

## 3. Habilitar Realtime

En Database > Replication, habilitar Realtime en estas tablas:
- deals
- clients
- products
- business_units
- rules
- users
- behavioural_models
- yield_curves
- liquidity_curves
- pricing_results

## 4. Configurar autenticacion

1. En Authentication > Providers, habilitar Google OAuth
2. Configurar Google Cloud Console:
   - Crear OAuth Client ID (Web application)
   - Authorized origins: `http://localhost:3000`, `https://tu-dominio.vercel.app`
   - Authorized redirects: `https://xxxxx.supabase.co/auth/v1/callback`
3. Copiar Client ID a `VITE_GOOGLE_CLIENT_ID`

## 5. Variables de entorno

Crear `.env.local`:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_GEMINI_API_KEY=AIza...   # Opcional
VITE_DEMO_USER=demo           # Opcional
VITE_DEMO_PASS=demo           # Opcional
VITE_DEMO_EMAIL=demo@nfq.es   # Opcional
```

## 6. Verificar RLS

Las politicas RLS estan definidas en `schema_v2.sql` Seccion 8.
Para verificar que funcionan:

```sql
-- Como usuario autenticado, deberia poder leer deals
SELECT * FROM deals LIMIT 5;

-- Solo Admin/Risk_Manager deberian poder modificar deals booked
UPDATE deals SET status = 'Draft' WHERE status = 'Booked';
-- Deberia fallar para Trader/Auditor
```

## 7. Migraciones futuras

- `supabase/migrations/001_rule_versioning.sql` — versionado de reglas
- `supabase/migrations/002_multi_tenant.sql` — soporte multi-tenant

Ejecutar en orden en SQL Editor.

## 8. Modo offline

La app funciona sin Supabase usando datos mock de `constants.ts`.
El hook `useSupabaseSync` intenta conectar y cae gracefully a mocks si no hay conexion.

## 9. Edge Functions (futuro)

Para pricing server-side:
```bash
supabase functions deploy pricing
```
Ver `supabase/functions/pricing/index.ts` para la implementacion scaffold.

## 10. Backup y restauracion

```bash
# Backup
pg_dump -h xxxxx.supabase.co -p 5432 -U postgres -d postgres > backup.sql

# Restaurar
psql -h xxxxx.supabase.co -p 5432 -U postgres -d postgres < backup.sql
```
