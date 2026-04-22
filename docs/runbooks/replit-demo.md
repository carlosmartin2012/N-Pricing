# Runbook — Demo en Replit

> Cómo arrancar N-Pricing en Replit con datos demo visibles end-to-end.
> Diagnóstico cuando algo no aparece en la UI.

## Expected happy path

1. Usuario pulsa **Run** en Replit.
2. `.replit` ejecuta el workflow `Project` → `Start application` → `npm run dev`.
3. `npm run dev` lanza en paralelo (vía `concurrently`):
   - `vite` en `:5000` (host `0.0.0.0`, `strictPort`).
   - `tsx server/index.ts` en `:3001`.
4. El server:
   1. Lee `DATABASE_URL` (inyectado por el módulo `postgresql-16`).
   2. Ejecuta `runMigrations()` → schema inline + Default Entity
      (`00000000-0000-0000-0000-000000000010`) + `demo@nfq.es` linkado a
      `entity_users`.
   3. Si `SEED_DEMO_ON_BOOT=true`, llama **inline** a `seedDemoDataset(pool)`
      (importado desde `scripts/seed-demo-dataset.ts`) reutilizando el pool
      del server. Cada paso tiene su propio try/catch, así un error en una
      tabla no aborta el resto — verás todos los totales en la consola.
   4. `bootstrapAdapters()` registra in-memory adapters.
   5. `app.listen(3001)`.
5. Vite, al detectar `:5000` activo, satisface `waitForPort = 5000` del workflow
   → la webview se abre.
6. La webview golpea `/` → Vite sirve el bundle.
7. Usuario ve **Login** con:
   - Botón "Continue with your NFQ account" (Google SSO).
   - Sección "Demo access" con formulario `Username` / `Password`.
8. Usuario entra con `demo / n-pricing-demo`.
9. `POST /api/auth/demo` valida credenciales y firma un JWT.
10. La SPA hidrata y muestra Customer Pricing, Pipeline, Blotter,
    Target Grid, Campaigns… poblados.

## Configuración precableada en `.replit`

```toml
[userenv.shared]
VITE_DEMO_USER = "demo"
VITE_DEMO_PASS = "n-pricing-demo"
VITE_DEMO_EMAIL = "demo@nfq.es"
VITE_GOOGLE_CLIENT_ID = "…apps.googleusercontent.com"
SEED_DEMO_ON_BOOT = "true"
```

Replit inyecta `DATABASE_URL` automáticamente porque `modules` incluye
`postgresql-16`. `JWT_SECRET` cae al dev fallback de `server/middleware/auth.ts`
— suficiente para demo, pero no para producción.

## Diagnóstico — síntomas y causas

### 1. La webview se queda en blanco / "Loading…"

- Comprueba la consola de Replit por errores de migration. Una migration
  corrupta o duplicada bloquea `runMigrations()` y el server nunca abre `:3001`.
- Si la consola dice `ECONNREFUSED 3001` desde Vite: el server no ha
  terminado de migrar. Espera 10–20s en la primera arrancada.

### 2. Login muestra **solo** el botón Google (sin formulario demo)

- Causa: `VITE_DEMO_USER` o `VITE_DEMO_PASS` no llegan al bundle. El
  componente `components/ui/Login.tsx:287` renderiza el formulario sólo si
  ambas variables `import.meta.env.VITE_DEMO_*` están truthy.
- Fix: verifica `.replit` `[userenv.shared]` y reinicia el workflow.
  Recuerda que son vars de **build time** — si cambias `.replit`, tienes
  que volver a arrancar (no sólo recargar la pestaña).

### 3. Login rechaza `demo / n-pricing-demo` con 503

- `server/routes/auth.ts:111` devuelve `503 Demo mode not configured` si
  `VITE_DEMO_USER` o `VITE_DEMO_PASS` no están seteados en el **server**
  (no en el bundle). En Replit `[userenv.shared]` setea ambas capas.
- Fix: confirma en la consola que `process.env.VITE_DEMO_PASS` está
  presente. Si no, reinicia el workflow tras editar `.replit`.

### 4. Login rechaza con 401 "Invalid credentials"

- Causa: `username` / `password` no coinciden exactamente con las vars.
  La contraseña es case-sensitive.

### 5. Entras pero todas las vistas están vacías (`No results`)

Causa raíz más común: **seleccionaste un cliente que el seed no poblamos**. El
seed solo crea Customer 360 data (positions / metrics / LTV / NBA) para
**CL-1001** (Acme Corp Industries), **CL-1002** (Globex Retail Group) y
**CL-2001** (John Doe Properties). Los demás clientes que aparecen en la
sidebar (de `seed:clv-demo` u otros) aparecerán vacíos por diseño.

Si **Targets** y **Campaigns** también están vacíos, entonces el seed
falló antes de llegar a methodology/grid. Checks:

1. `SEED_DEMO_ON_BOOT` ¿está a `true` y el workflow reinició **tras** editar
   `.replit`? Las variables de `[userenv.shared]` se leen solo al arrancar.
2. Busca en la consola del server: `[seed-demo-dataset] entity=… reset=…`.
   Si NO aparece, el flag no llegó al proceso Node — reinicia el workflow.
3. Si aparece pero no hay `[seed-demo-dataset] ✅ {…}`, busca líneas
   `[seed-demo-dataset] <step> failed:` — cada paso tiene try/catch y el
   error queda visible.

Fix manual (abre Shell de Replit):

```bash
npm run seed:demo           # Idempotente (ON CONFLICT DO NOTHING)
npm run seed:demo -- --reset # Si quieres limpiar las filas demo antes
```

### 6. El seed falla con `relation "client_positions" does not exist`

- Causa: `server/migrate.ts` inline schema va por detrás de las migrations
  Supabase (Customer 360 live en `20260603000001_customer_360.sql`).
- Fix: aplica la migration Supabase manualmente, o añade el `CREATE TABLE`
  de `client_positions` al schema inline de `server/migrate.ts`.

### 7. El seed falla con tenancy violation

- Causa rara: alguien ha movido `TENANCY_ENFORCE=on` en el entorno Replit.
  El seed se conecta directo con `pg.Pool` sin pasar por el middleware,
  por lo que esto no debería ocurrir — pero si se activa `TENANCY_STRICT`
  + alguna policy llama `get_current_entity_id()` sin session var, falla.
- Fix: desactiva `TENANCY_ENFORCE` y `TENANCY_STRICT` para el workflow
  Replit (demo). Estos flags están pensados para entornos del banco.

### 8. La UI dice "Unauthorized" tras login

- Último fix aplicado en el commit "Fix login and data loading issues for
  demo users" (`4e82826`). El endpoint `/api/auth/demo` ahora emite un JWT
  real y `useInitialHydration.ts` salta la hidratación si no está
  autenticado. Si ves este síntoma de nuevo, confirma que estás en una
  rama que contenga ese fix.

## Cómo re-seedar desde cero

```bash
# Sólo borra las filas demo (deja reference data y deals del usuario)
npx tsx scripts/seed-demo-dataset.ts --reset

# Dry run (enumera sin escribir)
npx tsx scripts/seed-demo-dataset.ts --dry-run

# Target otra entity
npx tsx scripts/seed-demo-dataset.ts --entity-id <uuid>
```

## Cómo desactivar el auto-seed

En `.replit`, `[userenv.shared]`:

```toml
SEED_DEMO_ON_BOOT = "false"
```

Útil cuando apuntas la instancia Replit a una DB productiva (no debería
ocurrir, pero por si acaso — el default en `.env.example` deja esto
comentado).

## Producción

`SEED_DEMO_ON_BOOT` NUNCA debe estar a `true` en producción. Para pasar
del demo de Replit a una entidad real del banco:

1. Provisioning: `tsx scripts/provision-tenant.ts --short-code BANK-ES …`
2. Desactivar `SEED_DEMO_ON_BOOT` y el login demo (borra
   `VITE_DEMO_USER`/`VITE_DEMO_PASS`).
3. Flip `TENANCY_ENFORCE=on`, baked in sobre los integration tests opt-in
   contra la DB target, después `TENANCY_STRICT=on`.

Ver [`phase-0-rollout.md`](../phase-0-rollout.md) para la secuencia completa.
