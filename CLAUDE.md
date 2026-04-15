# CLAUDE.md — N-Pricing

> Contexto esencial para agentes IA que trabajan en este repositorio.
> Última actualización: 2026-04-15 (post-roadmap Phases 0-5).

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
| Testing | Vitest 4 (~972 tests) + Playwright 1.59 (12 specs) |
| Storybook | Storybook 8.6 (React Vite) |
| IA | Google Generative AI (@google/genai) |
| Charts | Recharts 3.7 |
| Export | xlsx + PDF |
| CI/CD | GitHub Actions + Vercel |
| Integraciones | Adapter layer (`integrations/`) — in-memory + stubs Salesforce/Bloomberg |

## Comandos esenciales

```bash
npm install
npm run dev          # Servidor desarrollo (Vite HMR)
npm run build        # Build producción (PWA incluido)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (~972 tests, 78 archivos)
npm run test:e2e     # Playwright
npm run verify:full  # lint + typecheck + test + build + e2e
npm run check:sync   # Validar seed↔schema sync
npm run check:bundle # Validar tamaños de bundle
npm run storybook    # Storybook dev en :6006

# Tests integración (opt-in, requieren Postgres real):
INTEGRATION_DATABASE_URL=postgres://... npx vitest run utils/__tests__/integration

# Tenant provisioning (Phase 5):
tsx scripts/provision-tenant.ts --short-code BANK-ES --name "Bank S.A." --admin-email admin@bank.es
```

## Estructura del proyecto (post-roadmap)

```text
App.tsx                    # Shell principal, lazy loading, routing
appNavigation.ts           # Navegación (16 vistas)
types.ts                   # Tipos de dominio + re-exports de types/*
translations.ts            # i18n (en/es)

api/                       # Cliente API tipado (browser → server)
  index.ts                 # Re-exports
  deals.ts marketData.ts config.ts audit.ts entities.ts
  reportSchedules.ts observability.ts mappers.ts
  customer360.ts           # NUEVO — Phase 1
  campaigns.ts             # NUEVO — Phase 2

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
  provision-tenant.ts      # NUEVO — Phase 5, idempotente, < 60s SLO
  check-bundle-size.ts
  check-seed-schema-sync.ts

server/                    # Express server
  index.ts                 # Bootstrap + routers + middlewares
  db.ts                    # pg.Pool + withTransaction + withTenancyTransaction (NUEVO)
  migrate.ts               # Schema inline para arranque local
  middleware/
    auth.ts                # JWT HMAC propio
    requestId.ts           # NUEVO — Phase 0, x-request-id correlación
    tenancy.ts             # NUEVO — Phase 0, valida x-entity-id contra entity_users
    errorHandler.ts validate.ts
  routes/
    deals.ts audit.ts config.ts marketData.ts entities.ts
    reportSchedules.ts observability.ts auth.ts gemini.ts pricing.ts
    snapshots.ts           # NUEVO — Phase 0, replay endpoint
    customer360.ts         # NUEVO — Phase 1, CRUD + CSV import
    channelPricing.ts      # NUEVO — Phase 2, /api/channel/quote
    campaigns.ts           # NUEVO — Phase 2, CRUD + state machine
    governance.ts          # NUEVO — Phase 3, model inventory + signed dossiers
    metering.ts            # NUEVO — Phase 5, ops usage observability
  workers/                 # NUEVO — Phase 0
    alertEvaluatorCore.ts  # Pure evaluation (testable sin DB)
    alertEvaluator.ts      # DB adapters + setInterval loop opt-in
    snapshotReplay.ts      # Re-ejecuta motor con snapshot guardado
  integrations/
    alertChannels.ts       # email/slack/pagerduty/webhook/opsgenie

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
  schema.sql schema_v2.sql fix_rls_realtime.sql
  migrations/                       # 26 migraciones secuenciales
  functions/
    pricing/                        # +tenancy + snapshot write + scoping (Phase 0)
    realize-raroc/                  # +entity_id query param (Phase 0)
    elasticity-recalibrate/         # +entity_id query param (Phase 0)

e2e/                                # 12 specs Playwright

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
  roadmap-execution-summary.md      # NUEVO — estado por fase tras roadmap
  integration-tests.md              # NUEVO — cómo correr tests opt-in
  architecture.md                   # NUEVO — overview maestro post-roadmap
  runbooks/                         # NUEVO — 7 plantillas operativas
    README.md tenancy-violation.md pricing-latency.md
    snapshot-write-failure.md mock-fallback.md
    campaign-volume-exhausted.md adapter-down.md
    feature-flag-kill-switch.md backtest-drift.md
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

## Vistas y navegación (16 vistas)

**Principales (12):** Pricing Engine, RAROC Terminal, Stress Testing,
**Customer Pricing**, **Campaigns**, Deal Blotter, Accounting Ledger,
ALM Reporting, Yield Curves, Target Grid, Pricing Discipline, What-If,
Rules & Config, Behavioural Models, AI Assistant.

**Bottom nav:** User Configuration, User Management, System Audit
(con SLO Panel embebido), User Manual.

## Testing

- **Unit (Vitest 4):** ~78 archivos, ~967 tests + 5 integration opt-in.
- **E2E (Playwright 1.59):** 12 specs.
- **Component (Storybook 8.6):** stories en `*.stories.tsx`.
- **Integration RLS (opt-in):** `INTEGRATION_DATABASE_URL=… npx vitest run utils/__tests__/integration`.
- Para cálculos financieros usar `toBeCloseTo`.
- Cualquier cambio en `pricingEngine`, `ruleMatchingEngine`, accounting
  derivation o helpers críticos: test nuevo o ajuste explícito.
- Antes de push: `npm run verify:full`.

## Base de datos y Supabase

- 26 migrations secuenciales en `supabase/migrations/`.
- Schema principal: `supabase/schema_v2.sql` (referencia legacy),
  migrations es la verdad operativa.
- `api/` (cliente) usa `api/mappers.ts` para snake_case ↔ camelCase.
- `utils/supabase/` queda para servicios especializados (approval, audit,
  monitoring, methodology, reporting).
- Edge Function de pricing valida tenancy explícitamente antes de tocar
  service role; ver `supabase/functions/pricing/index.ts`.

## Variables de entorno clave

| Var | Default | Efecto |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection (pg.Pool) |
| `JWT_SECRET` | dev fallback | Required en producción |
| `VITE_GOOGLE_CLIENT_ID` | — | Habilita Google SSO |
| `GOOGLE_ALLOWED_HOSTED_DOMAIN` | unset | Restringe SSO a un Workspace domain |
| `TENANCY_ENFORCE` | `off` | `on` activa `tenancyMiddleware` global |
| `TENANCY_STRICT` | `off` | `on` hace que `get_current_entity_id()` lance error |
| `PRICING_ALLOW_MOCKS` | unset (false) | `true` permite fallbacks a mock data |
| `ENGINE_VERSION` | `dev-local` | Git sha grabado en pricing_snapshots |
| `ALERT_EVAL_INTERVAL_MS` | unset (off) | ≥1000 activa el alert worker |
| `DOSSIER_SIGNING_SECRET` | dev fallback | Required en producción |
| `INTEGRATION_DATABASE_URL` | unset | Activa tests de integración (opt-in) |
| `ALLOWED_ORIGINS` | localhost dev | CORS allowlist |

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

- `seedData.ts` y Supabase pueden divergir si se cambia uno sin revisar el
  otro. Usar `npm run check:sync`.
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
| `docs/api-spec.yaml` | OpenAPI v2 (refresh tras Phase 0-5) |
| `docs/roadmap-execution-summary.md` | Estado fase por fase tras 19 commits |
| `docs/phase-0-design.md` + `phase-0-technical-specs.md` + `phase-0-rollout.md` | Tenancy/snapshots/SLO completo |
| `docs/integration-tests.md` | Cómo correr los tests integración opt-in |
| `docs/runbooks/` | 7 plantillas operativas para on-call |
| `docs/pricing-methodology.md` | Metodología FTP detallada |
| `docs/security-baseline-2026-04.md` | Baseline de seguridad |
| `docs/rls-audit-2026-04.md` | Auditoría RLS preexistente |
