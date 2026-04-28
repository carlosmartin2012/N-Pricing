# Ola 6 — Tenancy strict global + pricing bajo estrés

> **Estado:** ✅ **Completa (código)** — 2026-04-23 · **Creado:** 2026-04-19 · **Predecesor:** [`integral-review-2026-04-18.md`](./integral-review-2026-04-18.md) §3 Ola 6
> **Dependencias cerradas:** PR [#6](https://github.com/carlosmartin2012/N-Pricing/pull/6) (EntityOnboarding split + `.env.example`) · PR [#7](https://github.com/carlosmartin2012/N-Pricing/pull/7) (guard `requireTenancy()` mode-aware)
> **Esta ola NO es:** un motor IRRBB regulatorio (ΔEVE, SOT, NII runoff). Ver §"Fuera de scope".
>
> ## Estado por bloque (2026-04-28)
>
> | Bloque | Pieza | Estado | PR |
> |---|---|---|---|
> | **A — Tenancy strict** | Runbook flip | ✅ | #8 |
> | A | Seed alertas como migration | ✅ | [#44](https://github.com/carlosmartin2012/N-Pricing/pull/44) |
> | A | SLOPanel widget `Tenancy violations · last 60m` | ✅ | [#45](https://github.com/carlosmartin2012/N-Pricing/pull/45) |
> | A | Provision-tenant hook (seed en creación) | ✅ | [#49](https://github.com/carlosmartin2012/N-Pricing/pull/49) |
> | A | Runbook refresh (auto-prereqs) | ✅ | [#52](https://github.com/carlosmartin2012/N-Pricing/pull/52) |
> | A | Flip `TENANCY_ENFORCE=on` canary → prod | 🟡 **ops decision** | — |
> | **B — Stress Pricing** | B.1 tipo `ShockScenario` + B.2 presets EBA | ✅ | #38 (pre-sesión) |
> | B | B.3 `MarketDataAdapter.fetchShockedCurve` | ✅ | #39 (pre-sesión) |
> | B | B.4 motor honra `curveShiftBps` (flag-gated) | ✅ | #40 (pre-sesión) |
> | B | B.5 vista `/stress-pricing` | ✅ | [#42](https://github.com/carlosmartin2012/N-Pricing/pull/42) |
> | B | B.6 `pricing_snapshots.scenario_id/source` | ✅ | #41 (pre-sesión) |
> | B | Playwright e2e | ✅ | [#67](https://github.com/carlosmartin2012/N-Pricing/pull/67) |
> | B | Storybook story `StressPricingView` | ✅ | [#70](https://github.com/carlosmartin2012/N-Pricing/pull/70) |
> | **C — Hash chain** | Schema + UNIQUE + verifier + endpoint | ✅ | [#43](https://github.com/carlosmartin2012/N-Pricing/pull/43) |
> | C | Edge writer (retry + chain) | ✅ | [#47](https://github.com/carlosmartin2012/N-Pricing/pull/47) |
> | C | Backfill histórico (opt-in script) | ✅ | [#68](https://github.com/carlosmartin2012/N-Pricing/pull/68) |
> | **D — Market benchmarks** | Route + seed + chip + CSV importer | ✅ | #37 (pre-sesión) |
> | D | Vista admin CRUD (D2) + auto-ingest (D3) | ❌ follow-up | — |
>
> **Conclusión:** Ola 6 cerrada al 100% en código (incluyendo polish e2e + Storybook + backfill histórico). Sólo pendiente la decisión operativa del flip `TENANCY_STRICT=on` en producción y los follow-ups del bloque D (admin UI CRUD + auto-ingest), ambos bloqueados por input externo / decisión ops.
>
> **Siguiente ola:** [`ola-7-collaborative-ux.md`](./ola-7-collaborative-ux.md) (plan).

---

## 0. TL;DR

Dos bloques ortogonales que comparten ventana de 4-6 semanas:

1. **Tenancy strict global** (1-1.5 sem) — flip `TENANCY_ENFORCE=on` → `TENANCY_STRICT=on` en producción siguiendo las 4 fases de [`phase-0-rollout.md`](./phase-0-rollout.md). Cobra el ROI del trabajo ya mergeado.
2. **Pricing bajo estrés** (3-4 sem) — ampliar `PricingShocks` de `{interestRate, liquiditySpread}` a los 6 escenarios EBA GL 2018/02 **como inputs ricos al motor de pricing**, con ingesta de curvas shockeadas vía `MarketDataAdapter.fetchShockedCurve`. Vista nueva *Stress Pricing* (6 escenarios × FTP/margen/RAROC). **No se calcula ΔEVE, no se calcula SOT.**
3. **Snapshot hash chain** (0.5 sem) — añadir `prev_output_hash` a `pricing_snapshots` para tamper evidence retroactiva.

Entregable único mergeable: cada bloque llega a main por separado, sin interdependencias fuertes.

---

## 1. Bloque A — Tenancy strict global

### Objetivo

Que `get_current_entity_id()` en Postgres **raise** si un code path olvida `SET LOCAL app.current_entity_id`, en vez de caer silenciosamente a Default Entity. Esta es la garantía regulatoria que cierra el círculo multi-tenant.

### Pre-condiciones (todas verificadas al 2026-04-19)

- ✅ Todos los routers entity-scoped consumen `req.tenancy` (`config`, `deals`, `audit` migrados en PR #5).
- ✅ Guard `requireTenancy()` montado en cadena `entityScoped` (PR #7). Cualquier router nuevo sin `req.tenancy` produce 500 `tenancy_guard_missing`.
- ✅ `withTenancyTransaction` existe y propaga `SET LOCAL`.
- ✅ Integration tests `utils/__tests__/integration/legacyRouteTenancy.integration.test.ts` (7 specs) cubren cross-entity reads/writes.

### Secuencia de rollout (4 fases)

Tal como documentado en [`phase-0-rollout.md`](./phase-0-rollout.md), sin desviación:

| Fase | Env | Ventana | Criterio de avance |
|---|---|---|---|
| 1 — Land migrations | sin flags | deploy estándar | build verde |
| 2 — Warn mode | `TENANCY_ENFORCE=on` en 1 entorno | 24-48 h | `tenancy_violations` por `endpoint` agrupado; cero violations de código interno durante 24 h consecutivas |
| 3 — Prod config lock | + `PRICING_ALLOW_MOCKS=false` | 24 h | Ningún tenant dispara `configuration_incomplete` en prod |
| 4 — Strict DB | + `TENANCY_STRICT=on` | irreversible funcionalmente | Smoke test de los 12 routers + alerta `tenancy_not_set` al 0 durante 1 h |

### Trabajo técnico

Ninguno obligatorio en código del servidor — los routers ya cumplen. Lo que sí hace falta:

1. **Runbook de flip** (30 min) — `docs/runbooks/tenancy-strict-flip.md` con los comandos exactos (Vercel env set, rollback plan, query para monitorizar violations).
2. **Dashboard canary** (2-3 h) — panel en `components/Admin/SLOPanel.tsx` que lea `tenancy_violations` último 1 h. Ya existe la tabla; falta surfacear.
3. **Alerta PagerDuty** (1 h) — seed de regla `tenancy_violation` según tabla en rollout guide.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Cliente (web/mobile/Edge) no envía `x-entity-id` en alguna ruta nueva | La fase 2 (warn) caza los casos antes de strict. |
| Edge Function de pricing usa service role sin `SET LOCAL` | Ya validado en PR #5; hay test de integración. |
| Cron jobs (`realize-raroc`, `elasticity-recalibrate`) sin `entity_id` | Scopear cada schedule con `?entity_id=<uuid>` tal como documenta rollout guide §"Cron function scoping". |

### Entregables

- `docs/runbooks/tenancy-strict-flip.md` (nuevo)
- `components/Admin/SLOPanel.tsx` con widget de violations
- Seed de alert rules en `supabase/migrations/20260619000001_tenancy_alerts_seed.sql`
- PR independiente, mergeable sin Bloque B.

---

## 2. Bloque B — Pricing bajo estrés

### Objetivo

Permitir que el usuario (trader / producto / risk officer comercial) pregunte "¿cómo se mueve mi FTP, margen y RAROC si la curva hace steepener / parallel +200 / flattener?" directamente en Calculator y en una vista nueva *Stress Pricing*. Es **price-testing**, no ΔEVE regulatorio.

### Por qué NO es IRRBB

| Dimensión | Motor IRRBB (Wolters Kluwer / Moody's / SAS / FIS) | Ola 6 Bloque B |
|---|---|---|
| Output principal | ΔEVE, ΔNII, SOT | FTP, margen comercial, RAROC |
| Horizonte | 1Y/2Y con runoff / constant BS | As-of-date spot |
| Scope | Cartera banking book revaluada | Deal o portfolio de deals en pricing |
| Buyer persona | CRO, ALM, Risk Committee | Treasury comercial, Producto |
| Regulación | EBA GL 2018/02, CRR3 art. 84-87 | Ninguna — es pricing interno |

Si el banco necesita ΔEVE/SOT, ya tiene el motor ALM. N-Pricing **consume** la señal (curvas shockeadas) vía adapter.

### Cambios técnicos

#### B.1 — Tipo `ShockScenario` como input rico

Actual (`utils/pricingEngine.ts:74-82`):

```typescript
export interface PricingShocks {
  interestRate: number;   // bps
  liquiditySpread: number; // bps
}
```

Propuesto (retrocompatible vía type union):

```typescript
// types/pricingShocks.ts (nuevo)
export type ShockScenarioId =
  | 'parallel_up_200'
  | 'parallel_down_200'
  | 'short_up_250'
  | 'short_down_250'
  | 'steepener'
  | 'flattener'
  | 'custom';

export interface ShockScenario {
  id: ShockScenarioId;
  label: string;
  // Impacto per-tenor (bps). Null = usa interestRate uniforme (retrocompatible).
  curveShiftBps: Partial<Record<'1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | '20Y', number>> | null;
  // Legacy para retrocompatibilidad — se sigue respetando.
  interestRate: number;
  liquiditySpread: number;
  // Metadata para snapshot.
  source: 'preset_eba_2018_02' | 'market_adapter' | 'user_custom';
}

// Mantener `PricingShocks` como alias a la forma mínima (compatibilidad).
export type PricingShocks = Pick<ShockScenario, 'interestRate' | 'liquiditySpread'>;
```

#### B.2 — Presets EBA GL 2018/02

6 escenarios hardcodeados en `utils/pricing/shockPresets.ts`, con `curveShiftBps` completo por tenor. Los valores parallel/short vienen de la guía EBA; steepener/flattener usan la fórmula del Anexo III (decay exponencial por tenor).

Reutilizar `QUICK_SHOCK_SCENARIOS` en `components/Risk/shockUtils.ts` — promocionar ese array al nivel de `utils/` y reemplazar las presets visuales actuales con los valores EBA.

#### B.3 — Ingesta de curvas shockeadas

Ampliar `integrations/types.ts`:

```typescript
export interface MarketDataAdapter {
  // existing methods...
  fetchShockedCurve(
    scenarioId: ShockScenarioId,
    asOfDate: string,
  ): Promise<AdapterResult<YieldCurve>>;
}
```

- **Reference in-memory adapter** (`integrations/inMemory.ts`): aplica el `curveShiftBps` del preset EBA a la curva base en memoria.
- **Stub Bloomberg** (`integrations/marketData/bloomberg.ts`): firma del método con `fail('unreachable', …)` — ya usa ese patrón.

No se introduce lógica de cálculo de curvas propia. N-Pricing **consume**, no genera.

#### B.4 — Motor consume scenarios

`pricingEngine.ts` acepta opcionalmente un `ShockScenario` completo además del `PricingShocks` legacy. Si viene `curveShiftBps`, se aplica **por tenor** en `interpolateYieldCurve` en lugar del shift uniforme actual.

**Caso crítico de preservar invariantes:** los snapshots existentes (hasta ~972 tests + integration) asumen la forma `{interestRate, liquiditySpread}`. El nuevo campo es opcional; si `curveShiftBps === null` el motor opera exactamente igual. Todos los tests deben seguir en verde sin tocar.

#### B.5 — Vista *Stress Pricing*

Nueva vista `components/StressPricing/StressPricingView.tsx`, entrada en `appNavigation.ts` bajo el grupo "Risk" (no crear grupo nuevo). Layout:

- Selector de deal (o portfolio de deals del blotter filtrados).
- Tabla 6×4:
  - Filas: 6 presets EBA + opción "Custom".
  - Columnas: `FTP`, `ΔFTP (bps)`, `Margin`, `ΔMargin (bps)`, `RAROC`, `ΔRAROC (pp)`.
- Cada celda muestra valor absoluto + delta vs base.
- Botón "Export to CSV" reutilizando `utils/configExport.ts`.
- **No** se muestran EVE/NII/SOT — son "not applicable" y se marca explícitamente en la nota al pie para que el usuario no confunda con IRRBB.

#### B.6 — Snapshots cubren scenario

`pricing_snapshots.input` JSONB ya es abierto. Añadir:

- Nuevo campo `scenario_id` (indexed) y `scenario_source` para agregación por escenario en SLO view.
- Migration `20260619000002_pricing_snapshots_scenario.sql`:

```sql
ALTER TABLE pricing_snapshots
  ADD COLUMN IF NOT EXISTS scenario_id      TEXT,
  ADD COLUMN IF NOT EXISTS scenario_source  TEXT;

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_scenario
  ON pricing_snapshots (entity_id, scenario_id, created_at DESC)
  WHERE scenario_id IS NOT NULL;
```

Retrocompatible: NULL en snapshots previos = "base scenario".

### Fuera de scope explícito

- **ΔEVE / ΔNII / SOT** — se delega al motor ALM del banco (WKFS, Moody's, SAS, FIS).
- **CSRBB como revaluación de banking book** — se mantiene el `additionalCharges.csrbb.chargePct` actual; no se construye revaluación.
- **Curvas propias** — N-Pricing no genera curvas shockeadas; las consume del adapter.
- **Shock de FX basis** — fuera de Ola 6. Se puede ampliar en Ola 7 si hay demanda.
- **Behavioural runoff en pricing** — los modelos conductuales ya existen para prepago, pero aplicarlos por escenario IRRBB es scope creep.

### Entregables Bloque B

- Tipos nuevos en `types/pricingShocks.ts` (re-export desde `types.ts`).
- Presets en `utils/pricing/shockPresets.ts` + tests.
- Extensión `MarketDataAdapter.fetchShockedCurve` + inMemory impl + stub Bloomberg.
- Motor consume `ShockScenario` + tests (happy path + 6 presets + retrocompat `PricingShocks`).
- Vista `StressPricingView.tsx` lazy-loaded + entrada nav + tests Storybook.
- Migration `pricing_snapshots_scenario`.
- Runbook `docs/runbooks/stress-pricing-adapter-down.md`.

---

## 3. Bloque C — Snapshot hash chain

### Objetivo

Tamper evidence retroactiva: si un actor con acceso DB modifica un snapshot antiguo, el chain se rompe y `verifyChain(entity_id)` lo detecta.

### Cambio técnico

Migration `20260619000003_pricing_snapshots_hash_chain.sql`:

```sql
ALTER TABLE pricing_snapshots
  ADD COLUMN IF NOT EXISTS prev_output_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_prev_hash
  ON pricing_snapshots (entity_id, prev_output_hash);
```

En `utils/snapshotHash.ts`: antes de INSERT, lee el último `output_hash` de la misma `entity_id` (simple `SELECT ... ORDER BY created_at DESC LIMIT 1`) y lo guarda en `prev_output_hash`. El primer snapshot del tenant tiene `prev_output_hash = NULL` (genesis).

Nueva función `verifySnapshotChain(entityId, fromDate?, toDate?)` en `utils/snapshotHash.ts` que recorre el chain y devuelve `{ valid: boolean, brokenAt?: snapshotId }`.

Endpoint `GET /api/snapshots/verify-chain?from=&to=` (admin-only) que lo expone.

### Riesgo concurrencia

Dos pricing calls simultáneas del mismo tenant podrían leer el mismo `prev_output_hash` y generar fork. Mitigación: constraint parcial `UNIQUE (entity_id, prev_output_hash) WHERE prev_output_hash IS NOT NULL` + retry en writer si conflict. Acceptable porque pricing no es realtime batch. Alternativa: `pg_advisory_xact_lock(hashtext('snap_' || entity_id))`.

### Entregables Bloque C

- Migration + tests de integración.
- `verifySnapshotChain` + endpoint + test.
- Documentar en `docs/architecture.md` §Reproducibilidad.

---

## 4. Plan de ejecución (propuesta)

| Semana | Bloque | Milestone |
|---|---|---|
| 1 | A (tenancy strict) | PR con runbook + dashboard de violations. Flip warn mode en canary env. |
| 1 | B.1 + B.2 | Tipos + presets EBA en PR separado. Tests unit en verde. |
| 2 | A completada | Flip `TENANCY_STRICT=on` en prod tras 48 h warn limpias. |
| 2 | B.3 + B.4 | Adapter method + motor consume scenario. Snapshot compatibility test. |
| 3 | B.5 | Vista Stress Pricing. Storybook + e2e Playwright. |
| 3 | C | Hash chain migration + verifier + endpoint. |
| 4 | QA + rollout B | Feature flag `STRESS_PRICING_UI_ENABLED` per-tenant. |

Cada semana cierra con un PR mergeable a main. Si se bloquea Bloque B, Bloque A y C siguen su curso.

---

## 5. Decisiones que necesitan input antes de empezar

1. **¿Scope de "portfolio de deals" en Stress Pricing?** Todas las pending del blotter vs. filtro por producto / segment. Recomendación: MVP filtrado por `status='pending'` + filtro producto. Ampliar en Ola 7.
2. **¿Qué proveedor de curvas shockeadas en prod?** Bloomberg es el stub obvio; si el cliente (BBVA/Santander) usa un feed propio (Reuters / internal ALM), el stub debe firmar el contrato para ese feed. **Pregunta abierta para el cliente piloto.**
3. **¿Activar vista Stress Pricing por feature flag per-tenant o global?** Recomendación: flag per-tenant (ya hay `tenant_feature_flags`); permite canary.
4. **¿Hash chain incluye snapshots históricos o solo nuevos?** Recomendación: solo nuevos (`prev_output_hash = NULL` en todos los históricos); la migración no backfilla. Backfill retroactivo es script opt-in.

---

## 6. Métricas de éxito

| KPI | Baseline | Target post-Ola 6 |
|---|---|---|
| Cross-tenant reads en integration test | 0 (tras PR #5) | 0 (estable tras strict) |
| Shocks EBA cubiertos en motor | 2/6 (parallel + spread) | 6/6 |
| Snapshots con `scenario_id` | 0% | ≥ 40% (requiere adopción UI) |
| Chain breaks detectados | no medido | 0 |
| p95 latency pricing con scenario completo | no medido | < 350 ms (budget: 300 ms base + 50 ms scenario overhead) |

---

## 7. Riesgos y contingencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Flip `TENANCY_STRICT=on` caza code path no cubierto en tests | Baja | Kill switch `=off` inmediato. Guard ya está en fase 3 (prod lock) antes. |
| `fetchShockedCurve` en Bloomberg stub no responde | Media | `AdapterResult.fail('unreachable', …)` + UI muestra "Adapter unavailable" con runbook link. |
| Usuarios confunden Stress Pricing con IRRBB regulatorio | Alta | Copy explícito en vista: "No sustituye al cálculo IRRBB regulatorio (ΔEVE, SOT)". Enlace a doc metodológica. |
| Hash chain race condition genera fork | Baja | Unique constraint + retry. Si persiste: `pg_advisory_xact_lock`. |

---

## Bloque D — Market benchmarks completion (gap encontrado 2026-04-23)

### Contexto

El pivot §Bloque H cerró migration + util (`utils/marketBenchmarks.ts`), tests (8) y captura de `competitor_rate` en `DealOutcomeDrawer`. El gap detectado:

- `api/whatIf.ts:213` apunta a `/what-if/benchmarks` — **el server route no existe**.
- Tabla `market_benchmarks` **sin seed**, así que la vista vacía sería permanente aunque la llamada respondiera.
- Ninguno de los 20 componentes `components/Calculator/*` muestra "Market X.XX% • your Δbps" — el chip diseñado en PIVOT §Bloque H no se cableó.
- No hay vista admin/CSV importer para alimentar feed manual.
- Integral review 2026-04-18 cerró Olas 6-8 sin incluir este trabajo.

### Objetivo

Cerrar el círculo de "pricing decision support con referencia externa": que un trader vea al cotizar si su rate está `±Nbps` del benchmark BBG/BdE más reciente para su tuple `product × tenor × client × currency`.

### Diseño (cross-tenant por naturaleza)

`market_benchmarks` **no tiene `entity_id` ni RLS** — es referencia externa compartida. Todos los tenants ven los mismos benchmarks (BBG, BdE, EBA surveys). Esto es correcto:

- **Read**: `authMiddleware` sin `entityScoped` (patrón de `/api/entities`).
- **Write (upsert / delete)**: admin global only — `req.user?.role === 'Admin'`. Un tenant no debería poder inyectar rates que otros tenants vean como verdad.
- **Audit**: cada upsert registra `user_id` + `user_entity_id` + timestamp en `audit_log` (campo `resource_type='market_benchmark'`).

### Entregables Bloque D

1. **Server route `server/routes/marketBenchmarks.ts`** — GET (list, con filtros product/currency/client), POST (upsert admin-only), DELETE (admin-only), GET by id.
2. **Registro en `server/index.ts`** fuera de la cadena `entityScoped`.
3. **Módulo cliente `api/marketBenchmarks.ts`** nuevo, retirando `listBenchmarks/upsertBenchmark` de `api/whatIf.ts` (son de este dominio, no de WhatIf).
4. **Query hook `hooks/queries/useMarketBenchmarksQuery.ts`** + query keys.
5. **Seed script `scripts/seed-market-benchmarks.ts`** idempotente con ~30 benchmarks realistas (LOAN_COMM/MORTGAGE/DEPOSIT × ST/MT/LT × Retail/SME/Corporate × EUR/USD, fuentes BBG/BdE/EBA).
6. **Chip en Calculator** — componente nuevo `MarketRateChip.tsx` renderizado en `PricingReceipt` junto al `finalClientRate` output, mostrando "Market 4.22% (BBG) · +13bp vs market" con semantic color (ABOVE/ON_MARKET/BELOW).
7. **Tests** — route (happy + admin guard + filters), hook (query key + invalidation), chip (3 states).
8. **Runbook opcional** — `docs/runbooks/market-benchmarks-feed.md` (cómo actualizar manualmente, validación de rangos).

### Fuera de scope Bloque D

- CSV importer UI → Bloque D2 follow-up.
- Vista admin `MarketBenchmarksView.tsx` con CRUD visual → D2.
- Auto-ingest de BBG/Refinitiv → D3 (requiere contrato con banco piloto).

### Dependencias

- Ninguna hacia bloques A/B/C. Mergeable en paralelo.

### KPIs Bloque D

| KPI | Target |
|---|---|
| Benchmarks seed en DB | ≥ 24 tuples |
| `findBenchmark` cobertura para productos core | ≥ 80% de pricing calls encuentran match |
| Chip visible en PricingReceipt | 100% de deals con product/client soportado |

---

## 8. Referencias

- [`integral-review-2026-04-18.md`](./integral-review-2026-04-18.md) §3 Ola 6 (revisada post-challenge)
- [`phase-0-rollout.md`](./phase-0-rollout.md) para rollout de tenancy strict
- [`phase-0-technical-specs.md`](./phase-0-technical-specs.md) para forma de `pricing_snapshots`
- EBA GL 2018/02 — Guidelines on the management of interest rate risk arising from non-trading book activities
- [`architecture.md`](./architecture.md) §Reproducibilidad
