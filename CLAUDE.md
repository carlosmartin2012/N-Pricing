# CLAUDE.md — N-Pricing

> Contexto esencial para agentes IA que trabajan en este repositorio.
> Última actualización: 2026-04-23 (Ola 6 completa en `main` — A + B + C merged).
> **Lectura obligatoria antes de tocar código:** [`docs/integral-review-2026-04-18.md`](docs/integral-review-2026-04-18.md)
> (hallazgos verificados, falsos positivos descartados, propuesta de evolución en 3 olas).
> **Ola 6 completa (16 PRs merged, `#42–#57`):** estado por bloque en
> [`docs/ola-6-tenancy-strict-stress-pricing.md`](docs/ola-6-tenancy-strict-stress-pricing.md);
> resumen ejecutivo y follow-ups en
> [`docs/roadmap-execution-summary.md`](docs/roadmap-execution-summary.md).

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
| Testing | Vitest 4 (~1.0k tests, 80 archivos) + Playwright 1.59 (20 specs) |
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
npm run test             # Vitest (~1.0k tests, 80 archivos)
npm run test:e2e         # Playwright (20 specs)
npm run verify           # lint + typecheck + edge + sync + data + security + test + build + bundle
npm run verify:full      # verify + test:e2e
npm run check:sync       # Validar seed↔schema (lee migrations + schema_v2 fallback)
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

## Estructura del proyecto (post-roadmap)

```text
App.tsx                    # Shell principal, lazy loading, routing
appNavigation.ts           # Navegación (17 vistas — +Stress Pricing en Ola 6 B.5)
types.ts                   # Tipos de dominio + re-exports de types/*
translations.ts            # i18n (en/es)

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
  seed-tenancy-alerts.ts       # Alert rules demo
  check-bundle-size.ts
  check-seed-schema-sync.ts
  check-data-quality.ts
  check-dependency-audit.ts
  recapture-brochure.mjs       # Regenera screenshots del brochure HTML

server/                    # Express server
  index.ts                 # Bootstrap + runMigrations + seed-on-boot opcional + routers + middlewares
  db.ts                    # pg.Pool + withTransaction + withTenancyTransaction
  migrate.ts               # Schema inline + seed Default Entity + demo user/entity_user
  middleware/
    auth.ts                # JWT HMAC propio
    requestId.ts           # Phase 0, x-request-id correlación
    tenancy.ts             # Phase 0, valida x-entity-id contra entity_users
    requireTenancy.ts      # Belt-and-suspenders guard + helpers tenancyScope / entityScopedClause
    errorHandler.ts validate.ts
  routes/
    deals.ts audit.ts config.ts marketData.ts entities.ts
    reportSchedules.ts observability.ts auth.ts gemini.ts pricing.ts
    snapshots.ts           # Phase 0, replay endpoint
    customer360.ts         # Phase 1, CRUD + CSV import
    channelPricing.ts      # Phase 2, /api/channel/quote
    campaigns.ts           # Phase 2, CRUD + state machine
    governance.ts          # Phase 3, model inventory + signed dossiers
    metering.ts            # Phase 5, ops usage observability
    clv.ts reconciliation.ts   # Phase 6 — CLV + FTP reconciliation
  workers/
    alertEvaluatorCore.ts  # Pure evaluation (testable sin DB)
    alertEvaluator.ts      # DB adapters + setInterval loop opt-in
    snapshotReplay.ts      # Re-ejecuta motor con snapshot guardado
    escalationSweeper.ts   # Phase 3.5 — temporal approval escalations
    ltvSnapshotWorker.ts   # Phase 6 — refresca client_ltv_snapshots
    crmEventSync.ts        # Phase 6 — tira eventos CRM → client_events
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
  __tests__/                        # ~78 archivos · ~967 tests + 5 integration

supabase/
  schema.sql (LEGACY — DO NOT EXECUTE) schema_v2.sql fix_rls_realtime.sql
  migrations/                       # 38 migraciones secuenciales (cronológicas)
  functions/
    pricing/                        # +tenancy + snapshot write + scoping (Phase 0)
    realize-raroc/                  # +entity_id query param (Phase 0)
    elasticity-recalibrate/         # +entity_id query param (Phase 0)

e2e/                                # 20 specs Playwright (ai-assistant, auth, pricing-flow,
                                    # deal-blotter, esg-grid, market-data, multi-entity,
                                    # navigation, rules-governance, shocks-reporting,
                                    # reconciliation, pipeline, clv, offline-pwa, rbac, …)

docs/                               # Doc operativa (ver índice abajo)
  api-spec.yaml                     # OpenAPI v2 (refresh tras Phase 0-5)
  pricing-methodology.md            # Metodología FTP (preexistente)
  supabase-setup.md                 # Setup local
  rls-audit-2026-04.md              # Auditoría RLS preexistente
  security-baseline-2026-04.md      # Baseline seguridad
  pricing-calculation-observability.md
  pricing-plugin-architecture.md
  methodology-first-evolution-plan.md
  IMPROVEMENT_PLAN.md
  phase-0-design.md                 # NUEVO — Phase 0 diseño conceptual
  phase-0-technical-specs.md        # NUEVO — SQL + tipos + OpenAPI delta + ejemplos
  phase-0-rollout.md                # NUEVO — env vars + secuencia rollout
  roadmap-execution-summary.md      # Estado por fase tras roadmap
  integration-tests.md              # Cómo correr tests opt-in
  architecture.md                   # Overview maestro post-roadmap
  integral-review-2026-04-18.md     # Hallazgos + 3 olas de evolución
  ola-6-tenancy-strict-stress-pricing.md   # Siguiente ola en marcha
  pivot/ superpowers/               # Material exploratorio
  runbooks/                         # 12 plantillas operativas
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

## Vistas y navegación (17 vistas)

**Principales (13):** Pricing Engine, RAROC Terminal, Stress Testing,
**Stress Pricing** (`/stress-pricing` — 6 presets EBA × deal, Ola 6 B.5),
**Customer Pricing**, **Campaigns**, Deal Blotter, Accounting Ledger,
ALM Reporting, Yield Curves, Target Grid, Pricing Discipline, What-If,
Rules & Config, Behavioural Models, AI Assistant.

**Bottom nav:** User Configuration, User Management, System Audit
(con SLO Panel embebido), User Manual.

## Testing

- **Unit (Vitest 4):** ~85 archivos, ~1.37k tests + 17 integration opt-in.
- **E2E (Playwright 1.59):** 20 specs.
- **Component (Storybook 8.6):** stories en `*.stories.tsx`.
- **Integration RLS (opt-in):** `INTEGRATION_DATABASE_URL=… npx vitest run utils/__tests__/integration`.
- Para cálculos financieros usar `toBeCloseTo`.
- Cualquier cambio en `pricingEngine`, `ruleMatchingEngine`, accounting
  derivation o helpers críticos: test nuevo o ajuste explícito.
- Antes de push: `npm run verify:full`.

## Base de datos y Supabase

- 40 migrations secuenciales en `supabase/migrations/` (última:
  `20260619000004_tenancy_alerts_seed.sql`; la anterior es
  `20260619000003_pricing_snapshots_hash_chain.sql`).
- Schema principal: `supabase/schema_v2.sql` (referencia legacy),
  migrations es la verdad operativa.
- `supabase/schema.sql` está marcado **LEGACY — DO NOT EXECUTE** y ningún
  tooling lo lee.
- `api/` (cliente) usa `api/mappers.ts` para snake_case ↔ camelCase.
- `utils/supabase/` queda para servicios especializados (approval, audit,
  monitoring, methodology, reporting).
- Edge Function de pricing valida tenancy explícitamente antes de tocar
  service role; ver `supabase/functions/pricing/index.ts`.
- `server/migrate.ts` incluye el schema inline para el arranque Node-only
  (dev + Replit). Es un subconjunto de las migrations Supabase; cualquier
  tabla nueva que el server necesite al boot debe añadirse a los dos sitios.

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
| `PRICING_ALLOW_MOCKS` | unset (false) | `true` permite fallbacks a mock data |
| `ENGINE_VERSION` | `dev-local` | Git sha grabado en pricing_snapshots |
| `ALERT_EVAL_INTERVAL_MS` | unset (off) | ≥1000 activa el alert worker |
| `ESCALATION_SWEEP_INTERVAL_MS` | unset (off) | ≥1000 activa el escalation sweeper |
| `LTV_SNAPSHOT_INTERVAL_MS` | unset (off) | ≥60000 activa el worker de refresh CLV |
| `CRM_SYNC_INTERVAL_MS` | unset (off) | ≥1000 activa el pull CRM → client_events |
| `ADAPTER_CRM` | `in-memory` | `salesforce` usa el stub real (Phase 4) |
| `ADAPTER_MARKET_DATA` | `in-memory` | `bloomberg` usa el stub real (Phase 4) |
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
  de migrations** + `schema_v2.sql` como fallback; `supabase/schema.sql`
  está marcado `LEGACY — DO NOT EXECUTE` y el script ya no lo lee.
- `server/migrate.ts` (schema inline para dev/Replit) es un **subconjunto**
  de `supabase/migrations/`. Si añades una tabla que el server necesita al
  arrancar (p.ej. `tenancy_violations`, entity_users default seed), tócala
  en los dos sitios o Replit arrancará con una DB rota.
- **Migrations históricas vs inline schema** (diagnosticado durante Ola 6,
  PRs #55/#56/#57): `server/migrate.ts` es la **verdad operativa** en
  producción. Las migrations en `supabase/migrations/` son la verdad
  *canónica* para envs que corren la secuencia completa (sólo CI lo
  hace hoy). Divergencias entre ambas eran bugs silentes hasta que
  `integration-tests` los destapó. Ejemplos detectados y corregidos:
  `clients.id` (UUID en migration, TEXT en inline), `deals.client_id`
  (idem), FK UUID→BIGSERIAL en `pricing_snapshots`, variable `strict` como
  identifier (reserved en PG 16). **Al añadir columnas con FK o tipos
  concretos, verificar en ambos sitios y en `utils/seedData.ts`.**
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
| `docs/architecture.md` | **Overview maestro** post-roadmap (lectura recomendada) |
| `docs/api-spec.yaml` | OpenAPI v2 |
| `docs/roadmap-execution-summary.md` | Estado fase por fase |
| `docs/integral-review-2026-04-18.md` | Hallazgos + 3 olas de evolución |
| `docs/ola-6-tenancy-strict-stress-pricing.md` | **Ola 6 completa** · estado A/B/C con PR refs |
| `docs/phase-0-design.md` + `phase-0-technical-specs.md` + `phase-0-rollout.md` | Tenancy/snapshots/SLO completo |
| `docs/integration-tests.md` | Cómo correr los tests integración opt-in |
| `docs/runbooks/` | 13 plantillas operativas para on-call |
| `docs/runbooks/tenancy-strict-flip.md` | Playbook del flip strict (prereqs automatizados post Ola 6) |
| `docs/runbooks/replit-demo.md` | **Demo data flow + troubleshooting Replit** |
| `docs/runbooks/seed-demo.md` | Cómo re-seedar Default Entity manualmente |
| `docs/pricing-methodology.md` | Metodología FTP detallada |
| `docs/security-baseline-2026-04.md` | Baseline de seguridad |
| `docs/rls-audit-2026-04.md` | Auditoría RLS preexistente |
