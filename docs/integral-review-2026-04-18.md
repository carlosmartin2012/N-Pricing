# Integral Review — N-Pricing

> **Fecha:** 2026-04-18 · **Alcance:** revisión técnica, de UI/UX y de funcionalidad tras cierre del roadmap Phase 0–5.
> **Método:** 4 auditorías en paralelo (frontend/UX, backend/seguridad, motor financiero, datos/CI) + verificación manual de hallazgos críticos.
> **Salida:** inventario de hallazgos **verificados**, separación de falsos positivos, propuesta de evolución (Olas 6–8).

---

## 0. TL;DR ejecutivo

N-Pricing está maduro: 92.6k LOC TS/TSX, 972 unit tests, 12 e2e, motor con 19 gaps + extensiones ESG/CSRBB, multi-tenant con RLS en dos capas, snapshots inmutables, adapter layer, SSO real, drift detector, 7 runbooks. El **core nuevo (Phase 0–5) está limpio**: Customer 360, Campaigns, Governance, Metering y Adapters siguen el patrón correcto de `req.tenancy` + `withTenancyTransaction`.

~~**El riesgo principal no está en lo nuevo, sino en el *legacy* que precede al middleware de tenancy**: `routes/config.ts`, `routes/audit.ts` y `routes/deals.ts GET /` no usan `req.tenancy`. Cuando `TENANCY_ENFORCE=on` pase a producción, estas rutas seguirán devolviendo datos cross-tenant porque nunca se adaptaron. Este es el **único hallazgo bloqueante para activar strict tenancy global**.~~

**Actualización 2026-04-19:** la verificación posterior al merge de PR #5 mostró que los 3 routers legacy **ya estaban migrados** (revisar §1.1 actualizado). El hallazgo bloqueante real era distinto: `requireTenancy()` existía pero no se montaba, dejando sin red anti-regresión la cadena `entityScoped`. Cerrado en PR #7 — guard mode-aware montado en los 13 routers entity-scoped + 11 tests unit cubriendo off/on × presencia/ausencia de `req.tenancy` + flip live del env. El **camino para `TENANCY_STRICT=on` global queda libre**.

El resto de hallazgos son deuda técnica ordenada: routing sin layout persistente, monolítico `translations.ts` de 80 KB, bundle sin auditar recharts/xlsx, `schema.sql` legacy sin retirar, stubs Salesforce/Bloomberg sin implementación real.

A nivel de producto, el siguiente gran bloque natural no es *más motor* ni un motor IRRBB paralelo — los bancos ya tienen Wolters Kluwer / Moody's / SAS / FIS para ALM. El producto debe **mantenerse en el carril de pricing**: (1) *pricing bajo estrés* (consumir los 6 shocks EBA como escenarios de pricing, no calcular ΔEVE), (2) **colaboración en tiempo real** en Calculator y Blotter, (3) **copiloto contextual** que lea el snapshot de pricing para explicar decisiones (recomendaciones, trade-offs, citas regulatorias).

---

## 1. Hallazgos verificados (con evidencia)

### 1.1 Tenancy — bloqueantes para activar `TENANCY_STRICT=on` global

| # | Archivo | Evidencia | Severidad |
|---|---|---|---|
| T1 | [server/routes/config.ts:11-17](../server/routes/config.ts#L11) | `SELECT * FROM rules LIMIT 500` sin `req.tenancy`. Todas las rutas `/rules`, `/rules/:id/versions`, `/clients`, `/products` devuelven o mutan global. | **Crítica** |
| T2 | [server/routes/deals.ts:102-116](../server/routes/deals.ts#L102) | GET `/deals` usa `entity_id` del **query param**, no de `req.tenancy`. Si el cliente lo omite, `SELECT * FROM deals LIMIT 1000` atraviesa entities. | **Crítica** |
| T3 | [server/routes/deals.ts:191-262](../server/routes/deals.ts#L191) | POST `/upsert` no valida que `body.entity_id === req.tenancy.entityId`. Un cliente puede escribir deals para otra entity. | **Crítica** |
| T4 | [server/routes/audit.ts](../server/routes/audit.ts) | `audit_log` sin RLS por `entity_id`; agente A ve logs de B. | **Alta** |
| T5 | Middleware global | `tenancyMiddleware` solo se monta en routers que lo pidieron; rutas legacy quedan fuera de su órbita. | **Alta** |

**Acción recomendada (antes de activar strict en Prod):**

1. Migrar `config.ts`, `deals.ts`, `audit.ts` al patrón canónico de `customer360`/`campaigns` (check `req.tenancy`, envolver mutaciones en `withTenancyTransaction`).
2. Añadir una **integration test** al estilo de `utils/__tests__/integration/tenancy.integration.test.ts` que recorra cada router con dos entities A/B y falle si hay cross-reads.
3. Introducir un guard global `requireTenancy()` que, en presencia de `TENANCY_ENFORCE=on`, devuelva 500 si el handler lee sin `req.tenancy`. Anti-regresión.

### 1.2 Falsos positivos descartados

Durante la revisión se descartaron tres alarmas importantes:

| Claim | Verdicto | Evidencia |
|---|---|---|
| `shocks.interestRate / 100` distorsiona EVE IRRBB | **Falso** | `interpolateYieldCurve` devuelve rates en **percent** (`expect(rate).toBeCloseTo(5.32, 1)` en [pricingEngine.test.ts:48](../utils/__tests__/pricingEngine.test.ts#L48)). Convertir bps→percent es `/100`. La unidad está documentada con el comentario `// bps` en [pricingEngine.ts:75-76](../utils/pricingEngine.ts#L75). Correcto. |
| `METHODOLOGY` y `CONFIG` apuntan a `/methodology` por error | **Intencional** | [appNavigation.ts:42-43](../appNavigation.ts#L42) — el sidebar muestra solo `METHODOLOGY` con label "Rules & Config"; el alias existe para retrocompatibilidad del tipo `ViewState`. `getAllRoutePaths()` deduplica por `seen`. |
| `TENANCY_ENFORCE=off` en rutas nuevas es vulnerable | **Por diseño** | Phase 0 describe un rollout de 4 fases (off→warn→canary→global) en [phase-0-rollout.md](./phase-0-rollout.md). El middleware en modo `off` es consciente. El riesgo real (punto 1.1) es que *rutas legacy no consumen `req.tenancy` ni cuando está activo*. |

### 1.3 Motor financiero — hallazgos verificables en próxima iteración

Estos claims requieren validación manual contra specs regulatorias antes de tratarlos como bugs confirmados. Listados para trabajo de `financial-calc-reviewer`:

- **Guard en `annualFactor = 12 / months`**: verificar que `durationMonths > 0` está asegurado aguas arriba en `dealWorkflow.ts` (si sí, no es bug).
- **LTV cap a 1.5**: revisar si BdE Anejo IX exige categoría `HIGH_LTV` específica por encima de 100% — en tal caso, el cap oculta el tramo.
- **Countercyclical buffer hardcoded a 1%**: en la práctica BdE publica CCyB por país en datos mensuales. Parametrizarlo por jurisdicción es mejora, no bug, **mientras** el valor por defecto sea conservador.
- **IRRBB shocks completos (EBA GL 2018/02)**: el tipo `PricingShocks` actual es `{ interestRate, liquiditySpread }`. Para cumplir EBA hacen falta los 6 shocks: parallel ±200, short ±250, steepener, flattener. Hoy se aproxima con presets en [components/Risk/shockUtils.ts:16](../components/Risk/shockUtils.ts#L16) pero **no hay EVE vs NII separado**. Es un gap real (ver propuesta §3.1).
- **CSRBB**: el campo `additionalCharges.csrbb.chargePct` existe pero no se revalúa contra curva de crédito dinámica. Gap regulatorio (CRR3 art. 384b).
- **Pillar II**: `P2Requirement = 2%` hardcoded. Falta P2G (Pillar 2 Guidance) separado.
- **Cross-bonus NPV sin descuento**: `totalNpvMarginIncome` suma márgenes año 1→5 sin `riskFreeRate + creditSpread` → sobreestima valor presente. Confirmar en `crossBonuses.ts`.

### 1.4 Frontend / UX — deuda real

| # | Archivo | Problema | Severidad |
|---|---|---|---|
| F1 | [index.tsx](../index.tsx) | 7 providers anidados (Auth → Entity → MarketData → Governance → Data → UI → Walkthrough) sin error boundaries granulares. Un fallo tumba toda la app. | Alta |
| F2 | [App.tsx](../App.tsx) | No hay layout persistente tipo `<Outlet />` (React Router 7 lo soporta); cada cambio de ruta remonta Header + shell. | Alta |
| F3 | `components/Admin/EntityOnboarding.tsx` (673 LOC) y `components/Reporting/VintageAnalysis.tsx` (589 LOC) | Monolíticos, sin split por responsabilidad, sin tests unitarios directos. | Alta |
| F4 | [translations.ts](../translations.ts) (80 KB, ~1.4k líneas) | Plano, sin namespaces por vista, sin type-safety estricta por sección. Imposible detectar claves huérfanas. | Media |
| F5 | [budgets.json](../budgets.json) | Presupuestos sin auditoría de `recharts` (importa `d3-scale` completo) y `xlsx` (>500 KB). | Media |
| F6 | 79 `style={{}}` inline en `components/ui/` | Gradientes y colores hex fuera del design system — no respetan cambios de tema. | Baja |
| F7 | `ViewSkeleton` hardcoded por pathname | Acoplamiento entre skeleton y rutas; olvidar un caso → fallback genérico. Debe ir en metadata de `NavItem`. | Baja |

### 1.5 Datos, CI/CD, calidad

| # | Problema | Severidad |
|---|---|---|
| D1 | ~~`supabase/schema.sql` coexiste con 26 migrations~~ ✅ **Cerrado 2026-04-18** — warning `DO NOT EXECUTE` prominente en la cabecera del fichero; `docs/supabase-setup.md` y `agents.md` redirigidos a migrations como fuente de verdad. | — |
| D2 | ~~`scripts/check-seed-schema-sync.ts` valida contra `schema*.sql` legacy~~ ✅ **Cerrado 2026-04-18** — ahora lee `supabase/migrations/*.sql` en orden + `schema_v2.sql` como fallback; regex del parser ampliado (UUID, TIMESTAMP, DECIMAL…); `ADD COLUMN IF NOT EXISTS` ya no genera la columna fantasma `if`; safety net que falla si parsea <15 tablas. | — |
| D3 | CI: no hay **coverage gate** (ni objetivo) ni `npm audit` bloqueante. ESLint sí corre, pero Lighthouse CI solo en PR. | Media |
| D4 | `integrations/crm/salesforce.ts` y `integrations/marketData/bloomberg.ts` son stubs que devuelven `fail('unreachable', …)`. **Esto está bien** (decisión consciente, `AdapterResult`), pero conviene dashboard de *adapter health* en la UI de Admin para no “olvidarlos” en deploy. | Media |
| D5 | PWA offline: estrategia de resolución de conflictos al volver online no está documentada. `hooks/supabaseSync/useRealtimeSync.ts` hace fallback pero sin UI de merge. | Media |
| D6 | Mappers `api/mappers.ts` re-exporta desde `utils/supabase/mappers.ts` sin tests de round-trip. | Baja |

---

## 2. Cosas que no tienen sentido (y por qué)

1. **Coexistencia `schema.sql` + migrations**: si el canon es `migrations/`, `schema.sql` debería etiquetarse explícitamente como *snapshot informativo, no ejecutable*, o borrarse. Hoy genera ambigüedad.
2. **Dos SSO providers (`DemoSsoProvider` + `GoogleSsoProvider`) sin selector runtime explícito**: el bootstrap elige por env vars. Añadir `SSO_PROVIDER=demo|google` explícito en `.env.example` evita `google` “silencioso” con credenciales inválidas.
3. **`PRICING_ALLOW_MOCKS` por defecto permite mocks**: para un motor regulatorio, el default debería ser `false` (rechazar pricing si falta config) y solo activable en Dev. Si ya lo es, documentar con énfasis en `phase-0-rollout.md`.
4. **Escalations + Dossiers en vistas separadas pese a ser el mismo ciclo de vida**: un deal pasa por escalation → se aprueba → genera dossier firmado. Hoy requieren dos navegaciones; un timeline unificado por deal tendría mejor UX.
5. **`AI_LAB` todavía como vista lateral**: cuando madure el copiloto (propuesta §3.3), su lugar natural es un panel flotante persistente tipo `Cmd+K`, no una vista aislada.
6. **`translations.ts` compartiendo fichero con el shell**: 80 KB en el bundle principal. Splittearlo por idioma + namespace recorta TTI.

---

## 3. Propuesta de evolución (post-roadmap)

La propuesta se organiza en 3 olas, ortogonales entre sí, priorizadas por riesgo/valor.

### Ola 6 — Tenancy strict + pricing bajo estrés (4–6 semanas)

> **Revisión 2026-04-18 (post-challenge):** la versión inicial proponía un
> cierre regulatorio IRRBB completo (EVE+NII, SOT, CSRBB dinámico). **Se
> descarta:** IRRBB regulatorio es scope creep — los bancos ya usan Wolters
> Kluwer OneSumX / Moody's / SAS / FIS para ICAAP y SOT. N-Pricing no
> compite en ese terreno; es un motor de **pricing**, no de ALM. El buyer
> persona es Treasury comercial / Producto, no CRO. La ola se
> redimensiona a *pricing bajo estrés* + *tenancy strict global*.

**Objetivo:** activar `TENANCY_STRICT=on` global y convertir los shocks EBA
en **escenarios de pricing** (no en una capa IRRBB paralela).

1. **Tenancy hardening legacy** (§1.1 — *único bloqueante real*):
   migrar `server/routes/config.ts`, `deals.ts`, `audit.ts` al patrón
   canónico `req.tenancy + withTenancyTransaction`. Integration test por
   router con fuzz cross-entity. Guard global `requireTenancy()` que en
   `TENANCY_ENFORCE=on` devuelva 500 si un handler lee sin tenancy
   populada — anti-regresión.
2. **`ShockScenario` como input rico de pricing** (no como motor IRRBB):
   ampliar el tipo `PricingShocks` actual (`{ interestRate, liquiditySpread }`)
   a un catálogo con los 6 presets EBA GL 2018/02 (parallel ±200,
   short ±250, steepener, flattener) **como escenarios aplicables al
   pricing**. Caso de uso: "¿cómo se mueve mi FTP, margen y RAROC si la
   curva hace steepener?" — es *price-testing*, no ΔEVE regulatorio.
   No se calcula SOT ni impacto sobre Tier 1.
3. **Ingesta de curvas shockeadas vía `MarketDataAdapter`**:
   `fetchShockedCurve(scenarioId, asOfDate)` — N-Pricing **consume** las
   curvas que el motor ALM del banco ya produjo, no las genera. Stub
   actual + contrato claro para que Bloomberg / OneSumX conecten.
4. **CSRBB como componente FTP (ya existe) mejorado, NO como motor**:
   mantener `additionalCharges.csrbb.chargePct` como coste de spread en el
   pricing del activo. Mejora incremental: permitir curva de crédito
   por rating/sector en vez de constante. No es el CSRBB de ALM (ese es
   revaluación del banking book, fuera de scope).
5. **Snapshot hash chain**: cada snapshot referencia el `output_hash` del
   anterior para detección de tampering retroactivo (lightweight tamper
   evidence — mantiene el contrato regulatorio de reproducibilidad sin
   entrar en ALM).

**Fuera de scope explícito de esta ola** (y probablemente del producto):

- ΔEVE regulatorio, Supervisory Outlier Test, NII a 1Y/2Y con runoff /
  constant balance sheet, decomposición por currency bucket.
- CSRBB como revaluación de la cartera banking book.
- ICAAP capital adequacy, Pillar II add-ons regulatorios.
- Cualquier cosa que exija EBA GL 2018/02 para ICAAP.

**Entregables:** migraciones + tipos + motor + vista de *stress pricing*
(tabla 6 escenarios × FTP/margen/RAROC, no EVE) + integration tests de
tenancy + runbook actualizado.

### Ola 7 — UX colaborativa y copiloto contextual (6–8 semanas)

**Objetivo:** convertir N-Pricing en una herramienta colaborativa al nivel de Figma/Notion para mesa de pricing.

1. **Layout persistente con React Router 7 `<Outlet/>`**: fixes F1+F2 en una sola pasada. Error boundaries por sección (Commercial, Pricing, Portfolio, Analytics, Governance).
2. **Presence + live locks en Calculator/Blotter**: cursor indicators, "Carlos está ajustando el margen de este deal", conflict modal. Ya hay `usePresenceAwareness`; falta surfacear.
3. **Deal timeline unificado**: draft → pending → escalation L1 → L2 → committee → approved → booked. Cada hito con quien-cuándo-qué. Conecta Escalations, Dossiers y Audit Log en una sola vista por deal.
4. **Copiloto contextual (Gemini + snapshot)**: panel flotante `Cmd+K` que:
   - Recibe el snapshot actual como contexto (input + context + output + 8 componentes críticos).
   - Responde en español, con citas regulatorias (Anejo IX, CRR3 art., EBA GL §).
   - Sugiere trade-offs numéricos: "bajar margen 5 bps reduce RAROC 0.3 pp pero cierra deal con prob +15%".
   - Audit trail: cada sugerencia se guarda en `ai_response_traces`.
5. **Onboarding por rol**: tours diferenciados Trader / Risk Officer / Committee Member con `Walkthrough` existente + `Shepherd.js` o Joyride.
6. **i18n refactor**: `translations = { common, calculator, blotter, governance, … }` con namespaces. Code-split por locale.

**Entregables:** nueva vista timeline + Cmd+K panel + tours + bundle reducido.

### Ola 8 — Plataforma: scenario optimization + data platform (8–12 semanas)

**Objetivo:** N-Pricing como plataforma extensible, no solo como app.

1. **Scenario generator AI-driven**: dado un deal, genera N escenarios Pareto-óptimos (margen vs aprobabilidad vs RAROC) en lugar de que el usuario los defina a mano. Basado en elasticity history + drift detector.
2. **Plugin SDK oficial**: hoy hay `docs/pricing-plugin-architecture.md` — convertirlo en SDK publicable (`@nfq/pricing-plugin`) con contract tests y registry validado en CI.
3. **Stream de snapshots a un data lake** (Iceberg/Delta/Supabase Storage): para análisis histórico, backtesting portfolio-wide, reporting regulatorio off-motor. Eventually consistent, nunca bloquea pricing.
4. **Real Salesforce + Bloomberg adapters**: cerrar los stubs. CRM → sincroniza cartera a `client_positions`. Market → sustituye `InMemoryMarketData` para yield curves y FX basis.
5. **Móvil nativo (PWA → Capacitor)**: sucursal en tablet puede cotizar contra la Channel API con la misma UI, offline-first real.
6. **RAROC budgeting**: presupuestar RAROC anual por BU, rolldown a deals. Alerta si una aprobación consume presupuesto >X%.

**Entregables:** SDK publicado + 2 adapters reales + tablet POC + RAROC budget view.

---

## 4. Plan de acción inmediato (próximas 2 semanas)

Ordenado por ROI/esfuerzo:

| # | Acción | Esfuerzo | ROI | Owner sugerido |
|---|---|---|---|---|
| 1 | ~~Tenancy hardening `config.ts` + `deals.ts` + `audit.ts` + integration tests~~ ✅ **Cerrado 2026-04-19** — verificado en código sobre `origin/main`: los 3 routers ya consumen `tenancyScope` / `entityScopedClause` (`server/routes/config.ts:24,72,163,213,266,319`, `server/routes/deals.ts:111,124,144,158,194,207,418`, `server/routes/audit.ts:12,23,43`); `deals POST /upsert` y `batch-upsert` rechazan `body.entity_id ≠ req.tenancy.entityId` con 403 (`tenancy_forbidden_write`); child tables (`deal_versions`, `deal_comments`, `pricing_results`) protegidas vía `assertDealInScope`. Integration tests opt-in en `utils/__tests__/integration/legacyRouteTenancy.integration.test.ts` (7 specs). El integral review reflejaba el estado anterior al merge de PR #5. | — | — | — |
| 2 | ~~Retirar `supabase/schema.sql` o marcarlo `-- LEGACY, DO NOT EXECUTE` + actualizar `check-seed-schema-sync.ts`~~ ✅ **Cerrado 2026-04-18** — schema.sql lleva warning prominente, el script ahora lee migrations/ en orden + schema_v2 como fallback, detecta columnas nuevas antes invisibles (`green_format`, `won_lost`, `ltv_pct`, `ifrs9_stage`, …) | — | — | — |
| 3 | ~~Añadir `requireTenancy()` guard + test anti-regresión~~ ✅ **Cerrado 2026-04-19** — el guard ya existía en `server/middleware/requireTenancy.ts:64` pero **nunca se montaba** (dead code). Refactor a **mode-aware**: lee `TENANCY_ENFORCE` por request (no se cachea), no-op en `off`/unset (preserva rollout legacy), 500 con `code: tenancy_guard_missing` si en `=on` un handler llega sin `req.tenancy` (regresión "router montado sin `entityScoped`"). Montado **incondicionalmente** en `entityScoped` chain (`server/index.ts:104-107`) cubriendo deals/audit/config/marketData/reportSchedules/observability/pricing/snapshots/customer360/governance/metering/campaigns. Tests: 11 specs en `utils/__tests__/requireTenancy.test.ts` (off/on × tenancy presence/missing + live env flip). | — | — | — |
| 4 | ~~Dashboard de adapter health en Admin (lee `adapterRegistry.healthAll()`)~~ ✅ **Cerrado 2026-04-18** — `AdapterHealthPanel` embebido en `HealthDashboard` + endpoint `/api/observability/integrations/health` + `bootstrapAdapters()` al boot (registra in-memory por defecto, switch a Salesforce/Bloomberg vía `ADAPTER_CRM` / `ADAPTER_MARKET_DATA`) + 3 tests unit | — | — | — |
| 5 | ~~Auditar bundle: reemplazar `xlsx` por `exceljs`/`write-excel-file`, lazy-load `recharts`~~ ✅ **Cerrado 2026-04-18 (con recalibración)** — la recomendación original era superficial: `xlsx` ya estaba lazy-loaded en los 4 sitios (`await import('xlsx')`) y `recharts` ya tenía su propio `vendor-recharts` chunk + solo lo usan 3 gráficos de Discipline (vista lazy). El problema real estaba en `DealBlotter` chunk (110 KB, 7.4 KB over budget). Fix: lazy-load de `DealBlotterDrawers` (6 drawers, solo renderiza cuando user interactúa) + `DealComparisonDrawer` (BulkActionBar → compare). Resultado: **DealBlotter 110→46 KB (-58%)**, drawers extraídos a chunks propios (65 KB + 5 KB). Budget ajustado a 60 KB para que sea *guardrail real*, no placebo. Side-fix: `vite.config.ts` usaba port 5000 (viola regla NFQ — macOS AirPlay) → movido a 3000, CORS allowlist actualizado. | — | — | — |
| 6 | ~~Añadir coverage gate en CI (`vitest --coverage` con threshold 70% inicial)~~ ✅ **Cerrado 2026-04-18 (con recalibración)** — el threshold 70% era aspiracional; baseline real es 23.68% lines / 18.85% functions. Usé la práctica correcta: thresholds **anti-regresión** calibrados ~1 pp bajo la medida actual (22/22/17/20 para lines/statements/functions/branches). Instalado `@vitest/coverage-v8@4.0.18` (matching vitest), config en `vite.config.ts` con include/exclude precisos (no cuenta tests, stories, translations, seed), script `npm run test:coverage`, CI job actualizado (reemplaza `vitest run` + uploads artifact 14 d). Ticket de follow-up para subir UI component coverage a 40% antes de bump. | — | — | — |
| 7 | ~~Split de `EntityOnboarding.tsx` en 3 sub-componentes + tests~~ ✅ **Cerrado 2026-04-18** — orchestrator **673 → 314 LOC (-54%)**. Split en 4 step components (`EntityBasicInfoStep`, `EntityConfigurationStep`, `EntityUserAssignmentStep`, `EntityReviewStep`) + módulo de tipos + validators puros (`validateBasicInfo`, `validateConfiguration`, `normaliseShortCode`). **14 unit tests** nuevos para los validators — antes no había forma de testear la regla "auto < L1 < L2" sin renderizar el drawer entero. | — | — | — |
| 8 | ~~Documentar `SSO_PROVIDER` explícito + default `PRICING_ALLOW_MOCKS=false` en `.env.example`~~ ✅ **Cerrado 2026-04-18** — `.env.example` reescrito por concerns (DB / Supabase / Auth / Demo / Tenancy / Pricing / Governance / Workers / Adapters / CORS / Pivot / AI), con warnings prominentes en `VITE_DEMO_*` (bundleado al cliente) y `PRICING_ALLOW_MOCKS=false` explícito como default correcto. El `SSO_PROVIDER` explícito se documentó como *aspiracional*: la selección actual es implícita (presencia de `VITE_GOOGLE_CLIENT_ID` → google; ausencia → demo). Añadir un selector explícito exige re-wire del código — no cabía en 0.25 d honestamente. | — | — | — |

Total: ~10 jornadas-persona distribuibles en 2 semanas con 2 perfiles.

### 4.1 Gap añadido a posteriori (2026-04-23) — Market benchmarks completion

Durante el sweep del roadmap se detectó que la comparativa de precios de competencia (pivot §Bloque H) quedó a medias: migration + util + tests ✅, pero server route huérfano, sin seed, sin chip en Calculator. Se formalizó como **Ola 6 Bloque D** — ver [`ola-6-tenancy-strict-stress-pricing.md`](./ola-6-tenancy-strict-stress-pricing.md#bloque-d--market-benchmarks-completion-gap-encontrado-2026-04-23). Primer slice (route + seed + chip) entregado en rama `feat/market-benchmarks-completion`.

---

## 5. Lo que NO hay que hacer

Riesgo típico en este punto del producto:

- **No empezar un "v2" del motor de pricing**: los 19 gaps + ESG + CSRBB están cerrados. Estabilizar antes que reescribir.
- **No introducir Redux/Zustand**: el problema de re-renders en Context no justifica cambio global; se resuelve con granularidad de providers y `React.memo` en listas. El coste de migrar 7 contexts a Zustand supera el beneficio.
- **No activar `TENANCY_STRICT=on` global sin cerrar §1.1**. La integration test lo detectará al primer fuzz cross-entity.
- **No facturar por uso**: la decisión de quitar billing (commit `7c397c9`) está bien. Mantener metering como observabilidad, no como pricing comercial.
- **No añadir más vistas al sidebar**: 16 vistas ya rozan el límite cognitivo. Ola 7 debería **reducir** (unificar Escalations+Dossiers+Audit en Timeline) no añadir.
- **No construir un motor IRRBB regulatorio** (ΔEVE, SOT, CSRBB de ALM, NII con runoff). Los bancos ya tienen Wolters Kluwer OneSumX / Moody's / SAS / FIS para eso. N-Pricing es un motor de **pricing**; puede *consumir* la señal de un motor IRRBB vía adapter, pero convertirse en uno es scope creep disfrazado de rigor. Ver Ola 6 revisada.

---

## 6. Cambios propuestos a la documentación

Esta revisión deja la siguiente huella documental:

- **Nuevo**: `docs/integral-review-2026-04-18.md` (este documento — canónico para la siguiente planificación).
- **Actualizar**: [CLAUDE.md](../CLAUDE.md) sección *Pitfalls comunes* con el warning de tenancy legacy (ver nota separada).
- **Actualizar**: [docs/architecture.md](./architecture.md) — enlace a esta review desde la sección de referencias rápidas.
- **Pendiente de escribir** (por cada ola, cuando se planifiquen):
  - `docs/ola-6-tenancy-strict-stress-pricing.md`
  - `docs/ola-7-collab-copilot.md`
  - `docs/ola-8-platform.md`
- **Pendiente de retirar**: `supabase/schema.sql` (decisión §4.2), `docs/IMPROVEMENT_PLAN.md` (superseded por roadmap + esta review).

---

## 7. Métricas de éxito (KPIs para próxima revisión)

| KPI | Baseline 2026-04-18 | Target post-Ola 6 | Target post-Ola 7 |
|---|---|---|---|
| Cross-tenant reads detectados en integration test | >0 (rutas legacy) | 0 | 0 |
| Shocks EBA cubiertos | 2/6 (parallel + spread) | 6/6 | 6/6 |
| Bundle inicial gzipped | ~450 KB (estimado) | ~380 KB | ~300 KB |
| p95 latency pricing single | cumplida (<300 ms) | <250 ms | <200 ms |
| Coverage gate en CI | none | 70% | 80% |
| Tiempo onboarding nuevo usuario hasta primer deal | no medido | <10 min | <5 min |
| Adapter health visibility | ninguna | dashboard | alertable |

---

**Siguiente sesión recomendada:** brainstorming de Ola 6 con `/superpowers:brainstorming` para detallar tipos, migrations y plan de rollout del IRRBB EVE+NII.
