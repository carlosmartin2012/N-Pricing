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
2. Ejecutar `supabase/schema_v2.sql` (schema principal de referencia — incluye tablas, RLS, workflow)
3. Ejecutar migraciones en orden desde `supabase/migrations/`:
   - `20240101000000_initial_schema.sql`
   - `20240201000000_v2_extensions.sql`
   - `20240301000000_rls_policies.sql`
   - `20240401000000_indexes.sql`
   - `20240501000001_rule_versioning.sql`
   - `20240501000002_multi_tenant.sql`
   - `20240501000003_esg_versioning.sql`
   - `20240501000004_yield_curve_history.sql`
   - `20240501000005_deal_comments.sql`
4. Si hay problemas de RLS/Realtime: ejecutar `supabase/fix_rls_realtime.sql`

> **Nota**: `supabase/schema.sql` es legacy — usar `schema_v2.sql` como referencia.

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

## 7. Migraciones

Las migraciones están en `supabase/migrations/` con timestamps como prefijo. Se ejecutan en orden secuencial:

1. Initial schema
2. V2 extensions
3. RLS policies
4. Indexes
5. Rule versioning
6. Multi-tenant support
7. ESG versioning
8. Yield curve history
9. Deal comments

Para nuevas migraciones, crear archivo con formato `YYYYMMDDHHMMSS_nombre.sql`.

## 8. Modo offline

La app funciona sin Supabase usando datos mock de `utils/seedData.ts`.
El sistema de sync (`hooks/supabaseSync/useInitialHydration.ts`) intenta hidratar desde Supabase y cae gracefully a seed data si no hay conexion. La app es una PWA con service worker para soporte offline completo.

Verificar sync seed↔schema: `npm run check:sync`.

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
