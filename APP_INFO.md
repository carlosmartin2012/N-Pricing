# N Pricing — Application Information

## Project Overview
**N Pricing** is an end-to-end bank pricing platform covering three integrated
scopes on a single engine:

1. **Funds Transfer Pricing (FTP)** — internal transfer rates, RAROC,
   regulatory costs (LCR / NSFR), capital, ESG overlays. 19 components.
2. **Customer Pricing (Customer 360)** — relational view with positions,
   cross-bonus, pricing targets top-down, CLV engine, NBA recommendations.
3. **Channel Pricing (real-time)** — `POST /api/channel/quote` with API key,
   token-bucket rate limit per channel, and automatic application of
   versioned campaigns.

Multi-tenant via Postgres RLS. Immutable `pricing_snapshots` per execution
guarantee reproducibility for regulatory review (SR 11-7 / EBA).

## Key Modules

### Pricing & Risk
- **Pricing Engine** — FTP motor with 19 components: base rate, liquidity
  premium, LCR / NSFR charges, ESG (transition, physical, Greenium, DNSH,
  ISF Pillar I overlay), capital charge, effective tenors (DTM, RM, BM),
  currency basis, SDR modulation, incentivisation.
- **RAROC Terminal** — standalone calculator with economic profit breakdown.
- **Stress Testing** — shock control panel (moving toward EBA 6 scenarios, Ola 6).
- **Behavioural Models** — NMD (Parametric + Caterpillar) and Prepayment CPR.
- **Target Grid / Discipline / What-If** — Waves 1–3 (target rates, leakage,
  sandboxes).

### Customer & Commercial
- **Customer Pricing (`/customers`)** — relational KPI strip, positions,
  quarterly metrics, applicable targets, churn signals.
- **CLV 360** — `ltvEngine` with `computeLtv` (point + p5/p95), assumptions
  hash, NBA recommendations, firmwide Pipeline (`/pipeline`).
- **Pricing Campaigns (`/campaigns`)** — state machine
  (`draft → approved → active → exhausted`) with segment × product × currency
  × channel × window × volume match.
- **Channel API** — `/api/channel/quote` with `x-channel-key` auth, token
  bucket per key, campaign match.
- **CSV Importer** — `POST /api/customer360/import/{positions|metrics}`.

### Governance & Reproducibility
- **Model Inventory** (SR 11-7 / EBA) — `kind`, `version`, `status`, owner.
- **Signed Dossiers** — `sha256(canonicalJson) + HMAC-SHA256` tamper-evident.
- **Backtesting + Drift** — runner + `detectDrift` with calibrated thresholds.
- **Approval Escalations** — temporal tracker with sweep worker.
- **FTP Reconciliation** — `/reconciliation` (Phase 6.9).
- **Snapshots** — `pricing_snapshots` table immutable by RLS + trigger;
  `POST /api/snapshots/:id/replay` re-runs the engine against the stored
  context and produces a field-level diff.

### Operations
- **Multi-tenancy** — `tenancyMiddleware` + `withTenancyTransaction`, flag
  rollout via `TENANCY_ENFORCE` / `TENANCY_STRICT`.
- **SLO + Alerts** — 8 SLIs, materialized view `pricing_slo_minute`, opt-in
  alert evaluator with 5 channels (email, Slack, PagerDuty, webhook,
  Opsgenie).
- **Adapter Layer** — `CoreBankingAdapter`, `CrmAdapter`, `MarketDataAdapter`,
  `SsoProvider` with in-memory reference + stubs Salesforce / Bloomberg /
  Google SSO real.
- **Tenant Provisioning** — `scripts/provision-tenant.ts` idempotent, < 60s.
- **Ops Metering** — `usage_events` + `tenant_feature_flags` (no billing).

### Misc
- **Deal Blotter** — deals workflow `Draft → Pending → Approved → Booked`.
- **ALM Reporting** — Overview, Executive, NII, Maturity Ladder, Currency Gap,
  P&L Attribution, Funding, Snapshots, Behaviour.
- **Market Data** — yield curves CRUD, bootstrap zero coupon, liquidity curves.
- **Accounting Ledger** — auto journal entries per deal.
- **User Management + Audit** — RBAC (Admin, Trader, Risk_Manager, Auditor)
  with immutable audit trail.
- **AI Assistant** — Gemini with portfolio + market grounding.
- **System Health** — dashboard with SLO panel.

## Technology Stack
- **Frontend**: React 19.2, TypeScript 5.8, Tailwind CSS 3.
- **Build**: Vite 6.2 (:5000) + vite-plugin-pwa.
- **Data fetching**: @tanstack/react-query 5.
- **Forms**: react-hook-form 7.
- **Virtualization**: @tanstack/react-virtual 3.
- **Charts**: Recharts 3.7. **Icons**: Lucide React.
- **Export**: SheetJS (xlsx) + PDF.
- **AI**: Google Generative AI (@google/genai).
- **Server**: Express 5 + pg.Pool 8 (port :3001).
- **Backend**: Supabase (PostgreSQL 15+, Realtime, RLS, Edge Functions Deno).
- **Auth**: JWT HMAC propio + `GoogleSsoProvider` (@react-oauth/google).
- **Testing**: Vitest 4 (~1.0k tests, 80 archivos) + Playwright 1.59 (20 specs)
  + Storybook 8.6.
- **CI/CD**: GitHub Actions + Vercel; Replit-ready (nodejs-18 + postgresql-16).

## System Architecture
- `App.tsx` — main shell with lazy loading and view routing.
- `api/` — 21 typed client modules for all server endpoints (snake_case ↔
  camelCase via `api/mappers.ts`).
- `contexts/` — 9 React Context providers (Auth, Data, UI, Governance,
  MarketData, Entity, Walkthrough, ...).
- `hooks/` — React Query wrappers (`queries/`) and decomposed Supabase sync
  (`supabaseSync/`). 30+ hook files.
- `components/` — 227 component files across ~20 domain directories
  (`Calculator/`, `Customer360/`, `Campaigns/`, `CLV/`, `Pipeline/`,
  `Reconciliation/`, `Admin/`, `RAROC/`, `Risk/`, ...).
- `server/` — 18 routers + 5 middleware + 4 workers + Express bootstrap with
  migrations and opt-in demo seeding.
- `utils/` — 134 utility files (`pricing/`, `customer360/`, `channels/`,
  `governance/`, `metering/`, `clv/`, `backtesting/`).
- `integrations/` — adapter layer (Phase 4).
- `types.ts` + `types/*.ts` — domain types re-exported.
- `translations.ts` — full i18n (English / Spanish).

## Statistics (2026-04-22)
| Metric | Count |
|--------|-------|
| TypeScript / TSX files | 671 |
| Component files | 227 |
| Hook files | 30 |
| Utility files | 134 |
| API modules | 21 |
| Context providers | 9 |
| Unit tests (Vitest) | ~1.0k in 80 files |
| Integration tests (opt-in) | 2 in `utils/__tests__/integration/` |
| E2E specs (Playwright) | 20 |
| Supabase migrations | 38 |
| Server routers | 18 |
| Workers | 4 opt-in |
| Edge Functions (Deno) | 3 |
| Runbooks | 12 |

## Quickstart
- **Local**: `npm install && npm run dev` + `npm run seed:demo` (requires
  `DATABASE_URL`).
- **Replit**: Click **Run**. `.replit` preconfigures Postgres, demo
  credentials and `SEED_DEMO_ON_BOOT=true` so the first page load is
  populated. Login as `demo / n-pricing-demo`.

See `docs/runbooks/replit-demo.md` for troubleshooting and
`docs/architecture.md` for the full architecture overview.
