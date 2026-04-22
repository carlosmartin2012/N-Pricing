<div align="center">
<img width="1200" height="475" alt="N-Pricing Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# N-Pricing

**Motor de pricing bancario integral — FTP, customer pricing y channel quotes en una plataforma multi-tenant**

[![CI](https://github.com/carlosmartin2012/n-pricing/actions/workflows/ci.yml/badge.svg)](https://github.com/carlosmartin2012/n-pricing/actions)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev)

</div>

---

## Qué cubre

Tres ámbitos de pricing bancario en una sola plataforma:

1. **FTP / ALM interno** — 19 componentes (curvas, LCR/NSFR, capital,
   ESG Pillar I, etc.), RAROC, stress testing, accounting attribution.
2. **Pricing comercial al cliente** — Customer 360 con relación, posiciones,
   cross-bonus relacional, pricing targets top-down (pre-aprobado / hard floor).
3. **Channel pricing en tiempo real** — `POST /api/channel/quote` con API
   key, rate limit per-key (token bucket), y aplicación automática de
   campañas comerciales versionadas.

Todo opera **multi-tenant** vía RLS Postgres y produce **snapshots
inmutables** de cada cálculo para reproducibilidad regulatoria (SR 11-7 / EBA).

## Funcionalidades por bloque

### Pricing core
| Módulo | Descripción |
|---|---|
| **Pricing Engine** | Motor FTP con 19 componentes (gaps): base rate, liquidity premium, LCR/NSFR, ESG, capital charge, RAROC |
| **RAROC Terminal** | Calculadora standalone con desglose de rentabilidad ajustada al riesgo |
| **Stress Testing** | Shocks dashboard para análisis de sensibilidad |
| **Behavioural Models** | NMD (Parametric + Caterpillar) y Prepayment CPR |
| **Methodology Config** | Reglas, rate cards, ESG grids, master data, governance |
| **ESG Integration** | Transición, físico, Greenium, DNSH discount, ISF Pillar I overlay |

### Customer & commercial *(roadmap Phase 1‑2)*
| Módulo | Descripción |
|---|---|
| **Customer Pricing** *(`/customers`)* | Vista relacional con KPI strip, posiciones, métricas periódicas y targets aplicables |
| **Pricing Campaigns** *(`/campaigns`)* | Campañas versionadas (state machine `draft→approved→active→exhausted`) con form de creación y transiciones inline |
| **Channel API** | `/api/channel/quote` con `x-channel-key` auth + rate limit + match automático de campaña |
| **CSV Importer** | `POST /api/customer360/import/{positions\|metrics}` para bulk loads |

### Governance & risk *(roadmap Phase 3)*
| Módulo | Descripción |
|---|---|
| **Model Inventory** | SR 11-7 / EBA inventory con `kind`, `version`, `status`, owner, validation_doc_url |
| **Signed Dossiers** | Committee dossiers con `sha256(canonicalJson) + HMAC-SHA256` tamper-evident |
| **Backtesting + Drift** | Runner sobre histórico + `detectDrift` con thresholds calibrados |
| **Approval Escalations** | Tracker de tiempos por nivel (L1/L2/Committee) |

### Operations & SaaS readiness *(roadmap Phase 0, 4, 5)*
| Módulo | Descripción |
|---|---|
| **Multi-tenancy** | Tenancy middleware + `withTenancyTransaction` + flag rollout (`TENANCY_ENFORCE`, `TENANCY_STRICT`) |
| **Reproducibility** | Tabla `pricing_snapshots` inmutable + endpoint `POST /api/snapshots/:id/replay` que re-ejecuta el motor real |
| **SLO + Alerts** | 8 SLIs catalogados, vista `pricing_slo_minute`, evaluator opt-in, 5 canales (email/Slack/PagerDuty/webhook/Opsgenie) |
| **Adapter layer** | `CoreBankingAdapter`, `CrmAdapter`, `MarketDataAdapter`, `SsoProvider` con reference in-memory + stubs Salesforce/Bloomberg |
| **SSO Google real** | `GoogleSsoProvider` con verificación JWT + restricción opcional de hosted domain |
| **Tenant provisioning** | `scripts/provision-tenant.ts` idempotente, < 60s SLO |
| **Ops metering** | `usage_events` + `tenant_feature_flags` (sin billing — el motor lo opera el banco) |

### Misc
| Módulo | Descripción |
|---|---|
| **Deal Blotter** | Gestión de operaciones con workflow Draft → Pending → Approved → Booked |
| **ALM Reporting** | 10 dashboards (Overview, Executive, NII, Maturity Ladder, Currency Gap, P&L Attribution, Pricing Analytics, Funding, Snapshots, Behaviour) |
| **Market Data** | Yield curves CRUD, bootstrap zero coupon, liquidity curves |
| **Target Grid / Discipline / What-If** | Olas 1-3 metodológicas (target rates, leakage analytics, sandbox simulations) |
| **AI Assistant** | Gemini con grounding de cartera y mercado |
| **Accounting Ledger** | Asientos contables automáticos por operación |
| **User Mgmt + Audit** | RBAC (Admin, Trader, Risk_Manager, Auditor) con audit trail inmutable |
| **System Health** | Dashboard de salud con SLOPanel embebido |

## Arquitectura

```
React 19 SPA (Vite :5000 + PWA)
├── 7 Context Providers
├── Code-splitting con React.lazy
├── React Query para data fetching
├── Capa API tipada (api/) con mappers
└── Adapter layer (integrations/) para SSO + connectors

Express server (server/ :3001)
├── Postgres pool (pg) con withTenancyTransaction
├── runMigrations() + seed-on-boot opcional al arrancar
├── JWT propio HMAC + Google SSO
├── tenancyMiddleware + requireTenancy + requestIdMiddleware
├── 18 routers de dominio (deals, audit, config, pricing, snapshots,
│   customer360, clv, reconciliation, channels, campaigns, governance,
│   metering, entities, marketData, reportSchedules, observability,
│   auth, gemini)
└── 4 workers opt-in (alertEvaluator, escalationSweeper, ltvSnapshotWorker,
    crmEventSync) + bootstrapAdapters

Supabase Edge Functions (Deno)
├── pricing — escribe pricing_snapshots, valida tenancy
├── realize-raroc — cron mensual, ?entity_id scoping
└── elasticity-recalibrate — cron nocturno, ?entity_id scoping

PostgreSQL (Supabase)
├── 38 migraciones secuenciales
├── RLS estricto por entity_id
├── Helpers: get_current_entity_id, get_accessible_entity_ids
└── Append-only: tenancy_violations, audit_log, *_versions, pricing_snapshots
```

Detalles completos en [docs/architecture.md](./docs/architecture.md).

## Quick Start

### Prerrequisitos

- Node.js >= 18
- Postgres (Supabase local o cualquier instancia accesible)
- Cuenta Supabase opcional para producción

### Instalación local

```bash
git clone https://github.com/carlosmartin2012/n-pricing.git
cd n-pricing
npm install
cp .env.example .env.local  # edita con tus credenciales
npm run dev                 # Vite :5000 + Express :3001 (concurrently)

# Una vez arrancado, en otra pestaña (opcional pero recomendado):
npm run seed:demo           # Puebla DEFAULT_ENTITY_ID con clientes + deals + posiciones + grid
```

### Quickstart en Replit

`.replit` ya trae preconfigurado:

- **Módulo `postgresql-16`** → `DATABASE_URL` se inyecta automáticamente.
- **`[userenv.shared]`** con `VITE_DEMO_USER=demo`, `VITE_DEMO_PASS=n-pricing-demo`,
  `VITE_DEMO_EMAIL=demo@nfq.es`, `VITE_GOOGLE_CLIENT_ID` y `SEED_DEMO_ON_BOOT=true`.
- **Workflow "Project"** → corre `npm run dev` esperando `port 5000` (Vite).
- **Puerto `5000` mapeado a `:80`** para la webview.

Flujo de arranque:

1. Pulsa **Run** en Replit.
2. `server/index.ts` ejecuta `runMigrations()` (crea schema + Default Entity +
   demo user + `entity_users` link).
3. Con `SEED_DEMO_ON_BOOT=true`, el server lanza `scripts/seed-demo-dataset.ts`
   como proceso hijo — idempotente, rellena `clients`, `products`, `deals`,
   `client_positions`, `client_metrics_snapshots`, `client_events`,
   `client_ltv_snapshots`, `client_nba_recommendations`, `target_grid_cells`,
   `tolerance_bands`.
4. Abre la webview → Login → usa `demo / n-pricing-demo`.
5. Todas las vistas (Customer Pricing, Pipeline, Reconciliation, Target Grid,
   Deal Blotter) deben mostrar datos.

Troubleshooting en [docs/runbooks/replit-demo.md](./docs/runbooks/replit-demo.md).

### Variables de entorno principales

| Variable | Required | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | Postgres connection string para el server (pg.Pool) |
| `JWT_SECRET` | sí en prod | Secret HMAC para JWT propio |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | sí | Browser → Supabase |
| `VITE_GOOGLE_CLIENT_ID` | sí | Habilita Google SSO |
| `GOOGLE_ALLOWED_HOSTED_DOMAIN` | no | Restringe SSO a un Workspace |
| `VITE_DEMO_USER` / `VITE_DEMO_PASS` / `VITE_DEMO_EMAIL` | demo | Sin los dos primeros el formulario de login demo NO se renderiza (`components/ui/Login.tsx:287`) |
| `SEED_DEMO_ON_BOOT` | no | `true` ejecuta `scripts/seed-demo-dataset.ts` tras `runMigrations()` (idempotente). Usado en Replit |
| `TENANCY_ENFORCE` | no (`off`) | `on` activa middleware de tenancy global |
| `TENANCY_STRICT` | no (`off`) | `on` hace que el helper PG lance error si falta tenancy |
| `PRICING_ALLOW_MOCKS` | no (`false`) | `true` permite fallback a mock data en pricing |
| `ENGINE_VERSION` | no | Git sha para `pricing_snapshots.engine_version` |
| `ALERT_EVAL_INTERVAL_MS` | no | ≥1000 activa el alert evaluator worker |
| `ESCALATION_SWEEP_INTERVAL_MS` | no | ≥1000 activa el escalation sweeper |
| `LTV_SNAPSHOT_INTERVAL_MS` | no | ≥60000 activa refresco de `client_ltv_snapshots` |
| `CRM_SYNC_INTERVAL_MS` | no | ≥1000 activa pull CRM → `client_events` |
| `ADAPTER_CRM` / `ADAPTER_MARKET_DATA` | `in-memory` | `salesforce` / `bloomberg` para stubs reales |
| `DOSSIER_SIGNING_SECRET` | sí en prod | HMAC para firmar committee dossiers |
| `INTEGRATION_DATABASE_URL` | no | Activa tests integración con DB real (opt-in) |
| `VITE_GEMINI_API_KEY` | no | API key Gemini para AI Assistant |

### Setup de Supabase

1. Crear proyecto en [supabase.com](https://supabase.com) (o `supabase start` local).
2. Aplicar `supabase/migrations/*.sql` en orden cronológico.
3. Habilitar Realtime en las tablas que lo necesiten.
4. Copiar URL + anon key a `.env.local`.

### Provisioning de un nuevo tenant

```bash
tsx scripts/provision-tenant.ts \
  --short-code BANK-ES \
  --name "Bank S.A." \
  --legal-name "Bank, S.A." \
  --country ES \
  --currency EUR \
  --admin-email admin@bank.es
```

Script idempotente, completa entity + admin user + entity_users + 4
default feature flags en una transacción. SLO target < 60 s.

## Scripts

```bash
npm run dev              # Vite :5000 + Express :3001 (concurrently)
npm run build            # Build producción (PWA)
npm run preview          # Preview del build
npm run test             # Vitest (~1.0k tests, 80 archivos)
npm run test:e2e         # Playwright (20 specs)
npm run typecheck        # tsc --noEmit
npm run typecheck:edge   # build Edge + deno check
npm run lint             # ESLint
npm run format           # Prettier
npm run verify           # lint+typecheck+edge+sync+data+security+test+build+bundle
npm run verify:full      # verify + test:e2e
npm run check:sync       # Validar seed↔schema (migrations + schema_v2 fallback)
npm run check:bundle     # Validar tamaños de bundle
npm run check:data-quality
npm run check:security   # Scan deps prod con excepciones gobernadas
npm run seed:demo        # Puebla DEFAULT_ENTITY_ID (idempotente)
npm run seed:clv-demo    # Subset CLV Phase 6
npm run storybook        # Storybook :6006

# Tests integración (opt-in, requieren Postgres real):
INTEGRATION_DATABASE_URL=postgres://… \
  npx vitest run utils/__tests__/integration
```

## Estructura del proyecto

```
api/                    # Cliente API tipado (browser → server)
contexts/               # 7 React Context providers
integrations/           # Phase 4 — adapter layer
  types.ts registry.ts inMemory.ts sso.ts
  sso/google.ts crm/salesforce.ts marketData/bloomberg.ts
scripts/                # provision-tenant, seed-demo-dataset, seed-clv-demo,
                        # check-{bundle-size,seed-schema-sync,data-quality,dependency-audit}
server/                 # Express + pg.Pool
  middleware/ routes/ workers/ integrations/
components/             # React components por dominio
  Customer360/ Campaigns/ Admin/ CLV/ Pipeline/ Reconciliation/ ...
types/                  # Tipos por dominio (re-exportados desde types.ts)
utils/                  # Pricing engine + helpers
  pricing/ customer360/ channels/ governance/ metering/ backtesting/ clv/
supabase/
  migrations/           # 38 migraciones secuenciales
  functions/            # 3 Edge Functions Deno
e2e/                    # 20 specs Playwright
docs/                   # Doc operativa + runbooks
  runbooks/             # 12 plantillas operativas (incluye replit-demo.md)
public/                 # PWA assets
```

## Motor de Pricing (FTP)

Fórmula completa con 19 componentes:

```
FTP = BaseRate + LiquidityPremium + LCR_Charge + NSFR_Charge
    + CurrencyBasis + CreditCost + OperationalCost + CapitalCharge
    + ESG_Adjustment + Greenium + StrategicSpread ± Incentivisation
    - DNSH_Capital_Discount - ISF_Pillar1_Overlay
```

4 metodologías: **Matched Maturity**, **Moving Average**, **Rate Card**,
**Zero Discount**.

Cada llamada al motor se materializa como un `pricing_snapshots` con
input + context + output + sha256 hashes, garantizando que el deal puede
re-ejecutarse byte-perfect en el futuro vía
`POST /api/snapshots/:id/replay`.

Ver detalle en [docs/pricing-methodology.md](./docs/pricing-methodology.md).

## Testing

| Tipo | Comando | Cobertura |
|---|---|---|
| Unit | `npm run test` | ~1.0k tests · 80 archivos |
| Integration (opt-in) | `INTEGRATION_DATABASE_URL=… npx vitest run utils/__tests__/integration` | RLS + tenancy + fuzz |
| E2E | `npm run test:e2e` | 20 specs Playwright |
| Storybook | `npm run storybook` | Component stories |

Cubre motor FTP completo, RAROC, curvas, rule matching, deal workflow,
governance, validación, audit, snapshots reproducibles, drift detector,
canales de alerta, token bucket, campaign matching, customer 360
relationship aggregation, dossier signing.

Detalle de integration tests en [docs/integration-tests.md](./docs/integration-tests.md).

## Roles y permisos

| Rol | Permisos |
|---|---|
| **Admin** | Acceso total: configuración, usuarios, aprobación, kill switch |
| **Trader** | Crear/editar deals, ver reporting |
| **Risk_Manager** | Aprobar deals, modificar deals booked, methodology + campaigns |
| **Auditor** | Solo lectura + acceso a audit log + dossier verify |

## Deploy

### Vercel (recomendado)

1. Conectar el repositorio a Vercel.
2. Configurar variables de entorno en el dashboard.
3. Deploy automático en cada push a `main`.

### On-premise (banco)

El producto está diseñado para SaaS-first con flexibilidad on-premise.
Para despliegue interno del banco:

1. `Postgres` propio + aplicar las 38 migrations.
2. `node server/index.js` (build TS) tras `npm run build:server`.
3. Edge Functions opcionales (deploy independiente vía Supabase CLI).
4. Adapter layer: registrar implementaciones reales en `server/index.ts`
   bootstrap (sustituyendo los stubs Salesforce/Bloomberg).

## Tech Stack

- **Frontend**: React 19.2 + TypeScript 5.8 + Tailwind CSS 3
- **Build**: Vite 6.2 + vite-plugin-pwa
- **Data fetching**: @tanstack/react-query 5
- **Server**: Express + pg.Pool
- **Backend storage**: Supabase (PostgreSQL 15+, Realtime, RLS, Edge Functions Deno)
- **Auth**: JWT HMAC propio + Google SSO real (`GoogleSsoProvider`)
- **AI**: Google Generative AI (@google/genai)
- **Charts**: Recharts 3.7
- **Export**: xlsx + PDF
- **Testing**: Vitest 4 + Playwright 1.59 + Storybook 8.6
- **CI/CD**: GitHub Actions + Vercel

## Roadmap & estado

- ✅ **Phase 0** — Tenancy hardening + reproducibility snapshots + SLO
- ✅ **Phase 1** — Customer 360 (schema + UI + CSV importer)
- ✅ **Phase 2** — Channels & Bulk Ops (channel API + campaigns + UI)
- ✅ **Phase 3** — Model Inventory + Signed Dossiers + Drift Detector
- ✅ **Phase 4** — Adapter layer + GoogleSsoProvider real (+ stubs)
- ✅ **Phase 5** — Tenant provisioning + ops metering (sin billing SaaS)
- ✅ **Phase 6** — CLV 360 (ltvEngine + NBA + Pipeline) + FTP Reconciliation
- ✅ **Unificación demo↔live** — MOCK_DEALS y Customer 360 viven en DB bajo `DEFAULT_ENTITY_ID`
- 🚧 **Ola 6** — TENANCY_STRICT global + Stress EBA 6 escenarios ([detalle](./docs/ola-6-tenancy-strict-stress-pricing.md))

Detalle fase por fase en
[docs/roadmap-execution-summary.md](./docs/roadmap-execution-summary.md).

## Documentación

| Para… | Lee… |
|---|---|
| Onboarding técnico rápido | [docs/architecture.md](./docs/architecture.md) |
| Contexto IA / agentes | [CLAUDE.md](./CLAUDE.md) |
| Demo en Replit (troubleshooting) | [docs/runbooks/replit-demo.md](./docs/runbooks/replit-demo.md) |
| Estado del roadmap | [docs/roadmap-execution-summary.md](./docs/roadmap-execution-summary.md) |
| Siguiente ola en marcha | [docs/ola-6-tenancy-strict-stress-pricing.md](./docs/ola-6-tenancy-strict-stress-pricing.md) |
| Integral review 2026-04 | [docs/integral-review-2026-04-18.md](./docs/integral-review-2026-04-18.md) |
| Operación / on-call | [docs/runbooks/](./docs/runbooks/) (12 plantillas) |
| Rollout de tenancy + flags | [docs/phase-0-rollout.md](./docs/phase-0-rollout.md) |
| Diseño Phase 0 detallado | [docs/phase-0-design.md](./docs/phase-0-design.md) + [phase-0-technical-specs.md](./docs/phase-0-technical-specs.md) |
| API / contratos | [docs/api-spec.yaml](./docs/api-spec.yaml) |
| Metodología FTP | [docs/pricing-methodology.md](./docs/pricing-methodology.md) |
| Setup Supabase | [docs/supabase-setup.md](./docs/supabase-setup.md) |
| Tests integración | [docs/integration-tests.md](./docs/integration-tests.md) |
| Seguridad baseline | [docs/security-baseline-2026-04.md](./docs/security-baseline-2026-04.md) |

## Licencia

Proyecto privado. Todos los derechos reservados.
