# CLAUDE.md — N-Pricing

> Contexto esencial para agentes IA que trabajan en este repositorio.
> Última actualización: 2026-05-18 (doc consolidation — un único `docs/roadmap.md` reemplaza Olas 6/7/8 + methodology-first + next-gen + refactor-followups).
> **Lectura obligatoria antes de tocar código:**
> - [`docs/roadmap.md`](docs/roadmap.md) — single source of truth del estado de desarrollo.
> - [`docs/architecture.md`](docs/architecture.md) — overview vivo del producto.
> - [`docs/platform-restructure.md`](docs/platform-restructure.md) — split en `packages/*` (facades, no aislamiento físico).
>
> Decisión 2026-05-18: continuar en monorepo actual. Greenfield descartado (`next-gen-*` archivados en git history).

## Qué es N-Pricing

Motor de **pricing bancario integral** para instituciones financieras, con
ámbito triple:

1. **Funds Transfer Pricing (FTP)** — tasas de transferencia internas, RAROC,
   costes regulatorios (LCR/NSFR), ajustes ESG. 19 gaps cubiertos.
2. **Pricing comercial al cliente** — relación cliente, cross-bonus relacional,
   targets top-down, campañas versionadas.
3. **Channel pricing en tiempo real** — cotización para canales (sucursal,
   web, mobile, call center, partner) con API key + rate limit.

PWA con soporte offline. **Multi-tenant** vía RLS Postgres.
**Reproducibilidad regulatoria** garantizada por snapshots inmutables.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19.2, TypeScript 5.8, Tailwind CSS 3 |
| Iconos | Lucide React |
| Build | Vite 6.2 + vite-plugin-pwa |
| Estado | React Context API (Auth, Data, UI, Governance, MarketData, Entity, Walkthrough) |
| Data fetching | @tanstack/react-query 5 |
| Formularios | react-hook-form 7 |
| Virtualización | @tanstack/react-virtual 3 |
| Backend | Express + pg.Pool sobre Postgres (Supabase para client/Edge) |
| Edge Functions | Deno (Supabase Edge) — pricing, realize-raroc, elasticity-recalibrate |
| Auth | JWT propio HMAC + Google SSO real (`GoogleSsoProvider`) |
| Testing | Vitest 4 (~1.4k+ tests, **118+** archivos en `utils/__tests__/`) + Playwright 1.59 (**24** specs, incl. `smoke.spec.ts`) |
| Storybook | Storybook 8.6 (React Vite) |
| IA | Google Generative AI (@google/genai) |
| Charts | Recharts 3.7 |
| Export | xlsx + PDF |
| CI/CD | GitHub Actions + Vercel |
| Integraciones | Adapter layer (`integrations/`) — in-memory + stubs Salesforce/Bloomberg |

## Comandos esenciales

```bash
npm install
npm run dev              # Vite HMR (:5000) + Express (:3001) vía concurrently
npm run build            # Build producción (PWA incluido)
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run typecheck:edge   # Build + deno check de Edge Functions
npm run test             # Vitest (~1.4k+ tests, 118+ archivos)
npm run test:e2e         # Playwright (24 specs, incluye smoke.spec.ts)
npm run verify           # lint + typecheck + edge + sync + data + security + test + build + bundle
npm run verify:full      # verify + test:e2e
npm run check:sync       # Validar seed↔schema (lee migrations)
npm run check:bundle     # Validar tamaños de bundle
npm run check:data-quality
npm run check:security   # Audit de deps prod
npm run seed:demo        # Poblar DEFAULT_ENTITY_ID con catalogo demo (idempotente)
npm run seed:clv-demo    # Subset CLV Phase 6
npm run storybook        # Storybook dev en :6006

# Tests integración (opt-in, requieren Postgres real):
INTEGRATION_DATABASE_URL=postgres://... npx vitest run utils/__tests__/integration

# Tenant provisioning (Phase 5):
tsx scripts/provision-tenant.ts --short-code BANK-ES --name "Bank S.A." --admin-email admin@bank.es
```

### Puertos (dev + Replit)

- **Vite** `:5000` — host `0.0.0.0`, `strictPort: true` (mapea a external `:80` en Replit). Fijado así para que la webview de Replit funcione; no es el `:3000` histórico.
  > **Excepción documentada del workspace CLAUDE.md** (que prohíbe `:5000` por colisión con macOS AirPlay): aquí es no-negociable para Replit. Si trabajas en macOS local, desactiva "Receiver" en Sharing → AirPlay, o usa `VITE_PORT=3000` por env (no recomendado: rompe el workflow de Replit).
- **Express** `:3001` — API. Vite proxya `/api/*` a este puerto.
- En Replit ambos arrancan con `npm run dev` (concurrently). El workflow espera `waitForPort = 5000`.

### Arranque en Replit

`.replit` deja listos los env vars mínimos en `[userenv.shared]`:
`VITE_DEMO_USER`, `VITE_DEMO_PASS`, `VITE_DEMO_EMAIL`, `VITE_GOOGLE_CLIENT_ID`,
`SEED_DEMO_ON_BOOT=true`. Con `postgresql-16` activo, `DATABASE_URL` lo inyecta
Replit automáticamente. El server ejecuta `runMigrations()` al boot y, si
`SEED_DEMO_ON_BOOT=true`, lanza `scripts/seed-demo-dataset.ts` como proceso
hijo idempotente para poblar clientes/deals/posiciones/targets antes de que
el usuario abra la UI. Ver [`docs/runbooks/replit-demo.md`](docs/runbooks/replit-demo.md).

## Estructura del proyecto (post-roadmap + restructure)

> **Restructure en curso (commit `5c37640`):** `packages/*` introducidas como
> boundaries nominales. La implementación sigue viviendo en `utils/`,
> `server/`, `components/`. Tests `packageBoundaryImports.test.ts` y
> `pricingCoreBoundary.test.ts` validan que código fuera de los packages no
> importe directamente de los módulos cubiertos. **Estado: facades, no
> aislamiento físico.** Ver `docs/platform-restructure.md`.

```text
App.tsx                    # Shell principal, lazy loading, routing
appNavigation.ts           # Navegación (31 ViewState; 22 sidebar + AUX)
types.ts                   # Tipos de dominio + re-exports de types/*
translations.ts            # i18n monolítica histórica (1622L) — conviviendo
                           # con translations/ split-by-domain (ver Pitfalls)

packages/                  # NUEVO — workspace facades (re-exports a utils/)
  pricing-core/            # @npricing/pricing-core — calculatePricing batch + DEFAULT_PRICING_SHOCKS
  commercial/              # @npricing/commercial — channels, customer360, clv, targetGrid
  domain/                  # @npricing/domain — tipos compartidos
  evidence/                # @npricing/evidence — snapshots, canonicalJson, snapshotHash
  governance/              # @npricing/governance — dossiers, escalations, methodology
  data-access/             # @npricing/data-access — contratos TenantSession/QueryReader
  platform/                # @npricing/platform — stub mínimo (6 líneas)

api/                       # Cliente API tipado (browser → server)
  index.ts                 # Re-exports
  deals.ts marketData.ts config.ts audit.ts entities.ts
  reportSchedules.ts observability.ts mappers.ts
  customer360.ts           # Phase 1
  campaigns.ts             # Phase 2
  clv.ts reconciliation.ts # Phase 6

contexts/                  # React Context (sin cambios estructurales)

integrations/              # NUEVO — Phase 4: connector adapter layer
  types.ts                 # AdapterResult<T>, CoreBankingAdapter, CrmAdapter, MarketDataAdapter
  registry.ts              # adapterRegistry singleton
  inMemory.ts              # Reference adapters (dev / tests)
  sso.ts                   # SsoProvider interface + DemoSsoProvider
  sso/google.ts            # GoogleSsoProvider real (OAuth2 + JWKS)
  crm/salesforce.ts        # SalesforceCrmAdapter (STUB)
  marketData/bloomberg.ts  # BloombergMarketDataAdapter (STUB)

scripts/
  provision-tenant.ts          # Phase 5, idempotente, < 60s SLO
  seed-demo-dataset.ts         # Demo catalogue — clientes + deals + Customer 360 + grid
  seed-clv-demo.ts             # Subset CLV Phase 6
  fill-tenancy-alert-secrets.ts # Ops-time secrets filler for tenancy alert channel_config (Ola 6 A: rules themselves seeded by migration)
  check-bundle-size.ts
  check-seed-schema-sync.ts
  check-data-quality.ts
  check-dependency-audit.ts

server/                    # Express server
  index.ts                 # Bootstrap + runMigrations + seed-on-boot opcional + routers + middlewares
  db.ts                    # pg.Pool + withTransaction + withTenancyTransaction
  migrate.ts               # Thin wrapper sobre migrationRunner (ex schema inline 1140L)
  migrationRunner.ts       # NUEVO — aplica supabase/migrations/*.sql en orden con
                           # bootstrap Supabase-compat (auth schema, anon/authenticated/
                           # service_role, supabase_realtime) + tracking en
                           # _n_pricing_migrations + content-hash tamper guard
  middleware/
    auth.ts                # JWT HMAC propio
    requestId.ts           # Phase 0, x-request-id correlación
    tenancy.ts             # Phase 0, valida x-entity-id contra entity_users
    requireTenancy.ts      # Belt-and-suspenders guard + helpers tenancyScope / entityScopedClause
    errorHandler.ts validate.ts
  routes/                  # 28 routers; reagrupados por ola
    # Core (pre-ola)
    deals.ts audit.ts config.ts marketData.ts entities.ts
    reportSchedules.ts observability.ts auth.ts gemini.ts pricing.ts
    # Phase 0
    snapshots.ts           # replay endpoint
    # Phase 1
    customer360.ts         # CRUD + CSV import
    # Phase 2
    channelPricing.ts campaigns.ts
    # Phase 3
    governance.ts          # model inventory + signed dossiers
    # Phase 5
    metering.ts            # ops usage observability
    # Phase 6
    clv.ts reconciliation.ts
    # Olas 8-10 (Banca March)
    attributions.ts        # Ola 8: jerárquico, append-only
    admission.ts coreBanking.ts budget.ts  # Ola 9: PUZZLE/HOST/ALQUID
    copilot.ts             # Ola 10: AI grounding Cmd+K
    dealTimeline.ts marketBenchmarks.ts notifications.ts  # surfaces auxiliares
    targetGrid.ts whatIf.ts                                # Olas 1-3
  workers/                 # 9 workers, todos opt-in via env vars
    alertEvaluatorCore.ts  # Pure evaluation (testable sin DB)
    alertEvaluator.ts      # DB adapters + setInterval loop opt-in
    snapshotReplay.ts      # Re-ejecuta motor con snapshot guardado
    escalationSweeper.ts   # Phase 3.5 — temporal approval escalations
    ltvSnapshotWorker.ts   # Phase 6 — refresca client_ltv_snapshots
    crmEventSync.ts        # Phase 6 — tira eventos CRM → client_events
    attributionDriftDetector.ts        # Ola 8 — alerta sobre drift de matrices
    attributionThresholdRecalibrator.ts # Ola 10 — recalibración automática
    workerHealth.ts        # Shared liveness/error counters
  integrations/
    alertChannels.ts       # email/slack/pagerduty/webhook/opsgenie
    bootstrap.ts           # Registra adapters (inMemory | salesforce | bloomberg) al boot

components/
  Calculator/ Blotter/ Config/ MarketData/ Behavioural/
  Accounting/ Reporting/ Risk/ RAROC/ Intelligence/
  Admin/                   # +SLOPanel.tsx (NUEVO Phase 0)
  Docs/ Notifications/ ui/
  TargetGrid/ Discipline/ WhatIf/   # Olas 1-3 (preexistente)
  Customer360/             # NUEVO — Phase 1
    CustomerRelationshipPanel.tsx   # Embebible
    CustomerPricingView.tsx         # Vista propia /customers
  Campaigns/               # NUEVO — Phase 2
    CampaignsView.tsx               # /campaigns con form + state machine

types/                     # Tipos por dominio, re-exportados desde types.ts
  entity.ts reportSchedule.ts pricingLineage.ts alertRule.ts
  targetGrid.ts discipline.ts whatIf.ts                 # Olas 1-3
  phase0.ts                # NUEVO — Tenancy, snapshots, SLO, alertas
  customer360.ts           # NUEVO — ClientPosition, ClientRelationship, PricingTarget
  channels.ts              # NUEVO — ChannelType, PricingCampaign
  governance.ts            # NUEVO — ModelInventory, SignedDossier, Escalation
  metering.ts              # NUEVO — UsageEvent, TenantFeatureFlag

utils/
  pricingEngine.ts                  # Motor FTP principal (19 gaps)
  rarocEngine.ts ruleMatchingEngine.ts pricingContext.ts pricingConstants.ts
  seedData.ts validation.ts dealWorkflow.ts governanceWorkflows.ts
  errorTracking.ts logger.ts localCache.ts
  configExport.ts excelUtils.ts pdfExport.ts mlEngine.ts
  portfolioAnalytics.ts regulatoryReporting.ts aiGrounding.ts
  dealFormResolver.ts generateId.ts storage.ts supabaseClient.ts
  canonicalJson.ts                  # NUEVO — Phase 0, hash-friendly JSON
  snapshotHash.ts                   # NUEVO — Phase 0, sha256 runtime-agnostic
  pricing/                          # Motor modularizado (preexistente)
  customer360/                      # NUEVO — Phase 1
    relationshipAggregator.ts       # buildClientRelationship + target matchers
    crossBonusFromRelationship.ts   # Mapea positions → CrossBonusAttachment
    csvImport.ts                    # parsePositionsCsv + parseMetricsCsv
  channels/                         # NUEVO — Phase 2
    tokenBucket.ts                  # Rate limit per API key
    campaignMatcher.ts              # findApplicableCampaigns + pickBestForBorrower
  governance/                       # NUEVO — Phase 3
    dossierSigning.ts               # signDossier + verifyDossierSignature (HMAC)
  metering/                         # NUEVO — Phase 5
    usageRecorder.ts                # recorderFromPool + InMemoryRecorder
  backtesting/                      # Olas 1-3 + extensión
    runner.ts
    driftDetector.ts                # NUEVO — Phase 3
    index.ts
  supabase/                         # Servicios especializados (preexistente)
  __tests__/                        # ~85 archivos · ~1 373 tests + 17 integration opt-in

supabase/
  fix_rls_realtime.sql
  migrations/                       # 43 migraciones SQL secuenciales (cronológicas)
  functions/
    pricing/                        # +tenancy + snapshot write + scoping (Phase 0)
    realize-raroc/                  # +entity_id query param (Phase 0)
    elasticity-recalibrate/         # +entity_id query param (Phase 0)

e2e/                                # 23 specs Playwright (ai-assistant, auth, pricing-flow,
                                    # deal-blotter, esg-grid, market-data, multi-entity,
                                    # navigation, rules-governance, shocks-reporting,
                                    # reconciliation, pipeline, clv, offline-pwa, rbac, …)

docs/                               # Doc operativa (ver índice abajo)
  api-spec.yaml                     # OpenAPI v2 (refresh tras Phase 0-5)
  pricing-methodology.md            # Metodología FTP (preexistente)
  supabase-setup.md                 # Setup local
  roadmap.md                        # SINGLE SOURCE OF TRUTH del roadmap
  architecture.md                   # Overview maestro vivo
  rls-audit-2026-04.md              # Auditoría RLS preexistente
  security-baseline-2026-04.md      # Baseline seguridad
  pricing-calculation-observability.md
  pricing-plugin-architecture.md
  phase-0-design.md                 # Phase 0 diseño conceptual (operativo para flip strict)
  phase-0-technical-specs.md        # SQL + tipos + OpenAPI delta + ejemplos
  phase-0-rollout.md                # Env vars + secuencia rollout
  external-readiness-gates.md       # Gates bloqueados por input externo
  integration-tests.md              # Cómo correr tests opt-in
  platform-restructure.md           # Estado split packages/*
  pivot/                            # Material exploratorio vivo
  runbooks/                         # 13 plantillas operativas
    README.md tenancy-violation.md tenancy-strict-flip.md
    pricing-latency.md snapshot-write-failure.md mock-fallback.md
    campaign-volume-exhausted.md adapter-down.md
    feature-flag-kill-switch.md backtest-drift.md
    clv-ops.md escalation-timeouts.md seed-demo.md replit-demo.md
```

## Arquitectura y flujo de datos

### Capas

1. **Browser SPA** (Vite) — React + Contexts + React Query.
2. **Express server** (`server/`) — pg.Pool, JWT, tenancy middleware,
   routes para todos los dominios, alert evaluator opt-in.
3. **Supabase Edge Functions** (Deno) — pricing en producción (escribe
   snapshots), realize-raroc cron mensual, elasticity-recalibrate cron
   nocturno.
4. **Postgres** — schema versionado en `supabase/migrations/`, RLS estricto
   con `entity_id` por tabla.
5. **Adapter layer** (`integrations/`) — interfaces para CoreBanking, CRM,
   MarketData, SSO. Reference in-memory + stubs Salesforce/Bloomberg para
   producción real.

### Multi-tenancy (Phase 0)

- Cada request entity-scoped pasa por `tenancyMiddleware` → valida
  `x-entity-id` contra `entity_users`, popula `req.tenancy`.
- `withTenancyTransaction(tenancy, fn)` opcional para handlers que necesitan
  RLS estricto: `SET LOCAL app.current_entity_id` dentro de transacción.
- Edge Functions hacen validación equivalente con cliente Supabase
  autenticado antes de tocar service role.
- Flag `TENANCY_ENFORCE` (default `off` durante rollout, flip a `on` en prod).
- Flag `TENANCY_STRICT` controla si `get_current_entity_id()` lanza error o
  cae a Default Entity (rollout en 4 fases — ver `docs/phase-0-rollout.md`).

### Reproducibilidad (Phase 0)

- Cada llamada al motor escribe `pricing_snapshots` con input + context
  completo + output + sha256 hashes + engine_version + as_of_date.
- `POST /api/snapshots/:id/replay` re-ejecuta el motor real con el snapshot
  guardado y produce un diff field-level (deltaAbs + deltaBps).
- Tabla inmutable por RLS (sin UPDATE/DELETE policies) + trigger que
  rechaza inserts sin hash.

### SLO + alertas (Phase 0)

- Vista materializada `pricing_slo_minute` agrega p50/p95/p99 por minuto.
- 8 SLIs catalogados en `types/phase0.ts` (`PRICING_SLOS`).
- Alert evaluator: pure core (`alertEvaluatorCore.ts`) + adapters DB +
  loop opt-in via `ALERT_EVAL_INTERVAL_MS`.
- 5 canales: email, Slack, PagerDuty, webhook (HMAC), Opsgenie.
- 7 runbooks operativos en `docs/runbooks/`.

### Customer 360 (Phase 1)

- 3 tablas nuevas: `client_positions`, `client_metrics_snapshots`,
  `pricing_targets`.
- `buildClientRelationship` agrega cliente + posiciones + métricas + targets
  aplicables en una vista `ClientRelationship`.
- Cross-bonus relacional: `deriveAttachmentsFromRelationship` consume las
  posiciones del cliente (no per-deal manual).
- Importer CSV: `POST /api/customer360/import/{positions|metrics}`.
- UI: `/customers` con búsqueda + selector + panel relacional.

### Channels & Bulk (Phase 2)

- `POST /api/channel/quote` con `x-channel-key` (sha256(key) en DB).
- Token bucket per-key (capacity = burst, refill = rpm/60).
- Pricing campaigns con state machine y match por
  segment×product×currency×channel×window×volume.
- UI: `/campaigns` con form + transiciones inline.

### Governance (Phase 3)

- Model inventory (SR 11-7 / EBA): `kind`, `version`, `status`, owner,
  validation_doc_url.
- Signed committee dossiers: `sha256(canonicalJson) + HMAC-SHA256` con
  `DOSSIER_SIGNING_SECRET`.
- Drift detector: `detectDrift(BacktestResult)` con thresholds calibrados
  (5%/10% PnL, 1pp/2pp RAROC).

### Integraciones (Phase 4)

- `AdapterResult<T>` Result type — adapters jamás throw.
- `adapterRegistry` singleton con `coreBanking()`, `crm()`, `marketData()`,
  `healthAll()`.
- SSO: `GoogleSsoProvider` real con verificación JWT + restricción de
  hosted domain. Endpoint `/api/auth/me` para introspección.
- Stubs Salesforce + Bloomberg listos para implementación con credenciales
  del banco.

### Observabilidad operativa (Phase 5)

- `usage_events` (append-only) + `usage_aggregates_daily` (materialised view).
- Recordings desde pricing/channel/governance routes (best-effort, no bloquea).
- `tenant_feature_flags` con kill switch.
- **NO billing**: el motor lo opera el banco como parte de su plataforma.
  Las métricas de uso son operativas (capacity / abuse / SLO), no facturables.

## Convenciones de código

### TypeScript

- `strict` activado.
- Preferir `import type`.
- Evitar `any` si existe un tipo razonable.
- Interfaces y tipos de dominio en `types.ts` cuando son compartidos; tipos
  por bloque en `types/{domain}.ts` re-exportados desde `types.ts`.
- Usar unions string literal, no `enum`.
- **Result type para integraciones**: nunca throw en adapters; devolver
  `AdapterResult<T>` discriminado.
- **`noUncheckedIndexedAccess` opt-in incremental** (Bloque 3.a): el flag
  está `false` global pero `tsconfig.strict.json` lo activa para una lista
  de archivos auditados. CI corre `npm run typecheck:strict-audited` además
  del typecheck normal. Para auditar un archivo nuevo:
  1. Revisar cada `arr[i]`; añadir `!` solo donde el bound sea provable
     (post-length-check, dentro de loop bounded, post-regex-match).
  2. Añadir guards (`if`, `??`) donde NO sea provable.
  3. Añadir el archivo a `tsconfig.strict.json` `include`.
  4. `npm run typecheck:strict-audited` debe pasar.
  Estado: 4 archivos auditados (utils/pricing/{nelsonSiegelSvensson,
  interpolation}, utils/ruleMatchingEngine, utils/customer360/csvImport).
  Próximos candidatos prioritarios: shockPresets, liquidityEngine,
  snapshotHash, creditRiskEngine. Cuando todo prod-code esté auditado,
  mover el flag a tsconfig.json global y borrar tsconfig.strict.json.

### React

- Solo componentes funcionales.
- Respetar `react-hooks/rules-of-hooks` y `exhaustive-deps`.
- Estado global vía Context; no introducir Redux/Zustand.
- Vistas nuevas: lazy load en `App.tsx` + entry en `appNavigation.ts`.

### Estilo y UI (NFQ)

- Tailwind utility-first.
- Mantener lenguaje visual NFQ: dark-first, mono labels uppercase para
  KPIs, JetBrains Mono para números, ghost borders, no divider lines.
- Reutilizar `components/ui/` y tokens existentes.
- Soportar desktop y mobile.

### Server / DB

- Endpoints entity-scoped: usar `req.tenancy.entityId` como filter; jamás
  confiar en `entity_id` del body sin validar.
- Mutaciones complejas: `withTenancyTransaction` (no `withTransaction`
  pelado).
- `set_config($1, $2, true)` — nunca interpolar UUIDs en `SET LOCAL`.
- Mappers snake_case → domain en módulos junto al aggregator
  (`utils/{domain}/`), no en `api/` o `routes/`.

### Migraciones

- Numerar `YYYYMMDDNNNNNN_description.sql` cronológico.
- Idempotentes: `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`,
  `DROP POLICY IF EXISTS`.
- RLS: read = `entity_id = ANY(get_accessible_entity_ids())`,
  insert = `entity_id = get_current_entity_id()`,
  delete = `entity_id = get_current_entity_id() AND get_current_user_role() = 'Admin'`.
- Append-only: omitir UPDATE/DELETE policies (Postgres bloquea por defecto).

## Reglas de dominio financiero

- No hardcodear valores financieros si pueden derivarse de curvas, reglas
  o parámetros.
- Diferenciar claramente tasas internas, margen comercial y output mostrado.
- Tratar shocks como alteraciones del contexto de pricing, no como atajos
  visuales.
- Mantener coherencia entre FTP, `finalClientRate`, margen y RAROC.
- No mezclar divisas en agregados "consolidados" sin breakdown explícito.

## Motor de pricing

19 componentes principales:

- Fórmulas por producto.
- Liquidity premium y curvas duales.
- CLC / LCR charge.
- NSFR charge.
- Liquidity recharge.
- Capital charge y capital income.
- Effective tenors: DTM, RM, BM.
- Currency basis.
- Incentivisation.
- SDR modulation.
- ESG transition y physical.
- Greenium / Movilización (descuento por formato green).
- DNSH Capital Discount (reducción capital por cumplimiento DNSH).
- ESG Pillar I / ISF (Infrastructure Supporting Factor, Art. 501a CRR2).
- RAROC y economic profit.

Plus, post-roadmap:

- Cross-bonus relacional consumiendo posiciones del cliente.
- Pricing targets aplicados como pre-aprobado / hard floor.
- Campaign delta aplicado a `finalClientRate` en channel quotes.
- Snapshot inmutable de cada ejecución para reproducibilidad regulatoria.

## Vistas y navegación (31 ViewState)

**Sidebar principal (22):** Clients, Pipeline, Campaigns, Targets,
Calculator, RAROC, Stress Test, Stress Pricing, What-If, Deal Blotter,
Yield Curves, Behavioural Models, Methodology, Analytics, Pricing Discipline,
Attribution reporting, Model Inventory, Dossiers, Approvals,
Budget reconciliation, FTP Reconciliation, AI Assistant.

**AUX via Command Palette:** Accounting Ledger, Snapshot Replay, SLO Dashboard,
Adapter Health, Escalations, Attribution matrix.

**Bottom nav:** User Configuration, User Management, System Audit
(con SLO Panel embebido), User Manual.

## Testing

- **Unit (Vitest 4):** ~85 archivos, ~1.37k tests + 17 integration opt-in.
- **E2E (Playwright 1.59):** 23 specs.
- **Component (Storybook 8.6):** stories en `*.stories.tsx`.
- **Integration RLS (opt-in):** `INTEGRATION_DATABASE_URL=… npx vitest run utils/__tests__/integration`.
- Para cálculos financieros usar `toBeCloseTo`.
- Cualquier cambio en `pricingEngine`, `ruleMatchingEngine`, accounting
  derivation o helpers críticos: test nuevo o ajuste explícito.
- Antes de push: `npm run verify:full`.

## Base de datos y Supabase

- 43 migrations SQL secuenciales en `supabase/migrations/` (última:
  `20260630000002_push_subscriptions.sql`; la anterior es
  `20260630000001_attribution_threshold_recalibrations.sql`).
- Schema principal: la secuencia de `supabase/migrations/*.sql`. Los snapshots
  SQL legacy fueron retirados para evitar drift.
- `api/` (cliente) usa `api/mappers.ts` para snake_case ↔ camelCase.
- `utils/supabase/` queda para servicios especializados (approval, audit,
  monitoring, methodology, reporting).
- Edge Function de pricing valida tenancy explícitamente antes de tocar
  service role; ver `supabase/functions/pricing/index.ts`.
- `server/migrate.ts` es ahora un **thin wrapper** sobre `server/migrationRunner.ts`
  (ex 1154L de schema inline → 37L). Boot de Node-only / Replit / CI aplica
  la secuencia completa de `supabase/migrations/*.sql` en orden, con bootstrap
  Supabase-compat (auth schema + roles + publication) automático para envs
  no-Supabase. Tracking en `_n_pricing_migrations` (con content hash) evita
  re-aplicar y detecta tampering. **Cualquier tabla nueva = nueva migration,
  ya NO se toca el server**. Fin del bug-magnet histórico (PRs #55/#56/#57).
  Variable `N_PRICING_MIGRATIONS_DIR` permite override del path si el deploy
  separa server compilado de los SQL.

## Variables de entorno clave

| Var | Default | Efecto |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection (pg.Pool). Replit la inyecta con `postgresql-16` |
| `JWT_SECRET` | dev fallback | Required en producción |
| `VITE_GOOGLE_CLIENT_ID` | — | Habilita botón Google SSO en Login |
| `GOOGLE_ALLOWED_HOSTED_DOMAIN` | unset | Restringe SSO a un Workspace domain |
| `VITE_DEMO_USER` / `VITE_DEMO_PASS` / `VITE_DEMO_EMAIL` | unset | Sin los dos primeros NO se renderiza el formulario demo (`components/ui/Login.tsx`). El server responde 503 en `/api/auth/demo` si faltan |
| `SEED_DEMO_ON_BOOT` | unset | `true` dispara `scripts/seed-demo-dataset.ts` tras `runMigrations()` (idempotente). Usado en Replit |
| `TENANCY_ENFORCE` | `off` | `on` activa `tenancyMiddleware` global |
| `TENANCY_STRICT` | `off` | `on` hace que `get_current_entity_id()` lance error |
| `PRICING_ALLOW_MOCKS` | unset (false) | `true` permite fallbacks a mock data. Gobierna 2 rutas: (a) Edge Function de pricing (rechaza con 400 si falta config y flag=false); (b) `server/integrations/bootstrap.ts` (Ola 10.3) — si `NODE_ENV=production` y `ADAPTER_<KIND>=<real>` pero faltan credenciales, el boot **lanza** salvo que esta flag sea `true`. Runbook: `docs/runbooks/mock-fallback.md` |
| `ENGINE_VERSION` | `dev-local` | Git sha grabado en pricing_snapshots |
| `ALERT_EVAL_INTERVAL_MS` | unset (off) | ≥1000 activa el alert worker |
| `ESCALATION_SWEEP_INTERVAL_MS` | unset (off) | ≥1000 activa el escalation sweeper |
| `LTV_SNAPSHOT_INTERVAL_MS` | unset (off) | ≥60000 activa el worker de refresh CLV |
| `CRM_SYNC_INTERVAL_MS` | unset (off) | ≥1000 activa el pull CRM → client_events |
| `ADAPTER_CRM` | `in-memory` | `salesforce` usa el stub real (Phase 4) |
| `ADAPTER_MARKET_DATA` | `in-memory` | `bloomberg` usa el stub real (Phase 4) |
| `ADAPTER_ADMISSION` | `in-memory` | `puzzle` usa stub PUZZLE-BM (Ola 9 Bloque A). Requiere `PUZZLE_BASE_URL/CLIENT_ID/CLIENT_SECRET` |
| `ADAPTER_CORE_BANKING` | `in-memory` | `bm-host` usa stub HOST mainframe SFTP (Ola 9 Bloque B). Requiere `BM_HOST_SFTP_HOST/USER/PRIVATE_KEY_PEM` + `BM_HOST_DROP_DIRECTORY` |
| `ADAPTER_BUDGET` | `in-memory` | `alquid` usa stub ALQUID (Ola 9 Bloque C). Requiere `ALQUID_BASE_URL/CLIENT_ID/CLIENT_SECRET` |
| `ATTRIBUTION_DRIFT_INTERVAL_MS` | unset (off) | ≥1000 activa el drift detector worker (Ola 8 Bloque C) |
| `ATTRIBUTION_RECALIBRATION_INTERVAL_MS` | unset (off) | ≥1000 activa el threshold recalibrator worker (Ola 10 Bloque B) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | unset | Web Push real sender (Ola 10 Bloque C). Sin esto los endpoints `/notifications/push/*` devuelven 503 `no_vapid_config`. Generar con `node -e "console.log(require('web-push').generateVAPIDKeys())"` |
| `VAPID_SUBJECT` | `mailto:ops@n-pricing.local` | Exigido por la spec Web Push. Debe ser `mailto:` o URL `https://` |
| `DOSSIER_SIGNING_SECRET` | dev fallback | Required en producción |
| `VITE_PRICING_APPLY_CURVE_SHIFT` | unset (false) | `true` → motor honra `ShockScenario.curveShiftBps` per-tenor (Ola 6 B.4). Off = legacy uniform `interestRate` shift. El chip del header de `/stress-pricing` lo surfacea |
| `INTEGRATION_DATABASE_URL` | unset | Activa tests de integración (opt-in) |
| `ALLOWED_ORIGINS` | localhost dev | CORS allowlist |
| `VITE_NPRICING_DEPRECATE_ALM` / `VITE_ALQUID_BASE_URL` | false / prod | Pivot flags ALM → Alquid |
| `VITE_GEMINI_API_KEY` | — | AI Assistant |

## Git y cambios

- Commits con prefijos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
  `security`.
- Co-Authored-By: Claude Opus 4.6 (1M context) cuando el commit es
  asistido por Claude Code.
- No meter artefactos como `playwright-report/` o `test-results/`.
- CI: GitHub Actions (`ci.yml`), deploy automático a Vercel.

## Áreas sensibles

- `pricingEngine.ts` + `utils/pricing/`: cualquier cambio impacta calculator,
  reporting, shocks, accounting, snapshots, replays y backtests.
- `types.ts` y re-exports `types/*.ts`: cambios pequeños pueden tener mucho
  alcance.
- `useSupabaseSync.ts` + `hooks/supabaseSync/`: tocar con cuidado para no
  romper fallback offline.
- `api/mappers.ts`: errores en mapeo afectan toda la persistencia.
- `GovernanceContext.tsx`: flujos de aprobación dependen de este contexto.
- `server/middleware/tenancy.ts`: cualquier regresión aquí es crítica
  para multi-tenant — siempre añadir test antes de modificar.
- `supabase/functions/pricing/index.ts`: el snapshot write y la tenancy
  validation son obligatorios; nunca eliminar sin reemplazo.
- `utils/attributions/attributionRouter.ts` + `attributionSimulator.ts`
  (Ola 8): el simulator cliente-side y el server router consumen el mismo
  motor puro. Cualquier divergencia rompe la paridad UX↔server. Test fuzz
  de paridad antes de tocar.
- `attribution_decisions` (Ola 8): append-only por RLS. Para anular se
  inserta una row nueva con `decision='reverted'`, NUNCA UPDATE/DELETE.
  Trigger `validate_attribution_decision_hash` rechaza inserts con
  `pricing_snapshot_hash` inexistente.
- `web-push` library (Ola 10 Bloque C): si VAPID keys no están
  configuradas, los workers hacen `skipped='no_vapid'` sin lanzar.
  Endpoints devuelven 503 explícito. **Failing closed, no fail loud**.

## Cobertura Banca March (Olas 8 + 9 + 10)

Roadmap completo merged en `main` (12 commits, ~13.5k LOC, 1794 tests):

- **Ola 8 — Atribuciones jerárquicas** · schema + tipos + módulos puros +
  server router + UI (Approval Cockpit + Simulator + Matrix Editor) +
  reporting + drift detector + i18n + e2e Playwright + storybook.
- **Ola 9 — Integración Banca March** · PUZZLE adapter (admisión) + HOST
  mainframe (file-drop SFTP + reconciliation) + ALQUID wrapper
  (BudgetReconciliationView). 3 stubs in-memory para demo + 3 reales
  pendientes de credenciales BM (workshop S10 IT BM).
- **Ola 10 — Hardening + AI** · AI grounding (copilot Cmd+K entiende la
  matriz + drift signals), drift recalibrator automático (governance
  flow Admin/Risk_Manager), mobile-first cockpit, Web Push real con
  VAPID + escalation push dispatcher.

Demo deck comercial: `~/Developer/Cowork/decks/n-pricing-banca-march-demo.html`.

## Pitfalls comunes

- **Tenancy legacy (RESUELTO 2026-04-22, mantener el patrón):**
  `server/routes/config.ts`, `server/routes/audit.ts` y
  `server/routes/deals.ts` ya consumen `entityScopedClause(req, N)` para
  reads y `tenancyScope(req)` para writes/deletes. Cualquier nuevo router
  entity-scoped debe reutilizar estos helpers de
  `server/middleware/requireTenancy.ts` — no interpolar `entity_id` del
  body. Ver el patrón vivo en `server/routes/customer360.ts`,
  `campaigns.ts`, `governance.ts`, `metering.ts`.
- `seedData.ts` y Supabase pueden divergir si se cambia uno sin revisar el
  otro. Usar `npm run check:sync`. El script lee la **secuencia completa
  de migrations** como fuente canónica.
- **Migrations consolidadas (RESUELTO 2026-05-13):** el schema inline de
  `server/migrate.ts` (1140L) ha sido retirado. El boot ejecuta el mismo
  runner (`server/migrationRunner.ts`) que CI: bootstrap Supabase-compat
  + iteración de `supabase/migrations/*.sql` en orden + tracking con content
  hash. **Una sola fuente de verdad.** Fin de la clase de bug Ola 6 (PRs
  #55/#56/#57): cualquier divergencia ahora es imposible — solo hay
  migrations. Si una migration nueva necesita seed runtime (p.ej. demo
  user), va en `scripts/seed-demo-dataset.ts` o en una migration de seed
  explícita (patrón `*_seed.sql`), no en el server.
  > Bug pre-existente descubierto durante la consolidación y arreglado en
  > la misma migration: `attribution_decisions.decided_by_user` declaraba
  > `TEXT REFERENCES users(id)` siendo `users.id` UUID — FK estructuralmente
  > inválida que silenciosamente no se aplicaba en clean DBs. Hoy es solo
  > `TEXT` con validación a nivel app.
- **Integration-tests en CI** necesita `postgres:16` con un bootstrap
  Supabase-compat (`.github/workflows/ci.yml` lo hace explícito): la
  publication `supabase_realtime`, los roles `anon`/`authenticated`/
  `service_role`, el schema `auth` con stubs `jwt()`/`uid()`/`users`.
  Cualquier migration nueva que asuma un objeto Supabase-hosted que no
  esté en esa lista debe extender el bootstrap step, no el migration.
- **Demo login en Replit:** `components/ui/Login.tsx:287` sólo renderiza
  el form si **ambos** `VITE_DEMO_USER` y `VITE_DEMO_PASS` están definidos
  en el bundle del cliente. Están ya cableados en `.replit` `[userenv.shared]`.
  Si se borran, el usuario verá únicamente el botón Google.
- **Demo data:** el botón Sign In funciona, pero si
  `SEED_DEMO_ON_BOOT` está desactivado contra una DB vacía las vistas
  Customer Pricing / Blotter / Target Grid aparecerán sin filas. Ver
  [`docs/runbooks/replit-demo.md`](docs/runbooks/replit-demo.md).
- **CSP reporting necesita proxy en Vercel:** `vercel.json` declara
  `report-uri /api/csp-report` y `Reporting-Endpoints: csp-endpoint=...`,
  y `server/routes/cspReport.ts` recibe los reportes. Pero en deploys
  Vercel-only (SPA estática) `/api/*` no llega al Express salvo que se
  añada un rewrite o serverless function. Hoy las violations se pierden
  silenciosamente en Vercel; el endpoint funciona en Replit y en cualquier
  setup que sirva SPA + API desde el mismo origen. **Follow-up:** o (a)
  añadir `{ "source": "/api/csp-report", "destination": "<express-url>" }`
  a `vercel.json` rewrites, o (b) crear `api/csp-report.ts` como Vercel
  serverless function que duplique el handler.
- Las ramas antiguas pueden traer documentación útil pero también supuestos
  desactualizados.
- Recharts y módulos lazy pueden introducir warnings no bloqueantes;
  distinguirlos de errores reales.
- Un "fix visual" en calculator o shocks puede esconder un bug de negocio
  si cambia outputs y no solo layout.
- React Query cache puede enmascarar datos stale si no se invalida bien.
- **Tenancy nuevo:** un endpoint sin `req.tenancy?` check leakea cross-tenant
  silenciosamente. Usar el patrón de los routers `customer360` / `governance`
  / `metering` como referencia.
- **Snapshots:** olvidar emitir `pricing_snapshots` desde un nuevo path de
  pricing rompe la garantía regulatoria. Buscar referencias en
  `supabase/functions/pricing/index.ts` y replicar.

## Tips para agentes

- Antes de modificar pricing, entender qué consumidor usa ese output.
- Antes de tocar una pantalla grande, localizar primero qué parte es lógica
  derivada y cuál es solo render.
- Si un cambio afecta persistencia, revisar `api/`, `utils/supabase/`,
  auditoría y snapshots.
- Usar `hooks/queries/queryKeys.ts` para invalidar cache de React Query
  correctamente.
- Para nuevas tablas multi-tenant: copiar el patrón RLS de
  `client_positions` (read accesible / insert current / delete Admin).
- Para nuevos endpoints: copiar el patrón de `routes/customer360.ts` (check
  `req.tenancy`, devolver 400 si falta).
- Para nuevos canales de alerta: implementar `buildXxxPayload` puro +
  case en el dispatcher de `integrations/alertChannels.ts`.

## Documentación canónica

| Archivo | Propósito |
|---|---|
| `README.md` | Overview ejecutivo del producto |
| `docs/roadmap.md` | **Single source of truth** del roadmap (Olas, Phases, pendientes, gates) |
| `docs/architecture.md` | **Overview maestro** vivo (lectura recomendada) |
| `docs/api-spec.yaml` | OpenAPI v2 |
| `docs/external-readiness-gates.md` | Gates externos para producción real |
| `docs/phase-0-design.md` + `phase-0-technical-specs.md` + `phase-0-rollout.md` | Tenancy/snapshots/SLO completo |
| `docs/integration-tests.md` | Cómo correr los tests integración opt-in |
| `docs/runbooks/` | 13 plantillas operativas para on-call |
| `docs/runbooks/tenancy-strict-flip.md` | Playbook del flip strict (prereqs automatizados post Ola 6) |
| `docs/runbooks/replit-demo.md` | **Demo data flow + troubleshooting Replit** |
| `docs/runbooks/seed-demo.md` | Cómo re-seedar Default Entity manualmente |
| `docs/pricing-methodology.md` | Metodología FTP detallada |
| `docs/security-baseline-2026-04.md` | Baseline de seguridad |
| `docs/rls-audit-2026-04.md` | Auditoría RLS preexistente |
