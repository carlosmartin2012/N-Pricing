# Cabling plan — Módulos comerciales

> **Estado:** plan técnico (no ejecutado).
> **Audiencia:** equipo Eng N-Pricing.
> **Pre-condición:** segmentación de [`modules.md`](./modules.md) validada por
> ≥ 2 prospects independientes. **No ejecutar antes**.

## Objetivo

Cuando los prospects validen la segmentación comercial (Core + 4 módulos),
cablear el producto para que cada tenant vea **sólo** las features de los
módulos que tiene contratados — sin reescribir la taxonomía customer-centric
del sidebar.

Tres layers, ninguno requiere primitiva nueva:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 · CATALOG (pure data, sin lógica)              │
│    lib/modules/catalog.ts                                │
│    Mapea: módulo → views, routes, capabilities          │
│                                                          │
│  Layer 2 · POLICY ENFORCEMENT                           │
│    server/middleware/moduleGate.ts (NUEVO)              │
│    Per-route: rechaza con 403 si el route pertenece a   │
│    un módulo no contratado por el tenant                │
│                                                          │
│  Layer 3 · UX FILTER                                    │
│    appNavigation.ts:buildMainNavItems(t, modules)       │
│    Filtra entries del sidebar según módulos activados   │
│    para el tenant. La taxonomía no cambia, solo qué     │
│    entries se muestran.                                  │
└─────────────────────────────────────────────────────────┘
            │
            └──→ Source of truth: tenant_feature_flags
                 (Phase 5, ya en main)
```

## Estado actual (qué ya existe)

| Primitiva | Ubicación | Estado |
|---|---|---|
| `tenant_feature_flags` table | `supabase/migrations/20260606000001_metering_phase_5.sql` + `server/migrate.ts` | ✅ live, ambos schemas alineados |
| RLS policies | Read = `entity_id ∈ accessible_entity_ids`; Write = `entity_id = current` AND role Admin | ✅ correcto |
| Middleware tenancy | `server/middleware/tenancy.ts` (Phase 0) | ✅ pone `req.tenancy.entityId` en cada request |
| Helper `tenancyScope` / `entityScopedClause` | `server/middleware/requireTenancy.ts` | ✅ usar para queries entity-scoped |
| Sidebar | `appNavigation.ts:buildMainNavItems(t)` | ⚠️ no acepta filter por módulos todavía |
| Per-route guards | No existe `moduleGate` middleware | ❌ a crear |
| API client tipado | `api/index.ts` etc. | ⚠️ no respeta módulos (asume todo accesible) |
| UI "What's included" panel | No existe | ❌ a crear |

## Arquitectura propuesta

### Layer 1 — Catálogo en código

**Archivo nuevo:** `lib/modules/catalog.ts` (~200 líneas, pure data).

```ts
import type { ViewState } from '../../types';

/** Identificadores estables. Se persisten en tenant_feature_flags.flag. */
export type ModuleId =
  | 'core'              // FTP Engine — siempre activo, no se desactiva
  | 'm1-commercial'     // Customer 360 + Pipeline + Campaigns + Targets
  | 'm2-governance'     // Stress + Discipline + Model Inventory + Dossiers + Approvals + …
  | 'm3-channel'        // Channel API + API keys + rate limit
  | 'm4-integrations';  // Adapter pack (Salesforce, Bloomberg, PUZZLE, HOST, ALQUID)

export interface ModuleDefinition {
  id: ModuleId;
  /** Vistas (sidebar entries) que este módulo activa. */
  views: ViewState[];
  /** Path prefijos de rutas Express que requieren este módulo. */
  routePrefixes: string[];
  /** Adapters opcionales activables sólo si este módulo está contratado. */
  adapters?: Array<'salesforce' | 'bloomberg' | 'puzzle' | 'bm-host' | 'alquid'>;
  /** Si `true`, no se puede desactivar. */
  required: boolean;
  /** Human-readable, para "What's included" panel. */
  label: string;
}

export const MODULES: Record<ModuleId, ModuleDefinition> = {
  core: {
    id: 'core',
    label: 'FTP Engine',
    required: true,
    views: ['CALCULATOR', 'RAROC', 'MARKET_DATA', 'BEHAVIOURAL', 'METHODOLOGY',
            'AUDIT_LOG', 'HEALTH', 'MANUAL', 'AI_LAB'],
    routePrefixes: ['/api/pricing', '/api/methodology', '/api/curves',
                    '/api/audit', '/api/snapshots', '/api/auth'],
  },
  'm1-commercial': {
    id: 'm1-commercial',
    label: 'Commercial Pricing',
    required: false,
    views: ['CUSTOMER_360', 'PIPELINE', 'CAMPAIGNS', 'TARGET_GRID'],
    routePrefixes: ['/api/customer360', '/api/campaigns', '/api/clv',
                    '/api/target-grid'],
  },
  'm2-governance': {
    id: 'm2-governance',
    label: 'Risk & Governance',
    required: false,
    views: ['SHOCKS', 'STRESS_PRICING', 'WHAT_IF', 'DISCIPLINE',
            'MODEL_INVENTORY', 'DOSSIERS', 'APPROVALS', 'ESCALATIONS',
            'ATTRIBUTION_MATRIX', 'ATTRIBUTION_REPORTING'],
    routePrefixes: ['/api/governance', '/api/attributions', '/api/stress'],
  },
  'm3-channel': {
    id: 'm3-channel',
    label: 'Channel Pricing',
    required: false,
    views: [], // No sidebar entries; channels se exponen vía API only
    routePrefixes: ['/api/channel'],
  },
  'm4-integrations': {
    id: 'm4-integrations',
    label: 'Integrations Pack',
    required: false,
    views: ['BUDGET_RECONCILIATION', 'RECONCILIATION'],
    routePrefixes: ['/api/admission', '/api/budget', '/api/coreBanking',
                    '/api/reconciliation'],
    adapters: ['salesforce', 'bloomberg', 'puzzle', 'bm-host', 'alquid'],
  },
};

/** Inversa: dado un view, qué módulo lo provee. */
export function moduleForView(view: ViewState): ModuleId | null {
  for (const mod of Object.values(MODULES)) {
    if (mod.views.includes(view)) return mod.id;
  }
  return null;
}

/** Inversa: dado un path Express, qué módulo lo provee. */
export function moduleForRoute(path: string): ModuleId | null {
  for (const mod of Object.values(MODULES)) {
    if (mod.routePrefixes.some((prefix) => path.startsWith(prefix))) return mod.id;
  }
  return null;
}
```

**Por qué este shape:**

- **Pure data, sin lógica condicional.** Mapeos `module → views/routes` y
  funciones inversas. Tests del catálogo son aserciones de tabla,
  determinísticas.
- **`required: true` para Core** evita que un Admin desactive accidentalmente
  Calculator y rompa el producto.
- **Los views ya existen** (no se renombran ni se mueven). El catálogo solo
  los etiqueta por módulo.
- **`adapters` opcional en M4** permite que un tenant active M4 pero solo
  contrate Salesforce + Bloomberg (no PUZZLE/HOST porque no son cliente BM).

### Layer 2 — Policy enforcement (server middleware)

**Archivo nuevo:** `server/middleware/moduleGate.ts`.

```ts
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { moduleForRoute, MODULES, type ModuleId } from '../../lib/modules/catalog';

interface ModuleGateOptions {
  /** Default: lee de tenant_feature_flags. Override útil para tests. */
  resolveModules?: (entityId: string) => Promise<Set<ModuleId>>;
}

const DEFAULT_RESOLVER = async (entityId: string): Promise<Set<ModuleId>> => {
  const rows = await query<{ flag: string }>(
    `SELECT flag FROM tenant_feature_flags
     WHERE entity_id = $1 AND enabled = TRUE
       AND flag LIKE 'module:%'`,
    [entityId],
  );
  const active = new Set<ModuleId>(['core']); // Core siempre activo
  for (const r of rows) {
    const mod = r.flag.replace('module:', '') as ModuleId;
    if (mod in MODULES) active.add(mod);
  }
  return active;
};

/**
 * Per-route guard: si el path requiere un módulo no contratado por el
 * tenant, devuelve 403 module_not_active. NO usar en /api/auth/* ni
 * /health ni rutas que deben ser accesibles antes del login.
 */
export function moduleGate(opts: ModuleGateOptions = {}) {
  const resolve = opts.resolveModules ?? DEFAULT_RESOLVER;
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenancy = req.tenancy;
    if (!tenancy) {
      // No tenancy → tenancyMiddleware aún no resolvió. Dejar pasar;
      // el handler decidirá si rechaza con 400.
      return next();
    }

    const moduleId = moduleForRoute(req.path);
    if (!moduleId) return next(); // Path no mapeado a módulo → no gating

    const active = await resolve(tenancy.entityId);
    if (active.has(moduleId)) return next();

    res.status(403).json({
      code: 'module_not_active',
      message: `This route requires module '${moduleId}', which is not active for your tenant.`,
      module: moduleId,
    });
  };
}
```

**Cabling en `server/index.ts`:**

```ts
// Después de tenancyMiddleware, antes de los routers:
import { moduleGate } from './middleware/moduleGate';
app.use('/api', moduleGate());
```

**Por qué middleware único en lugar de per-router:**

- Single source of truth — el catálogo decide qué route → qué módulo, no
  cada router lo implementa.
- Menos riesgo de olvido cuando se añaden routes nuevas.
- Override testeable vía `resolveModules` en tests.

### Layer 3 — Sidebar filter

**Modificación:** `appNavigation.ts:buildMainNavItems()` y la función
gemela `buildBottomNavItems()`.

```ts
import { MODULES, moduleForView, type ModuleId } from './lib/modules/catalog';

export function buildMainNavItems(
  t: NavigationLabels,
  activeModules?: Set<ModuleId>,
): NavItem[] {
  const all: NavItem[] = [
    /* … entries actuales … */
  ];

  if (!activeModules) return all; // backward-compat: sin filter, todo visible

  return all.filter((item) => {
    const moduleId = moduleForView(item.id as ViewState);
    if (!moduleId) return true; // entry no mapeada → visible (Assistant, etc.)
    return activeModules.has(moduleId);
  });
}
```

**Hook nuevo:** `hooks/useActiveModules.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { ModuleId } from '../lib/modules/catalog';

export function useActiveModules(): Set<ModuleId> {
  const { data } = useQuery({
    queryKey: ['active-modules'],
    queryFn: async () => {
      const r = await fetch('/api/modules/active');
      if (!r.ok) return ['core'];
      return (await r.json()).modules as ModuleId[];
    },
    staleTime: 5 * 60_000, // No cambian frecuentemente
  });
  return new Set(data ?? ['core']);
}
```

**Endpoint nuevo:** `GET /api/modules/active` — devuelve la lista de
módulos del tenant. Misma query que el resolver del middleware.

**Consumer:** `components/ui/Sidebar.tsx` (no en este PR — solo
documentamos la pieza):

```tsx
const modules = useActiveModules();
const mainItems = buildMainNavItems(t, modules);
```

### Layer 0 — Adapters gating (extensión de bootstrap.ts)

`server/integrations/bootstrap.ts` ya tiene la primitiva
`assertMockFallbackAllowed()` (Ola 10.3). Extender para que:

1. Lea los adapters habilitados por `tenant_feature_flags` (no por env vars
   global) en deploys multi-tenant donde cada banco contrata distintos
   adapters.
2. Si M4 no está activo para un tenant, `adapterRegistry.crm()` devuelve
   `null` para ese tenant y los routers de M4 ya devuelven 503 `no_adapter`
   (comportamiento existente).

**Decisión a validar con prospects:** ¿M4 es por-tenant o global por
deploy? Si cada tenant contrata sus propios adapters, esto requiere
adapter registry **per-tenant** (no singleton). Es mucho más complejo.

**Alternativa pragmática (recomendada):** mantener registry global
(deploy-level). Si BBVA contrata Salesforce y Sabadell contrata otro CRM,
se despliega un instance N-Pricing por banco. Esto encaja con la realidad
operativa actual (cada banco tiene su deploy).

---

## Plan ejecutable (5 días dev, 1 sprint)

| Día | Tarea | Owner | Tests |
|---|---|---|---|
| **1** | `lib/modules/catalog.ts` + tests del catálogo (tabla → assert) | Backend | 8-10 unit tests sobre `moduleForView` / `moduleForRoute` / required |
| **1** | Endpoint `GET /api/modules/active` | Backend | 4 tests (con/sin tenancy, con/sin flags, Core siempre presente) |
| **2** | `server/middleware/moduleGate.ts` + cabling en `server/index.ts` | Backend | 6 tests (path matched, no matched, 403 con `module_not_active`, override en tests) |
| **2** | E2E test: tenant con solo Core no puede `GET /api/customer360/clients` (403) | E2E | 2 specs |
| **3** | `hooks/useActiveModules.ts` + caching React Query | Frontend | 2 unit tests |
| **3** | Modificar `buildMainNavItems(t, modules?)` con backward-compat | Frontend | 4 tests adicionales en `appNavigation.test.ts` |
| **4** | Cablear `useActiveModules` en `Sidebar.tsx` + `Sidebar.stories.tsx` con módulos parciales | Frontend | Storybook visual + 1 component test |
| **4** | Panel "What's included" en `/health` o setup screen | Frontend | 1 component test |
| **5** | Migration de seed: poblar `tenant_feature_flags` con `module:core` para tenants existentes | Migration | Integration test (opt-in) |
| **5** | Verify full + rollout doc + runbook ops | All | — |

**Total estimado:** 5 días dev efectivos. Si se incluye QA manual + 2-3 días
de pilot con un tenant interno, sale **~8-10 días end-to-end**.

## Test strategy

### Unit (Vitest)

- `lib/modules/__tests__/catalog.test.ts`:
  - Cada `ModuleId` está en `MODULES`
  - `core.required === true`, resto `false`
  - `moduleForView(view)` retorna el módulo correcto para todos los views existentes
  - `moduleForRoute('/api/customer360/clients')` → `'m1-commercial'`
  - Cada view existente está mapeado a exactamente 1 módulo (no overlap)
  - Cada path prefix es único (no overlap)

- `server/middleware/__tests__/moduleGate.test.ts`:
  - Tenant con todos los módulos → todas las routes pasan
  - Tenant solo Core → `/api/customer360/*` devuelve 403 `module_not_active`
  - Tenant solo Core → `/api/pricing` (Core) pasa
  - Sin tenancy → middleware deja pasar (delega al tenancyMiddleware)
  - Path no mapeado (e.g. `/api/foo`) → middleware deja pasar
  - `resolveModules` override funciona en tests sin DB

- `appNavigation.test.ts` (extender):
  - `buildMainNavItems(t)` sin modules arg → todo visible (backward-compat)
  - `buildMainNavItems(t, new Set(['core']))` → solo Core entries visibles
  - `buildMainNavItems(t, new Set(['core', 'm2-governance']))` → Core + Governance entries

### Integration (opt-in con DB real)

- Tenant A con `module:m1-commercial=true` → API responde 200 a `/api/customer360/clients`
- Tenant A sin esa flag → 403
- Cambiar flag dinámicamente (toggle) y verificar que el siguiente request lo refleja (cache stale + invalidación)

### E2E (Playwright)

- 1 spec por bundle: simular tenants con bundles distintos (Core only, Core+M1, full suite) y verificar que el sidebar muestra solo lo esperado.

## Roll-out plan

### Fase 0 — Seed (sin gating activo)

- Aplicar migration que pobla `tenant_feature_flags` con `module:core=true` para todos los tenants existentes.
- También añadir flags por tenant según contratos actuales (a manopla, hay <10 tenants vivos hoy).
- **Sin moduleGate activo todavía.** Solo data en DB.

### Fase 1 — Read-only enforcement (preview tenants)

- Activar `moduleGate` middleware solo para tenants con flag `enforce_modules=true`.
- Tenants seleccionados (1-2 internos / staging) actúan como canary.
- Si Core falta para un tenant (bug de seed), boot funciona pero requests devuelven 403 — alertable.

### Fase 2 — Full enforcement

- Activar `moduleGate` para todos los tenants (quitar el feature flag `enforce_modules`).
- Sidebar filtrado para todos.
- Panel "What's included" visible en `/health`.

### Fase 3 — Self-service toggle (futuro, no en este sprint)

- Admin del tenant puede ver módulos contratados (read-only).
- NFQ activa/desactiva módulos vía endpoint admin (no self-service para banco).

### Rollback

- Single env var: `MODULE_GATE_DISABLED=true` → middleware se vuelve no-op.
- Sidebar filter: si `useActiveModules` falla, default a "todo visible" (backward-compat preservado).
- Datos en `tenant_feature_flags` persisten — no destructivo.

## Anti-patterns (qué NO hacer)

- ❌ **No crear "module roles" duplicando RBAC.** Los roles ya existen
  (`Admin`, `Risk_Manager`, `Trader`...). Los módulos son ortogonales:
  un Risk_Manager en un tenant que solo contrató Core sigue siendo
  Risk_Manager, pero solo puede usar features Core. Combinar role × module
  en el guard, no fusionarlos.

- ❌ **No mover los `views` entre `MODULES` cada vez que un prospect pide
  algo distinto.** El catálogo es estable. Si un prospect quiere "M1 sin
  Pipeline pero con Targets", eso es un caso de **flag granular** dentro
  de M1 (`module:m1-commercial.pipeline=false`), no una nueva edición.

- ❌ **No partir el código en monorepos por módulo.** Sigue siendo un
  único deploy. La modularidad es de billing/UX, no de build pipeline.

- ❌ **No invalidar la cache de `useActiveModules` en cada request.** Los
  módulos cambian quizás 1 vez al mes. `staleTime: 5min` es suficiente.

- ❌ **No exponer `module:*` flags al cliente como source of truth.** El
  frontend solo lee `/api/modules/active`. La autoridad es server-side; el
  cliente solo gobierna UX (qué entries muestra el sidebar).

## Apéndice — Migración de tenant_feature_flags

Dado que `tenant_feature_flags(entity_id, flag, enabled)` ya existe, el
schema no cambia. La migración solo es **data**:

```sql
-- supabase/migrations/202607XX000001_seed_module_flags.sql
-- Activa Core por defecto para todos los tenants (idempotente).
INSERT INTO tenant_feature_flags (entity_id, flag, enabled, set_by, notes)
SELECT id, 'module:core', TRUE, 'system-seed-modules-2026-07', 'Auto-activated Core'
FROM entities
ON CONFLICT (entity_id, flag) DO NOTHING;

-- Activación de M1/M2/M3/M4 se hace per-tenant manualmente (vía script
-- ops o panel admin). Ejemplo para Banca March:
-- INSERT INTO tenant_feature_flags (entity_id, flag, enabled, set_by, notes)
-- VALUES
--   ('<bm-uuid>', 'module:m1-commercial', TRUE, 'NFQ-onboarding-BM-2026-07', 'Contract'),
--   ('<bm-uuid>', 'module:m2-governance', TRUE, 'NFQ-onboarding-BM-2026-07', 'Contract'),
--   ('<bm-uuid>', 'module:m4-integrations', TRUE, 'NFQ-onboarding-BM-2026-07', 'PUZZLE+HOST+ALQUID');
```

## Apéndice — Scripts ops útiles

```bash
# Activar M2 para un tenant
tsx scripts/activate-module.ts --entity <uuid> --module m2-governance

# Ver módulos contratados por un tenant
tsx scripts/list-modules.ts --entity <uuid>

# Auditar consistencia: tenants sin Core (no debería existir)
tsx scripts/audit-modules.ts
```

(Scripts a crear; outline en este doc, implementación en el sprint.)

## Referencias

- Catálogo comercial: [`modules.md`](./modules.md)
- Primitiva de flags: `supabase/migrations/20260606000001_metering_phase_5.sql`
- Sidebar actual: `appNavigation.ts:buildMainNavItems()`
- Middleware tenancy existente: `server/middleware/tenancy.ts`
- Helper de tenancy scope: `server/middleware/requireTenancy.ts`
- Bootstrap adapters (Ola 10.3 fail-loud): `server/integrations/bootstrap.ts`
