# N-Pricing — Plan de mejora y evolución

> **Tipo:** Plan maestro de consolidación y evolución
> **Autor:** Claude (ultraplan)
> **Fecha:** 2026-04-11
> **Estado:** En ejecución parcial
> **Destinatario:** Agente/desarrollador que retome el trabajo en otra sesión

---

## 0. Cómo usar este documento

Este plan es **autocontenido**: un agente que abra el repo por primera vez puede ejecutarlo leyendo solo esto + `CLAUDE.md` + `APP_INFO.md`.

- Ejecutar por **ejes** (A–F) o por **sprints** (§6), no mezclar ambos.
- Cada tarea lleva: *evidencia* (file:line), *acción concreta*, *criterio de aceptación*, *riesgo*.
- **Regla dura:** ningún refactor del Eje B sin los E2E del Eje C ya verdes para ese flujo.
- Antes de empezar cualquier eje, correr `npm run verify:full` para tener baseline limpio.

## 0.1 Estado de ejecución real (2026-04-11)

> **Última validación completa:** `npm run verify:full` ✅

Este documento sigue siendo el plan maestro de 4 sprints, pero en esta sesión se ejecutó una **tranche de cimientos / Sprint 1 parcial**, no el plan completo end-to-end.

### Completado en esta ejecución
- **Q1**: `@typescript-eslint/no-explicit-any` subido a `warn` en `eslint.config.js`.
- **Q2**: saneados los últimos focos de typing/lint en `utils/supabase/mappers.ts` y `supabase/functions/pricing/index.ts`; `npm run lint` vuelve a quedar limpio a nivel repo.
- **Q3**: activados los flujos E2E dependientes de API mock en `e2e/auth.spec.ts` y `e2e/pricing-flow.spec.ts`.
- **Q4**: `check:sync` queda bloqueante en CI vía `.github/workflows/ci.yml`.
- **Q5**: `no-console` endurecido a error con allowlist `info|warn|error`; `utils/logger.ts` ajustado para cumplir.
- **Q6**: headers de seguridad añadidos en `vercel.json` con `Content-Security-Policy-Report-Only`.
- **Q7**: añadida story de `BlotterTable` en `components/Blotter/BlotterTable.stories.tsx`; `npm run build-storybook` verde.
- **Q8**: nueva suite `api/__tests__/mappers.test.ts` con round-trips y contratos públicos.
- **A3 (fuerte)**: contrato público de `api/mappers.ts` ya cubierto por tests y el mapper legacy subyacente quedó sin `any` explícitos.
- **C1 (parcial fuerte)**: infraestructura de mock centralizada en `e2e/mockApi.ts`; suite E2E estabilizada para correr sin API real y nuevo spec dedicado `e2e/deal-blotter.spec.ts` cubriendo grid, filtros, dossier y alta manual.
- **C2**: añadida regresión numérica del motor en `utils/__tests__/pricingRegression.test.ts` con fixture JSON de 50 casos en `utils/__tests__/fixtures/pricing-regression.fixture.json`.
- **A1 (cerrado en runtime)**: `App.tsx`, `components/`, `contexts/`, `hooks/` y `utils/` ya no consumen `supabaseService`; el código activo pasa por `api/` y servicios especializados (`monitoring`, `approvalService`, `portfolioReportingService`, `marketDataIngestionService`) según corresponda. `AuditLog` ya consume `api/mappers` en vez del path legacy y se han retirado los adapters CRUD `utils/supabase/{deals,config,market}.ts` junto con `utils/supabaseService.ts`.
- **B1 (arranque)**: `DealBlotter.tsx` ya empezó a descomponerse; la lógica de filtro/selección/dossier salió a `components/Blotter/hooks/useBlotterState.ts` y la barra de acciones superior a `components/Blotter/BlotterHeaderActions.tsx`. El shell principal baja a ~910 líneas y queda mejor posicionado para el siguiente corte.
- **Performance / bundle**: restaurado `npm run check:bundle` separando `CalculatorWorkspace`, `PricingReceipt`, `MethodologyVisualizer`, `UserConfigModal`, `UniversalImportModal` y `WalkthroughOverlay` en chunks lazy. El entry principal quedó en 372.1 KB y el workspace de calculator en 73.6 KB, ambos dentro de budget.
- **Validación extendida**: `npm run check:sync`, `npm run check:bundle`, `npm run build-storybook` y `npm run verify:full` quedan verdes; baseline actual en `verify:full` = 671 tests unitarios y E2E 78 passing / 1 skipped.

### Avanzado pero no cerrado
- **B1**: la descomposición de `DealBlotter` ya comenzó, pero todavía faltan separar filtros/acciones/drawers hasta acercarlo al objetivo <400 L por archivo.
- **CLAUDE.md** ya refleja que `api/` es la capa pública y que esos módulos legacy son adapters/deprecated path.
- La suite de screenshots E2E ya no escribe en `screenshots/` durante tests; ahora usa output de Playwright y Vite ignora artefactos de test para evitar HMR espurio.

### Pendiente del plan maestro
- **C1 expansión**: faltan los specs nuevos del roadmap hasta llegar a ≥12.
- **B, D, E, F** permanecen mayormente pendientes salvo los quick wins ya indicados.

### Notas para la siguiente sesión
- Tomar este estado como nuevo baseline, no volver a reabrir la discusión sobre mock API ni los skips originales.
- Si se continúa por Sprint 1/Sprint 2, el siguiente tramo natural es entrar en **C1 expansión** o **B1** (descomposición de `DealBlotter`), ahora con Storybook y E2E como red de seguridad.

---

## 1. Contexto mínimo (para agente nuevo)

N-Pricing es un motor de **Funds Transfer Pricing (FTP)** para instituciones financieras. React 19 + TypeScript 5.8 + Vite 6 + Supabase + React Query + Tailwind. PWA con fallback offline. AI Assistant (Gemini) vía proxy. 229 TS/TSX files, 111 componentes, 17 hooks, 45 utils, 7 Context providers, 671 unit tests, 5 E2E specs, 14 migraciones Supabase.

Lectura obligada antes de tocar código:
- `CLAUDE.md` — arquitectura, convenciones, áreas sensibles
- `APP_INFO.md` — features, stack, stats
- `docs/pricing-methodology.md` — los 19 gaps del motor FTP
- Este documento

Comandos base:
```bash
npm install
npm run dev
npm run verify:full   # lint + typecheck + test + build + e2e
npm run check:sync    # valida seed ↔ schema
npm run check:bundle  # valida tamaños
```

---

## 2. Diagnóstico actual (abril 2026)

### Salud
- **Fundamentos sólidos**: arquitectura modular, CI + Lighthouse + bundle budgets, PWA offline, motor de pricing ya modularizado en `utils/pricing/`, React Query + Context bien separados, 328 unit tests.
- **Sin secretos hardcodeados**: Gemini va por `/api/gemini/chat`, confirmado en `vite.config.ts:97`.
- **Seguridad básica correcta**: React escapa por defecto, no se detectó inyección de HTML sin sanitizar en datos de usuario.

### Deuda concreta detectada
| Tema | Evidencia | Impacto |
|---|---|---|
| **Duplicación capa datos** | Había duplicación entre `api/*` y adapters CRUD legacy en `utils/supabase/*`. | Mitigado en esta ejecución — `api/` queda como capa única |
| **Dios-componentes** | `DealBlotter.tsx` 982 L, `ModelInventoryPanel.tsx` 832 L, `PricingReceipt.tsx` 777 L, `governanceWorkflows.ts` 916 L | Alto — cambios lentos y con regresiones |
| **115 `any` tolerados** | ESLint `@typescript-eslint/no-explicit-any: 'off'`; peores en `utils/supabase/mappers.ts:16`, `api/config.ts:6`, `components/Config/MethodologyConfig.tsx:6` | Medio — errores de mapeo silenciosos |
| **E2E todavía corto para el roadmap** | 5 specs activas con 79 tests (`78 pass`, `1 skip` esperado), ya estabilizadas con mock API central. | Medio — baseline ya más sólida, pero todavía faltan los golden paths pendientes del roadmap |
| **`pricingWorker.ts` probablemente muerto** | Existe en `utils/pricingWorker.ts`, referenciado en `hooks/useBatchPricing.ts`, sin evidencia de uso efectivo | Bajo — main thread bloquea en batch pricing >100 deals |
| **Recharts y calculator chunking aún mejorables** | Bundle budget ya vuelve a pasar, pero siguen existiendo chunks pesados (`xlsx`, `CategoricalChart`) y oportunidades extra de lazy/manualChunks. | Medio — LCP / TBT |
| **Context values sin `useMemo`** | Pendiente auditar `DataContext`, `UIContext`, `MarketDataContext`, `GovernanceContext` | Medio — re-renders en toda la app |
| **`api/mappers.ts` sin tests** | Ningún test de round-trip Domain↔DB | Alto — persistencia rota silenciosa |
| **50 `console.log` olvidados** | `index.tsx`, `hooks/useBatchPricing.ts`, `components/Intelligence/GeminiAssistant.tsx`, `scripts/*`, `server/*` | Bajo — ruido en prod |
| **Storybook mínimo** | 4 stories (`AccountingSummaryCard`, `ErrorBoundary`, `Toast`, `RAROCMetricCard`) | Bajo — no es la norma del equipo |
| **CSP ausente** | `vercel.json` sin `Content-Security-Policy` header | Medio — app financiera |

### Lo que **NO hay que tocar** (funciona bien)
- `pricingEngine.ts` + `utils/pricing/` — estructura clara y tests, está en evolución activa (Anejo IX).
- `hooks/queries/` + patrón React Query — cache e invalidación establecidos.
- `App.tsx` shell + lazy loading por vistas/modales críticos — pragmático y ahora vuelve a cumplir budget.
- Pipeline de CI — lint + typecheck + tests + build + bundle + Lighthouse + E2E.
- `useSupabaseSync` + `hooks/supabaseSync/` — hidratación y fallback offline probados. Tocar con guantes.
- Proxy Gemini (`/api/gemini/chat`) — no meter la key en el cliente.

---

## 3. Objetivos del plan

1. **Cerrar deuda arquitectónica** (capa `api/` ↔ `utils/supabase/`) sin frenar feature work.
2. **Elevar el piso de calidad**: typing estricto, E2E que valga la pena, refactor de los 4 componentes críticos.
3. **Preparar la plataforma para evolución**: motor de pricing extensible, governance como state machine, observabilidad de cálculos, bitemporal RAROC.
4. **Mantener a Anejo IX (M2) avanzando en paralelo** — ya tiene su propio plan en `docs/superpowers/plans/`.

---

## 4. Ejes de trabajo

### Eje A — Consolidación arquitectónica

#### A1. Unificar capa de datos en `api/`
**Objetivo:** un único camino CRUD. `api/` pasa a ser la capa pública; `utils/supabase/` queda para servicios sin equivalente (approval, audit, monitoring, marketDataIngestion, portfolioReportingService, methodologyService).

**Tareas:**
1. Inventariar consumidores de `utils/supabase/deals.ts`, `utils/supabase/config.ts`, `utils/supabase/market.ts`.
   ```bash
   rg -n "from ['\"].*utils/supabase/(deals|config|market)['\"]" --type ts --type tsx
   ```
2. Migrar cada import a `api/` (ej: `api/deals.ts`, `api/config.ts`, `api/marketData.ts`).
3. Verificar que `api/mappers.ts` cubre todos los mapeos que usaba el legacy.
4. Marcar los legacy con `@deprecated` + `console.warn` en dev durante 1 sprint, después borrarlos.
5. Actualizar `CLAUDE.md` (sección "Arquitectura y flujo de datos") para reflejar única capa.

**Criterio de aceptación:**
- `rg "utils/supabase/(deals|config|market)" components/ hooks/` devuelve 0.
- `npm run verify:full` pasa.
- Test manual offline: app arranca con `VITE_SUPABASE_URL=""` y el seed funciona.

**Riesgo:** romper fallback offline en `useSupabaseSync`. Mitigación: migrar módulo a módulo, canary en Vercel preview antes de merge.

**Estado 2026-04-11:** completado. Los imports activos a `utils/supabase/{deals,config,market}` y `utils/supabaseService` ya son 0 y los wrappers se han retirado.

---

#### A2. Auditoría de Context re-renders
**Objetivo:** ningún `value={{...}}` sin memoizar en providers globales.

**Tareas:**
1. Revisar cada Context: `AuthContext`, `DataContext`, `UIContext`, `GovernanceContext`, `MarketDataContext`, `EntityContext`, `WalkthroughContext`.
2. Para cada uno, envolver `value` en `useMemo` con dependencias exhaustivas.
3. Para los derivados pesados (ej: `deals` filtradas), mover a selectores memoizados dentro de los consumers con `useMemo`.
4. Medir con React DevTools Profiler en dos flujos: abrir Blotter (100 deals), abrir Reporting Overview. Registrar antes/después.

**Criterio de aceptación:**
- Profiler muestra reducción ≥30% en render count en los dos flujos.
- `react-hooks/exhaustive-deps` sigue pasando.

**Riesgo:** `useMemo` mal hecho puede causar closures stale. Mitigación: tests de integración en cada context.

---

#### A3. Tipar `api/mappers.ts` + tests de round-trip
**Objetivo:** eliminar `any` del mapper y garantizar contrato DB↔Domain.

**Tareas:**
1. Definir tipos `DbRow<T>` y `DomainRow<T>` (tipos generados idealmente desde el schema).
2. Tipar `mapDealFromDB`, `mapDealToDB`, `mapCurveFromDB`, etc.
3. Crear `api/__tests__/mappers.test.ts` con:
   - Snapshot por entidad (deal, curve, rule, esgGrid, auditEntry).
   - Round-trip: `Domain → DB → Domain` debe ser idempotente.
   - Edge cases: nulls, fechas, decimales grandes (`BigDecimal`-like en cliente = string), currency.
4. Añadir ese test suite a `npm run verify`.

**Criterio de aceptación:**
- 0 `any` en `api/mappers.ts`.
- ≥10 tests nuevos pasando.
- Mutar un mapper rompe al menos un test.

**Riesgo:** Bajo. Encontrar inconsistencias existentes es valor, no problema.

---

### Eje B — Refactor quirúrgico de dios-componentes

**Regla dura:** ningún refactor aquí sin E2E previo que cubra el flujo del componente (ver Eje C).

#### B1. `DealBlotter.tsx` (982 L → ~300 L shell)
**Descomposición:**
```text
components/Blotter/
  DealBlotter.tsx           (shell orquestador)
  BlotterTable.tsx          (render + virtualization)
  BlotterFilters.tsx        (filters + search + saved views)
  DealActionsPanel.tsx      (bulk actions, export, approve)
  DealDetailDrawer.tsx      (drawer con detalle + workflow)
  hooks/
    useBlotterState.ts      (filters, sort, selection)
    useBlotterSelection.ts  (multi-select + shortcuts)
```

**Criterios:** ningún archivo >400 L, cada pieza con su test, E2E `deal-blotter.spec.ts` verde.

#### B2. `ModelInventoryPanel.tsx` (832 L)
**Descomposición:**
```text
components/Config/ModelInventory/
  ModelInventoryPanel.tsx   (shell)
  ModelGrid.tsx             (tabla)
  ModelEditor.tsx           (drawer edición)
  ModelValidationBadge.tsx
  ModelUsageCard.tsx
```

#### B3. `PricingReceipt.tsx` (777 L)
**Descomposición:**
```text
components/Calculator/Receipt/
  PricingReceipt.tsx        (shell)
  WaterfallTree.tsx         (breakdown de los 19 gaps)
  ShockSimulator.tsx
  ScenarioComparison.tsx
  hooks/useReceiptDerivation.ts
```

#### B4. `utils/governanceWorkflows.ts` (916 L) → state machine
**Propuesta:** introducir XState o un reducer tipado explícito. Estados: `Draft → Pending → Approved → Booked`, con guards por rol y transiciones auditadas.

**Descomposición:**
```text
utils/governance/
  approval.ts       (transiciones)
  delegation.ts     (matriz de delegación)
  guards.ts         (validaciones por rol)
  audit.ts          (emisión de audit entries)
  index.ts          (API pública preserva la actual)
```

**Criterio de aceptación B1–B4:**
- `npm run verify:full` pasa.
- Tests que existían siguen verdes sin adaptación > cosmética.
- `rg -l "from.*governanceWorkflows"` encuentra solo `utils/governance/index.ts`.

**Riesgo:** alto. Mitigación: adapter que mantiene la API pública actual de `governanceWorkflows` y delega a los nuevos módulos. Refactor interno no es breaking change.

---

### Eje C — Testing de verdad

#### C1. E2E golden paths (P0)
Pasar de 4 → ≥12 specs. Específicos:

| Spec | Flujo |
|---|---|
| `e2e/pricing-flow.spec.ts` (activar) | login → calculator → price deal → check FTP & RAROC |
| `e2e/deal-blotter.spec.ts` (nuevo) | crear deal → pending → approve → booked → accounting entry visible |
| `e2e/batch-import.spec.ts` (nuevo) | import CSV → batch price → export xlsx |
| `e2e/rules-governance.spec.ts` (nuevo) | edit rule card → governance approval → audit trail |
| `e2e/shocks-reporting.spec.ts` (nuevo) | apply shock scenario → NII sensitivity dashboard actualizado |
| `e2e/market-data.spec.ts` (nuevo) | editar curva → bootstrap zero → verificar en calculator |
| `e2e/esg-grid.spec.ts` (nuevo) | grid ESG → deal verde → greenium aplicado |
| `e2e/ai-assistant.spec.ts` (nuevo, mock) | chat Gemini con grounding de portfolio |
| `e2e/offline-pwa.spec.ts` (nuevo) | degradar network → operar con cache local → reconectar → sync |
| `e2e/rbac.spec.ts` (nuevo) | Trader no puede approve; Risk_Manager sí; Auditor read-only |
| `e2e/multi-entity.spec.ts` (nuevo) | cambiar entidad activa → datos aislados |
| `e2e/auth.spec.ts` (activar) | login demo + OAuth mock |

**Infra requerida:** servicio API mockeable (hoy los dos skip dependen de `E2E_WITH_API=1`). Montar un mock de Supabase en Playwright fixture o un `msw/node` en el server `tsx`.

**Criterio:** todos los specs verdes en CI PR mode, tiempo total < 4 min.

#### C2. Regresión numérica del motor de pricing
Un solo fixture con 50 deals reales (JSON en `utils/__tests__/fixtures/`). Test que ejecuta `calculatePricing` y compara con snapshot numérico. Cualquier cambio en `utils/pricing/` o `pricingEngine.ts` fuerza revisión manual del snapshot.

**Ubicación:** `utils/__tests__/pricingRegression.test.ts`
**Criterio:** tolerance `toBeCloseTo(_, 6)` para rates, exacto para flags.

#### C3. Storybook: 4 → 20 stories
Prioridad: los componentes que se van a refactorizar en Eje B. Una story por archivo nuevo resultante. Storybook visual como red de seguridad antes/después del refactor.

---

### Eje D — Performance y bundle

#### D1. Lazy-load Recharts por dashboard
**Acción:** crear `components/ui/charts/lazyRecharts.ts` que exporta los componentes de Recharts como `React.lazy`. Todos los dashboards en `components/Reporting/` importan desde ahí.
**Medir:** bundle `vendor-recharts` antes/después. Target: ≥80 KB fuera del initial bundle.

#### D2. Decidir destino de `pricingWorker.ts`
**Investigación primero:**
```bash
rg -n "pricingWorker" --type ts --type tsx
```
- Si `useBatchPricing` lo usa pero está muerto → arreglar y conectar.
- Si no lo usa nadie → borrar, incluyendo el archivo y sus tipos.
**Criterio:** Batch pricing de 200 deals no bloquea main thread >50ms (medible con Performance API).

#### D3. Virtualización de AuditLog
Confirmar en `components/Admin/AuditLog.tsx` si usa `@tanstack/react-virtual`. Si no, aplicar con threshold 100 rows.

#### D4. Lighthouse budget gradual
Endurecer `.lighthouserc.json`:
- LCP < 2.5s
- TBT < 200ms
- CLS < 0.05
- Performance score ≥ 85

---

### Eje E — Seguridad

#### E1. Revisión RLS de las 14 migraciones
Abrir cada `supabase/migrations/*.sql` y confirmar:
- Toda tabla sensible tiene `ENABLE ROW LEVEL SECURITY`.
- Policies filtran por `auth.uid()` y/o `entity_id` del usuario.
- `audit_log` es `INSERT`-only vía RLS (no solo app).
- Deals tienen policy separada para `SELECT` vs `UPDATE` vs `DELETE` (RBAC real).

**Entregable:** `docs/rls-audit-2026-04.md` con tabla de tablas ↔ policies ↔ observaciones.

#### E2. CSP headers en `vercel.json`
Añadir bloque `headers` con las siguientes directivas:
- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'`; `connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com`; `img-src 'self' data: blob:`; `style-src 'self' 'unsafe-inline'`; `font-src 'self' data:`.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

Validar primero en modo `Content-Security-Policy-Report-Only` durante un sprint, afinar si hay violations, y luego pasar a enforce. Afinar `connect-src` si el proxy Gemini usa otro host.

#### E3. Cerrar 2 E2E skip + 50 `console.log`
- Activar `e2e/auth.spec.ts` y `e2e/pricing-flow.spec.ts` con el mock del Eje C1.
- Sustituir `console.log` por `logger.info` de `utils/logger.ts` o borrar si son debug residual.
- Añadir regla ESLint: `no-console: ['error', { allow: ['warn', 'error', 'info'] }]` en `src/` (no en `scripts/`).

---

### Eje F — Evolución (P2, diseño antes de código)

#### F1. Motor de pricing extensible por plug-in
**Idea:** cada gap (de los 19) se registra en un registry. Clientes/filiales pueden añadir un gap local (ej: cargo regulatorio específico del BCE) sin tocar el core.

```ts
// utils/pricing/registry.ts
type PricingGap = {
  id: string;
  order: number;
  compute: (ctx: PricingContext) => PricingGapResult;
  dependsOn?: string[];
};

export const gapRegistry = createRegistry<PricingGap>();
```

`calculatePricing` deja de ser una secuencia hardcoded y se vuelve un pipeline que ordena topológicamente los gaps por dependencias.

**Entregable fase diseño:** `docs/pricing-plugin-architecture.md` con API pública, ejemplo de plug-in, plan de migración incremental.

#### F2. Bitemporal RAROC
Separar `valid_time` (cuándo aplica el deal en el negocio) y `transaction_time` (cuándo se registró/corrigió). Permite reporting "as-of" y corrección de errores sin perder trazabilidad.

**Impacto schema:** columnas `valid_from/valid_to/tx_from/tx_to` en `deals`. Índices y queries bitemporales.
**Ya está en el plan M2** — coordinar con él.

#### F3. Observabilidad de cálculos
Cada `calculatePricing()` emite un trace estructurado: `{ dealId, inputs, curvesUsed, ruleMatched, gapsBreakdown, outputs, durationMs }`. Consumido por `api/observability.ts`.

**Valor:** explicabilidad frente a reguladores, debugging de diferencias entre entornos.

#### F4. What-if masivo en Blotter
Shock global sobre cartera actual desde Blotter (no solo desde Shocks). Usa el `pricingWorker` ya desbloqueado en D2. Resultado: tabla con ΔFTP, ΔRAROC, Δmargen por deal.

#### F5. Continuar Anejo IX (Credit Risk M2)
Plan existente en `docs/superpowers/plans/`. No duplicar aquí, solo recordar que corre en paralelo.

---

## 5. Quick wins (cada uno <1 día)

| # | Acción | Ficheros | Test |
|---|---|---|---|
| Q1 | ESLint `no-explicit-any: 'warn'` | `eslint.config.js` | `npm run lint` muestra 115 warnings baseline |
| Q2 | Borrar o canalizar 50 `console.log` | varios (ver `rg "console\.log"`) | lint limpio |
| Q3 | Activar los 2 E2E `.skip` (con mock API) | `e2e/auth.spec.ts`, `e2e/pricing-flow.spec.ts` | `npm run test:e2e` verde |
| Q4 | `check:sync` bloqueante en CI | `.github/workflows/ci.yml` | CI falla al desincronizar |
| Q5 | `no-console` regla (allow warn/error/info) | `eslint.config.js` | lint pasa tras Q2 |
| Q6 | Añadir headers CSP básico en `vercel.json` | `vercel.json` | Preview OK, DevTools sin violations |
| Q7 | Storybook story del componente `BlotterTable` actual | `components/Blotter/*.stories.tsx` | `npm run storybook` |
| Q8 | Test de 1 mapper como base del Eje A3 | `api/__tests__/mappers.test.ts` | vitest pasa |

---

## 6. Roadmap sugerido (4 sprints, 2 semanas cada uno)

### Sprint 1 — Cimientos
**Meta:** baseline de calidad y arquitectura unificada.
- Q1, Q2, Q3, Q4, Q5, Q7 (quick wins)
- A1 (consolidación `api/`)
- A3 (typing `mappers.ts` + tests)
- C1 parcial: 5 specs E2E activas; `deal-blotter.spec.ts` ya cubre el flujo básico del blotter
- C2 (regresión numérica motor)

**Exit criteria:** `verify:full` verde, 8 E2E specs, 0 `any` en `api/mappers.ts`, capa datos única.

### Sprint 2 — Refactor Blotter + performance
- A2 (audit contexts + memoización)
- B1 (`DealBlotter` descomposición)
- D1 (Recharts lazy)
- D2 (decidir `pricingWorker`)
- C1 resto: 4 specs E2E adicionales
- C3 parcial: Storybook de los nuevos componentes de Blotter

**Exit criteria:** Blotter en archivos <400 L, bundle inicial ≥80 KB más ligero, 12 E2E specs, Profiler shows ≥30% menos renders.

### Sprint 3 — Refactor Config + Calculator + governance
- B2 (`ModelInventoryPanel`)
- B3 (`PricingReceipt`)
- B4 (governance → state machine con adapter)
- D3 (AuditLog virtualización)
- C3 resto: Storybook de Config y Calculator

**Exit criteria:** 4 dios-componentes resueltos, `governanceWorkflows` es adapter sobre `utils/governance/`.

### Sprint 4 — Seguridad + diseño de evolución
- E1 (RLS audit doc)
- E2 (CSP headers)
- E3 (cerrar E2E skips, console.log)
- D4 (Lighthouse budget endurecido)
- F1 (diseño plug-in architecture en doc, **sin código**)
- F3 (diseño observabilidad de cálculos, **sin código**)

**Exit criteria:** app financiera con headers de seguridad, docs de evolución listos para sprint 5+.

### Continuo
- Anejo IX M2 según `docs/superpowers/plans/`.

---

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Refactor de Blotter sin E2E previo rompe workflow de aprobación | Media | Alto | Eje C **antes** que Eje B. Regla dura. |
| Migración `utils/supabase/` → `api/` rompe fallback offline | Media | Alto | Módulo a módulo. Canary en Vercel preview. Test manual offline. |
| State machine en governance es cambio grande en zona sensible | Media | Alto | Adapter preserva API pública de `governanceWorkflows`. Tests legacy pasan sin tocar. |
| Context `useMemo` mal hecho genera closures stale | Baja | Medio | Tests de integración por context. Revisar exhaustive-deps. |
| Lazy loading de Recharts rompe SSR o PWA precache | Baja | Medio | Validar en preview con `vite build && vite preview` y Service Worker refrescado. |
| CSP rompe Gemini proxy o Supabase Realtime | Media | Medio | Primero en report-only, afinar, después enforce. |
| Plug-in architecture (F1) suena bien y nunca se ejecuta | Alta | Bajo | Solo diseño en Sprint 4. Código en backlog posterior. |

---

## 8. Glosario de archivos clave

| Archivo | Rol | Comentario |
|---|---|---|
| `App.tsx` | Shell principal, lazy loading, routing | No tocar salvo para quitar imports obsoletos |
| `utils/pricingEngine.ts` | Orquestador FTP 603 L | **Sensible.** Cualquier cambio con test de regresión |
| `utils/pricing/` | Motor modularizado (curveUtils, formulaEngine, liquidityEngine) | BIEN. Refactor interno incremental está OK |
| `utils/governanceWorkflows.ts` | State de approval 916 L | **B4.** Descomponer en `utils/governance/` |
| `api/` | Capa CRUD nueva | **A1.** Se convierte en capa pública única |
| `utils/supabase/` | Servicios Supabase 15 módulos | **A1.** Parcialmente deprecado; queda solo lo no-CRUD |
| `api/mappers.ts` | Snake_case ↔ camelCase | **A3.** Tipar y testear |
| `hooks/supabaseSync/` | Hidratación + realtime + fallback | **Zona sensible.** No tocar salvo con tests |
| `hooks/queries/` | React Query wrappers | BIEN. Usar sus queryKeys para invalidar cache |
| `components/Blotter/DealBlotter.tsx` | 982 L | **B1.** Descomponer |
| `components/Config/ModelInventoryPanel.tsx` | 832 L | **B2.** Descomponer |
| `components/Calculator/PricingReceipt.tsx` | 777 L | **B3.** Descomponer |
| `utils/pricingWorker.ts` | Web Worker batch pricing | **D2.** Investigar si vivo o muerto |
| `supabase/migrations/*.sql` | 14 migraciones | **E1.** Revisar RLS |
| `vercel.json` | Deploy + headers | **E2.** Añadir CSP |
| `eslint.config.js` | Reglas lint | **Q1, Q5.** Subir rigor gradualmente |
| `.lighthouserc.json` | Budget Lighthouse | **D4.** Endurecer |
| `budgets.json` | Bundle budgets | Usado por `scripts/check-bundle-size.ts` |

---

## 9. Comandos útiles para el agente que ejecute este plan

```bash
# Inventario rápido
rg -n "from ['\"].*utils/supabase/(deals|config|market)['\"]" --type ts --type tsx
rg -c ":\s*any\b" --type ts --type tsx | sort -t: -k2 -rn | head -20
rg -n "console\.log" --type ts --type tsx
rg -n "\.skip\(|\.only\(" e2e/ utils/__tests__/
wc -l components/**/*.tsx utils/**/*.ts | sort -rn | head -20

# Validación
npm run verify:full
npm run check:sync
npm run check:bundle
npm run test -- --reporter=verbose utils/__tests__/pricingRegression.test.ts

# Perfilado
npm run build && npm run preview
# Abrir DevTools → Performance → record → medir flujo Blotter/Reporting

# Storybook aislado
npm run storybook
```

---

## 10. Criterios de salida global del plan

Al final de los 4 sprints, N-Pricing debe cumplir:

- [ ] Una única capa de datos: `api/`. `utils/supabase/` contiene solo servicios no-CRUD.
- [ ] 0 archivos en `components/` o `utils/` con >600 líneas (excluyendo tests y fixtures).
- [ ] ≥12 E2E specs verdes en CI PR mode, tiempo total <4 min.
- [ ] `api/mappers.ts` sin `any`, con tests de round-trip.
- [ ] Motor de pricing con test de regresión numérica (fixture 50 deals).
- [ ] Bundle inicial al menos 80 KB más ligero que baseline (gracias a Recharts lazy).
- [ ] Lighthouse ≥85 performance en preview, LCP <2.5s, TBT <200ms.
- [ ] Headers CSP + seguridad en `vercel.json` en modo enforce.
- [ ] RLS auditada y documentada en `docs/rls-audit-2026-04.md`.
- [ ] `governanceWorkflows` es un adapter sobre `utils/governance/` (state machine).
- [ ] Diseño de plug-in architecture y observabilidad de cálculos publicados en `docs/`.
- [ ] Anejo IX M2 avanzando en paralelo (fuera del scope de este plan).

---

## 11. Notas finales para el agente

- **No mezclar ejes en una misma PR.** Una PR por eje o sub-eje. Facilita review y rollback.
- **Commits con prefijos claros** (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `security`) — ya es la convención del repo.
- **Antes de tocar `pricingEngine` o `governanceWorkflows`**, correr el fixture de regresión numérica.
- **Si algo del plan ya está hecho** cuando retomes la sesión, marcar `[x]` en §10 y seguir.
- **Si encuentras contradicción** entre este plan y la realidad del repo, confía en la realidad y actualiza el plan.

> Este plan se puede retomar diciendo: *"Ejecuta el Sprint N de `docs/IMPROVEMENT_PLAN.md`"* o *"Implementa el eje X del plan de mejora"*.
