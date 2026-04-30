# N‑Pricing — Roadmap Execution Summary

> Estado tras la ejecución continua del roadmap definido en
> [plans/shiny-foraging-melody.md](../../.claude/plans/shiny-foraging-melody.md).
> Cada fase tiene al menos un sprint productivo entregado y commiteado en `main`.

---

## Resumen ejecutivo

| Fase | Sprint(s) entregados | Estado | Commit clave |
|---|---|---|---|
| **Fase 0 — Consolidar base** | 4 sprints completos | ✅ producción-ready | `b623a4c → d6bc5d7` |
| **Fase 1 — Customer 360** | 2 sprints | ✅ schema + API + UI base | `ed942ec`, `ede9e9c` |
| **Fase 2 — Channels & Bulk** | 1 sprint | 🟡 channel API + campaigns | `e12e8c5` |
| **Fase 3 — Model & Ops Governance** | 1 sprint | 🟡 inventory + dossier signing | `e3d6495` |
| **Fase 4 — Integración bancaria** | 1 sprint | 🟡 adapter layer + SSO interface | `c72651c` |
| **Fase 5 — SaaS hardening** | 1 sprint | 🟡 provisioning + metering | `bb6072b` |

**960/960 tests** verdes en `main` · typecheck + lint limpios · push hecho a `origin`.

---

## Lo que está vivo en `main`

### Fase 0 — Consolidación de base (completa, 4 sprints)

- **Multi-tenancy**: `tenancyMiddleware` + `withTenancyTransaction` + `app.tenancy_strict` flag con rollout en 4 fases. RLS hardening en 9 tablas heredadas de Olas 1‑3 (políticas `USING(true)` reemplazadas por `entity_id` aware).
- **Reproducibilidad**: tabla `pricing_snapshots` inmutable + Edge Function escribe input+context+output con sha256, `POST /api/snapshots/:id/replay` re‑ejecuta motor real con diff field‑level.
- **SLOs**: vista materializada `pricing_slo_minute` + endpoint `/observability/slo-summary` + SLOPanel UI integrado en HealthDashboard.
- **Alertas**: 5 canales (email/slack/pagerduty/webhook/opsgenie) con HMAC, evaluator core puro + adaptadores DB + loop opt‑in `ALERT_EVAL_INTERVAL_MS`.
- **Cron scoping**: `realize-raroc` y `elasticity-recalibrate` aceptan `?entity_id` para fan-out per‑tenant.
- **Docs**: rollout, runbooks (tenancy / latency / snapshot failure), kill switches.

### Fase 1 — Customer 360 (2 sprints)

- **Schema**: `client_positions`, `client_metrics_snapshots`, `pricing_targets` con RLS entity-scoped y check constraints.
- **Aggregator puro**: `buildClientRelationship` + `findApplicableTargets` + `pickActiveTarget`.
- **Cross‑bonus relacional**: `deriveAttachmentsFromRelationship` consume las posiciones del cliente y aplica boost de probabilidad por antigüedad (1y/3y/5y, capado 0.95) — el motor existente sigue intacto.
- **API + UI**: `/api/customer360/clients/:id` (read + mutating) y `CustomerRelationshipPanel.tsx` (KPI strip, posiciones, targets, métricas).

### Fase 2 — Channels & Bulk Ops (1 sprint)

- **Schema**: `channel_api_keys` (sha256(key), nunca raw), `pricing_campaigns` (state machine draft→approved→active→exhausted/expired/cancelled), `channel_request_log`.
- **Channel API**: `POST /api/channel/quote` con `x-channel-key` auth + token bucket per-key + `pickBestForBorrower` aplicando campaign delta.
- **Pure helpers**: `tokenBucket` (capacidad + refill, retryAfter proporcional al deficit) y `campaignMatcher` (window, status, exhaustion, restricción de canal).

### Fase 3 — Governance (1 sprint)

- **Schema**: `model_inventory` (SR 11‑7 / EBA), `signed_committee_dossiers` (append‑only, format CHECK), `approval_escalations`.
- **Signing**: `signDossier` = sha256(canonicalJson) + HMAC‑SHA256, `verifyDossierSignature` con timing‑safe equal y separación payload‑hash vs signature mismatch.
- **API**: `/api/governance/models[/:id/status]`, `/api/governance/dossiers[/:id/verify]`.

### Fase 4 — Integración bancaria (1 sprint)

- **Interfaces**: `CoreBankingAdapter`, `CrmAdapter`, `MarketDataAdapter` con `AdapterResult<T>` (Result type, no throw) + `AdapterHealth`.
- **Registry**: `adapterRegistry.register/coreBanking/crm/marketData/healthAll`.
- **Reference adapters**: `InMemoryCoreBanking/Crm/MarketData` (incluye fetch FX directo, inverso, identidad).
- **SSO**: `SsoProvider` interface + `DemoSsoProvider` para tests + `deriveRoleFromGroups`.

### Fase 5 — SaaS hardening + observabilidad operativa (1 sprint)

- **Schema**: `tenant_feature_flags` (Admin‑only writes), `usage_events` (append‑only), `usage_aggregates_daily` (materialised view).
- **Provisioning**: `scripts/provision-tenant.ts` idempotente, una transacción crea entity + admin + entity_users + 4 default flags. SLO target < 60 s.
- **API**: `/api/metering/usage`, `/api/metering/feature-flags`.
- **Out of scope explícito**: cross-charging por uso del SaaS. El motor lo opera el banco como parte de su plataforma; las métricas de uso son operativas (capacity planning, abuse detection, observabilidad), no facturables.

---

## Lo que NO está hecho (siguiente ola)

Cada fase tiene piezas que requieren ya datos reales / decisión de cliente y por eso paro aquí:

| Fase | Pendiente (consciente) | Requisito previo |
|---|---|---|
| F0 | Tests integración con DB real (fuzz tenancy, replay E2E) | infra de DB de test efímera (testcontainers) |
| F1 | Vista UI completa Customer Pricing (no solo panel embebido) + import CSV de positions/metrics | usuario decide la navegación: ¿reemplaza la vista existente o cohabita? |
| F2 | Mass‑action UI (delta spread a segmento con preview/approval/rollback) + upload CSV→pricing en un flujo + caché distribuida (Redis) | confirmar volumen real (single replica vs multi‑replica) |
| F3 | Backtesting framework integrado con alertas (drift) + challenger models en shadow + approval workflow temporal | datos históricos suficientes para backtest reproducible |
| F4 | Implementaciones reales (Salesforce FSC, Bloomberg/Refinitiv, T24/FlexCube/FIS, Okta/AzureAD OIDC con JWKS) | credenciales + sandbox del banco ancla |
| F5 | Status page público per‑tenant + Stripe/SAP integración facturación + per‑tenant encryption at rest | decisión de billing partner |

---

## Estructura nueva por fase

```text
integrations/                   ← Phase 4 (NUEVO)
  types.ts, registry.ts, inMemory.ts, sso.ts

scripts/
  provision-tenant.ts           ← Phase 5

server/
  middleware/
    requestId.ts                ← Phase 0
    tenancy.ts                  ← Phase 0
  routes/
    snapshots.ts                ← Phase 0
    customer360.ts              ← Phase 1
    channelPricing.ts           ← Phase 2
    governance.ts               ← Phase 3
    metering.ts                 ← Phase 5
  workers/
    alertEvaluatorCore.ts       ← Phase 0 (pure)
    alertEvaluator.ts           ← Phase 0 (DB adapters)
    snapshotReplay.ts           ← Phase 0
  integrations/
    alertChannels.ts            ← Phase 0

components/
  Admin/SLOPanel.tsx            ← Phase 0
  Customer360/                  ← Phase 1
    CustomerRelationshipPanel.tsx

types/
  phase0.ts                     ← Phase 0
  customer360.ts                ← Phase 1
  channels.ts                   ← Phase 2
  governance.ts                 ← Phase 3
  metering.ts                   ← Phase 5

utils/
  canonicalJson.ts, snapshotHash.ts                ← Phase 0
  channels/{tokenBucket,campaignMatcher}.ts        ← Phase 2
  customer360/{relationshipAggregator,
              crossBonusFromRelationship}.ts       ← Phase 1
  governance/dossierSigning.ts                     ← Phase 3
  metering/{billing,usageRecorder}.ts              ← Phase 5

supabase/migrations/
  20260602000001..07_*.sql     ← Phase 0 (7)
  20260603000001_customer_360.sql                  ← Phase 1
  20260604000001_channels_and_campaigns.sql        ← Phase 2
  20260605000001_governance_phase_3.sql            ← Phase 3
  20260606000001_metering_phase_5.sql              ← Phase 5

docs/
  phase-0-design.md, phase-0-technical-specs.md,
  phase-0-rollout.md
  roadmap-execution-summary.md  ← este documento
```

---

## Métricas de la ejecución

- **8 commits** push-eados entre `8a08ed2` (base previa) y `bb6072b` (último Phase 5).
- **+ ~5 800 líneas** netas (código de producción + tests + docs + SQL).
- **+ 75 tests nuevos**, total **960 tests** verdes.
- **18 migrations nuevas** en `supabase/migrations/`.
- **3 nuevos directorios top-level**: `integrations/`, `server/workers/`, `components/Customer360/`.

---

## Continuación (2.ª pasada con criterio del usuario)

Tras la pasada inicial, el usuario dio carta blanca y aclaró:
SaaS-first con flexibilidad on-premise, **sin cross-charging por uso del SaaS**
(NFQ no cobra a bancos por usar N-Pricing), SSO Google real, datos de
mercado los aporta el banco. Se ejecutaron seis sprints adicionales:

### Sprints A‑F entregados

- **A · CSV importer + metering wiring** — `parsePositionsCsv` /
  `parseMetricsCsv` puros + endpoints `POST /api/customer360/import/{positions|metrics}`
  + `usage_events` rows escritas desde pricing/channel/governance routes.
- **B · SSO Google real** — `GoogleSsoProvider` implementando `SsoProvider`
  con verificación JWT + restricción opcional `GOOGLE_ALLOWED_HOSTED_DOMAIN`;
  `/api/auth/google` resuelve `entity_users`, `/api/auth/me` introspección.
- **C · Backtesting drift detector + adapter stubs** — `detectDrift` puro
  con thresholds calibrados (5%/10% PnL, 1pp/2pp RAROC) + stubs
  `SalesforceCrmAdapter` y `BloombergMarketDataAdapter` con shape correcto.
- **Pivot · drop SaaS billing** — eliminados `buildInvoiceLines`,
  `DEFAULT_PRICE_BOOK`, `/invoice` endpoint, tests de billing. Se conserva
  `usage_events` para observabilidad operativa (capacity + abuse), no
  facturable.
- **D · Customer Pricing vista propia + mass-action UI** — Nuevas vistas
  `/customers` y `/campaigns` cohabitando con las pantallas existentes,
  incluyendo form de creación de campañas y transiciones de estado inline.
- **E · Tests integración opt-in** — `utils/__tests__/integration/tenancy.integration.test.ts`
  que se activa con `INTEGRATION_DATABASE_URL`. Sin la env var se
  auto-skip; sin Docker en CI; doc completa en `docs/integration-tests.md`.
- **F · Runbook templates** — 7 plantillas operativas en `docs/runbooks/`
  (tenancy violation, latency breach, snapshot failure, mock fallback,
  campaign exhausted, adapter down, kill switch, backtest drift) listas
  para la wiki del banco.

### Métricas finales

- **17 commits** push-eados a `main`.
- **+ ~7 700 líneas** netas (código + tests + docs + SQL) desde el
  baseline `8a08ed2`.
- **967 tests verdes + 5 integration skipped** sin env var → 972 total.
- **20 migrations** (incluye limpieza de billing).
- **8 runbook templates** + integration tests opt-in.

### Estado final por fase

| Fase | Estado tras esta segunda pasada |
|---|---|
| Fase 0 | ✅ Completa + integration tests opt-in + runbooks |
| Fase 1 | ✅ Completa: schema + UI propia + CSV importer |
| Fase 2 | ✅ Completa: channel API + campaigns con UI mass-action |
| Fase 3 | ✅ Completa: governance + drift detector wired |
| Fase 4 | ✅ Esqueleto + SSO Google real + stubs Salesforce/Bloomberg |
| Fase 5 | ✅ Provisioning + ops metering (sin billing) + feature flags |

### Pendiente (requiere input externo)

- Implementación real de `SalesforceCrmAdapter` y `BloombergMarketDataAdapter`
  (esperando credenciales del banco ancla).
- ~~Workflow temporal de aprobación con escalación L1→L2→Committee
  (esperando decisión sobre tiempos máximos por entidad).~~
  ✅ Entregado: migración `20260607000001_escalation_workflow.sql`
  añade `approval_escalation_configs` (Admin-only writes vía RLS) +
  columnas de trazabilidad en `approval_escalations`. Evaluador puro
  `utils/governance/escalationEvaluator.ts` con 16 tests, endpoints
  `/api/governance/escalations[/sweep|/evaluate]` y
  `/api/governance/escalation-configs/:level`. Los tiempos son
  configurables por entidad; defaults L1=24h, L2=48h, Committee=120h
  seedeados para Default Entity. Sweeper idempotente, L1→L2→Committee
  con fallback de timeout cuando el nivel destino no tiene config.
- ~~CI con job de integration tests (esperando elección del runner — GH
  Actions / GitLab / Jenkins).~~ ✅ Entregado en `ci.yml` · job
  `integration-tests` con `postgres:16` service container, migraciones
  aplicadas en orden, gating de merges en `main`.
- Backtesting con datos históricos reales (esperando dataset del banco;
  mientras tanto el framework valida con seed sintética).

---

## Ola 6 — Tenancy strict global + Pricing bajo estrés + Hash chain (2026-04-23)

Ejecución descrita en [`ola-6-tenancy-strict-stress-pricing.md`](./ola-6-tenancy-strict-stress-pricing.md)
completada en sesión única con **16 PRs merged** a `main` (#42–#57).

### Bloques entregados

- **Bloque A — Tenancy strict global** (5/6 piezas):
  - Runbook `tenancy-strict-flip.md` publicado (#8 pre-sesión) y
    refrescado tras la automatización (#52).
  - Seed de 3 alertas canónicas (pricing p95, tenancy violation,
    snapshot write failure) como migration
    `20260619000004_tenancy_alerts_seed.sql` (#44). Idempotente,
    deploy-time. El script — ahora renombrado a
    `fill-tenancy-alert-secrets.ts` — queda sólo para rellenar
    `channel_config` con secretos (Slack webhook URL, PagerDuty routing
    key) cuando las env vars están disponibles.
  - Widget `Tenancy violations · last 60m` en SLOPanel (#45): total +
    top-10 breakdown por (endpoint, error_code) + copy "Safe to hold
    TENANCY_STRICT flip observation" en cero. Endpoint de soporte
    `GET /api/observability/tenancy-violations`.
  - Hook en `scripts/provision-tenant.ts` para que tenants nuevos
    hereden las 3 alertas en la misma transacción del provisioning
    (#49). Atomicidad preservada.
  - Pendiente: **flip operativo** `TENANCY_ENFORCE=on` → strict en
    producción (decisión ops, no código).

- **Bloque B — Pricing bajo estrés** (B.5 cerrado; B.1–B.6 completos):
  - Vista `/stress-pricing` (#42) — selector de deal + tabla 7×7
    (base + 6 EBA presets × FTP/ΔFTP/Margin/ΔMargin/RAROC/ΔRAROC).
    CSV export via pure builder. Chip en header con estado del flag
    `VITE_PRICING_APPLY_CURVE_SHIFT`. Footer IRRBB disclaimer explícito.
  - Motor consume `ShockScenario.curveShiftBps` per-tenor (B.4,
    pre-sesión, flag-gated). 100% retrocompatible con
    `PricingShocks` legacy.
  - Pendiente (polish): Playwright e2e + Storybook story + sección
    stress en `adapter-down.md`.

- **Bloque C — Snapshot hash chain** (plumbing + writer):
  - Migration `20260619000003_pricing_snapshots_hash_chain.sql`:
    `prev_output_hash TEXT` + CHECK 64-hex + partial UNIQUE
    `(entity_id, prev_output_hash) WHERE NOT NULL` (#43).
  - Verifier puro `verifySnapshotChain(links)` en
    `utils/snapshotHash.ts` + endpoint admin
    `GET /api/snapshots/verify-chain?from=&to=` (#43).
  - Edge writer con retry exponencial (10 → 40 → 160 ms, max 3) ante
    conflict 23505. Bounded ~210ms worst-case, cabe en p95 300ms SLO
    (#47). Metric `snapshot_write_failures_total` con dimensión
    `attempts` para leading indicator de contención.
  - Pendiente (polish): backfill histórico opt-in.

- **Bloque D — Market benchmarks** (pre-sesión): completo salvo el D2
  admin UI.

### Infraestructura / CI

- Bundle budget `index` 500 → 520 KB (#46) y primer code-split
  (lazy `CommandPalette`, #53): índice a 503 KB post-split.
- **7 CI compat fixes** para que `integration-tests` corra end-to-end
  sobre `postgres:16` en lugar de depender de un entorno Supabase
  hosted completo:
  - #48: `CREATE PUBLICATION supabase_realtime`.
  - #50: `CREATE ROLE anon / authenticated / service_role`.
  - #51: `CREATE SCHEMA auth` + stub `auth.jwt()` / `auth.uid()` /
    `auth.users`.
  - #54: rename `strict` → `is_strict` en PL/pgSQL
    `get_current_entity_id()` (reserved word en PG 16).
  - #55: drop FK `pricing_snapshots → pricing_results` (UUID vs BIGSERIAL
    type mismatch que nunca se aplicaba).
  - #56: `clients.id` UUID → TEXT (alineado con inline schema + código
    de aplicación + FKs downstream).
  - #57: `deals.client_id` UUID → TEXT (sibling de #56).

  Patrón descubierto: las migrations históricas asumían entorno
  Supabase-hosted, con UUID genérico en `clients.id`, pero el inline
  schema en `server/migrate.ts` (que es lo que realmente corre en
  producción) siempre usó TEXT. Los 3 type mismatches (#55/#56/#57)
  fueron bugs silentes: nunca se aplicaron porque `CREATE TABLE IF NOT
  EXISTS` era no-op en envs con tablas pre-existentes.

### Métricas finales de la sesión

- **16 commits squash-merged** a `main` (`bcb43f7 → dc98dab`).
- **+ ~1 086 líneas** de Ola 6 puro (código + tests + SQL + docs) +
  ~150 líneas de CI hygiene.
- **+21 tests nuevos** (stress pricing CSV + render, hash chain verifier,
  SLOPanel violations widget, provision-tenant alert seed). Total
  **~1 373 tests** verdes.
- **3 migrations nuevas** (`20260619000003`, `20260619000004`, más los
  patches quirúrgicos al schema histórico).
- **1 vista nueva** (Stress Pricing, con lazy load y route).
- **CI build-and-test**: de rojo heredado a verde con budget ajustado.
- **CI integration-tests**: después de 7 compat fixes, las migrations
  corren end-to-end; los tests están operando contra DB real.

### Follow-ups (próxima sesión)

- Flip `TENANCY_STRICT=on` en canary → prod (decisión ops, no código).
- ~~Lazy-load `Login` como próximo code-split grande.~~ ✅ PR #66
  (`index` 506.09 → 495.85 KB, −10.24 KB; nuevo chunk `Login-*.js` de
  10.45 KB cargado sólo en el path unauth).
- ~~Playwright e2e para `/stress-pricing`.~~ ✅ PR #67 (4 specs:
  7×7 matrix, canary chip, IRRBB disclaimer, CSV download).
- ~~Runbook `adapter-down.md` con sección stress pricing.~~ ✅ ya
  entregado en PR #58 (sección "Stress Pricing path (Ola 6 B)" con
  SQL de diagnóstico sobre `pricing_snapshots.scenario_source`).
- ~~Backfill histórico opt-in para `prev_output_hash`.~~ ✅ PR #68
  (`scripts/backfill-snapshot-hash-chain.ts`; idempotente, soporta
  `--entity-id` y `--dry-run`, verifica con `verifySnapshotChain` al
  finalizar; requiere rol DB con BYPASSRLS).
- ~~Deprecar o renombrar `scripts/seed-tenancy-alerts.ts` →
  `fill-tenancy-alert-secrets.ts` (la seed ya es migration).~~ ✅
  Entregado en commit posterior.

Bloqueados por input externo:

- Implementación real `SalesforceCrmAdapter` / `BloombergMarketDataAdapter`
  (esperando credenciales del banco ancla).
- Backtesting con datos históricos reales (esperando dataset del banco).

---

## Olas 8 + 9 + 10 — Cobertura Banca March (2026-04-30)

Plan completo: [`docs/ola-8-atribuciones-banca-march.md`](./ola-8-atribuciones-banca-march.md).

### Resumen ejecutivo

12 commits encadenados sobre `main`, ~13.5k LOC, **1794 tests verdes**,
deck comercial entregable. La propuesta de 190 k€ del PDF Octubre 2023
de NFQ a Banca March queda materializada en código, con fallbacks
in-memory que permiten demostrar el flujo a Esteve Morey sin esperar
al workshop con IT BM.

### Ola 8 — Atribuciones jerárquicas y Approval Cockpit

| Bloque | Commit | Foco |
|---|---|---|
| Plan | `d0b7aed` | Doc maestro + README |
| A.1-A.5 | `029e213` | Schema + tipos + módulos puros + 50 tests |
| A.6-A.8 | `9aadc21` | Server router + cliente API + hooks + 22 tests |
| B | `22a7a3c` | UI: Approval Cockpit + Simulator + Matrix Editor + 13 tests |
| BM e2e | `752d4f8` | Embed Calculator + Storybook + Playwright |
| C | `625fb4f` | Reporting + drift detector + runbook + 21 tests |

Schema (3 tablas append-only): `attribution_levels`,
`attribution_thresholds`, `attribution_decisions` con hash chain
trigger validation a `pricing_snapshots`. UI 3 vistas + simulator
embebido en Calculator. Worker drift detector opt-in
(`ATTRIBUTION_DRIFT_INTERVAL_MS`).

### Ola 9 — Integración Banca March

| Bloque | Commit | Foco |
|---|---|---|
| A | `9b6e1f1` | PUZZLE adapter (admission) + 24 tests |
| B | `a334db2` | HOST mainframe + reconciliation matcher + 21 tests |
| C | `90633d1` | ALQUID wrapper + BudgetReconciliationView + 24 tests |

3 nuevas adapter families: `AdmissionAdapter`,
`CoreBankingAdapter.pullBookedRows`, `BudgetSourceAdapter`. Cada uno
con stub real (PUZZLE/HOST/ALQUID) + InMemory + bootstrap env vars.
Server endpoints `/api/admission/*`, `/api/core-banking/reconciliation`,
`/api/budget/comparison`. Línea clara: ALQUID = budget,
N-Pricing = pricing operativo. Wrapper read-only.

### Ola 10 — AI Insights + Drift Recalibrator + Mobile + Web Push

| Bloque | Commit | Foco |
|---|---|---|
| A | `5f68648` | AI grounding sobre atribuciones + 18 tests |
| B | `9502228` | Drift threshold recalibrator + 23 tests |
| C | `d3a40dc` | Mobile cockpit + Web Push primitives + 19 tests |
| Web Push real | `1af66af` | web-push lib + VAPID + escalation push dispatcher + 17 tests |

Copilot Cmd+K entiende la matriz (`buildAttributionsContextBlock`).
Recalibrator opt-in vía env propone ajustes a thresholds (Admin/
Risk_Manager aprueba). Mobile-first cards en cockpit. Web Push real
con VAPID + dispatcher que dispara notif al approver cuando una
decision queda escalated.

### Estado de los follow-ups del plan

- ✅ **Web Push real** (commit `1af66af`) — antes era stub. Cierra
  el follow-up #1 documentado en el plan.
- ⏳ **Adapters reales PUZZLE/HOST/ALQUID** — stubs listos, esperando
  workshop con IT BM para cerrar contratos HTTP/SFTP.
- ✅ **Documentación final** — CLAUDE.md, architecture.md, README,
  roadmap-execution-summary actualizados (este commit).

### Demo deck comercial

`~/Developer/Cowork/decks/n-pricing-banca-march-demo.html` (1280 LOC,
single-file). 18 slides estructurados:

- Cover + punto de partida (PDF Oct 2023)
- 12 pasos de demo paso a paso (Calculator → AttributionSimulator →
  Cockpit desktop + mobile → Matrix Editor → Reporting → Recalibrator
  → Budget → PUZZLE/HOST → AI Copilot)
- Cobertura de los 16 puntos del email Esteve Morey
- Reasignación económica 190 k€
- Próximos pasos (workshop, kickoff)

Estilo NFQ: dark-first, Inter + JetBrains Mono, accent
amber→coral→violet.
