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

## Decisión recomendada para continuar

Las fases 2‑5 están en estado **"esqueleto productivo"**: el contrato y los pure helpers están en sitio, los endpoints existen, los tests defienden la lógica. Lo que falta en cada una son piezas que **requieren input externo** (banco ancla, proveedor de billing, datos históricos reales, decisiones de UX) — no más código creativo en este turno.

Las dos siguientes inversiones de mayor ratio valor/esfuerzo son:

1. **Tests E2E con DB real** — usar `testcontainers` para levantar Postgres efímero y validar el comportamiento RLS extremo a extremo. Convierte Fase 0 de "sólido" a "demostrablemente sólido".
2. **Bloque cliente ancla** — escoger un banco partner para Fase 4 y construir el primer adapter real (probablemente Salesforce FSC, que es el de menor riesgo y mayor impacto comercial).

Ambas requieren decisión externa, así que paro aquí con el árbol limpio y push hecho.
