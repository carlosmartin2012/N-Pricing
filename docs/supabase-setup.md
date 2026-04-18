# Guia de Setup: Supabase para N-Pricing

## 1. Crear proyecto

1. Ir a [supabase.com](https://supabase.com) y crear cuenta
2. Crear nuevo proyecto (region: EU West recomendado)
3. Anotar:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOi...` (en Settings > API)
   - **Service Role Key**: solo para Edge Functions, nunca en frontend

## 2. Ejecutar schema

La **fuente de verdad operativa** es la secuencia ordenada de ficheros en
`supabase/migrations/`, aplicada al arranque por `server/migrate.ts`.

**Opción A — boot local / dev (recomendada):** arrancar el servidor con
`npm run dev` — `server/migrate.ts` corre todas las migrations en orden
idempotentemente. No ejecutar SQL a mano.

**Opción B — aplicar sobre un Supabase remoto:** desde el SQL Editor
aplicar los ficheros de `supabase/migrations/*.sql` **en orden alfabético**
(el prefijo `YYYYMMDDHHMMSS_` garantiza la secuencia). Hay ~36 ficheros.
Si hay problemas de RLS/Realtime en un proyecto pre-existente:
`supabase/fix_rls_realtime.sql`.

> **Archivos de referencia (no ejecutables):**
> - `supabase/schema.sql` está marcado `LEGACY — DO NOT EXECUTE` en su
>   cabecera; pre-dates tenancy, workflow y todo Phase 0-5. Solo referencia
>   histórica.
> - `supabase/schema_v2.sql` es un snapshot intermedio. Sigue siendo útil
>   como fallback para onboarding y lo lee `scripts/check-seed-schema-sync.ts`,
>   pero las policies RLS y tablas nuevas viven solo en migrations.

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

Las políticas RLS canónicas viven en `supabase/migrations/` —
`20260406000001_multi_entity.sql` aplica las políticas entity-scoped sobre
las tablas de negocio; migrations posteriores (`20260411000002_rls_hardening.sql`,
`20260602000002_rls_delete_policies.sql`, `20260602000007_olas_1_3_rls_hardening.sql`)
refinan y extienden. `schema_v2.sql` §8 conserva el baseline histórico pero
**no** es la fuente de verdad actual — ver
[`docs/rls-audit-2026-04.md`](./rls-audit-2026-04.md).

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
