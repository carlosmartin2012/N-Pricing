# N-Pricing — Architecture overview

> Lectura recomendada como primer documento técnico tras el README.
> Última actualización: 2026-04-23 — Ola 6 completa (A + B + C merged).
>
> **Cambios clave desde el último refresh (2026-04-15)**:
> - +17 vistas (Stress Pricing view añadida en Ola 6 B.5).
> - 40 migrations (+3 vs previo: scenario cols, hash chain, tenancy alerts seed).
> - Hash chain tamper-evidence activo: `prev_output_hash` + partial UNIQUE + verifier puro + endpoint admin + Edge writer con retry.
> - Stress Pricing: 6 escenarios EBA GL 2018/02 cableados al motor (feature flag `VITE_PRICING_APPLY_CURVE_SHIFT`), con vista `/stress-pricing` y CSV export.
> - SLOPanel: widget `Tenancy violations · last 60m` para el flip canary.
> - Provisioning seedea 3 alertas canónicas automáticamente (`tenancy-strict-flip` sin prereq manuales).
> - CI: build-and-test verde, integration-tests tras 7 compat fixes (supabase_realtime, roles, auth schema stubs, reserved word, type mismatches).
> - Bundle: budget 520 KB + primer lazy-load (CommandPalette).
>
> Ver [`docs/ola-6-tenancy-strict-stress-pricing.md`](./ola-6-tenancy-strict-stress-pricing.md) para detalle por bloque.

---

## TL;DR

N-Pricing es una **plataforma de pricing bancario multi-tenant** con tres
ámbitos coexistentes:

1. **FTP / ALM interno** (motor con 19 componentes, RAROC, shocks, ESG)
2. **Pricing comercial al cliente** (Customer 360, cross-bonus relacional,
   targets top-down, campañas)
3. **Channel pricing en tiempo real** (API key + rate limit + campaign match)

Cada cálculo se materializa como un **snapshot inmutable** para
reproducibilidad regulatoria. La tenancy se enforza en dos capas: middleware
explícito (server) + RLS Postgres (DB). Toda la observabilidad operativa
está modelada como SLOs con 5 canales de alertas.

---

## Mapa de capas

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser SPA (React 19 + Vite + PWA)                                │
│  ├─ Contexts: Auth, Data, UI, Governance, MarketData, Entity,       │
│  │              Walkthrough                                          │
│  ├─ React Query (cache + invalidación)                              │
│  ├─ api/* (cliente tipado + mappers)                                │
│  └─ 17 vistas, code-split con React.lazy (CommandPalette lazy)      │
└────────────────────┬────────────────────────────────────────────────┘
                     │ HTTPS · JWT bearer · x-entity-id · x-request-id
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Express server (server/)                                           │
│  ├─ requestIdMiddleware       (Phase 0 — UUID por request)          │
│  ├─ tenancyMiddleware         (Phase 0 — valida x-entity-id)        │
│  ├─ authMiddleware            (JWT HMAC propio)                     │
│  ├─ Routers (13):                                                   │
│  │    deals · audit · config · marketData · entities                │
│  │    reportSchedules · observability · pricing · gemini            │
│  │    snapshots · customer360 · campaigns · governance · metering   │
│  ├─ Adapters integrations/* (Phase 4)                               │
│  ├─ workers/                                                        │
│  │    alertEvaluatorCore (puro) + alertEvaluator (DB) + loop opt-in │
│  │    snapshotReplay (re-ejecuta motor con snapshot)                │
│  └─ db.ts: pg.Pool + withTransaction + withTenancyTransaction       │
└────────┬─────────────────────────────────────────────────────┬──────┘
         │                                                     │
         │ pg                                                  │ HTTPS · API key
         ▼                                                     ▼
┌────────────────────────────┐         ┌───────────────────────────────┐
│  PostgreSQL (Supabase)     │         │  Channel API (server/routes/  │
│  ├─ 40 migraciones         │◀───────▶│   channelPricing.ts)          │
│  ├─ RLS estricto           │         │  · x-channel-key auth         │
│  ├─ Helpers tenancy:       │         │  · token bucket per key       │
│  │    get_current_entity_id│         │  · campaign delta apply       │
│  │    get_accessible_      │         │  · channel_request_log audit  │
│  │      entity_ids         │         └───────────────────────────────┘
│  ├─ Append-only:           │
│  │    tenancy_violations   │
│  │    pricing_snapshots    │         ┌───────────────────────────────┐
│  │    audit_log, *_versions│         │  Supabase Edge Functions      │
│  │    signed_committee_    │◀───────▶│   (Deno)                      │
│  │      dossiers           │         │  · pricing — escribe snapshots│
│  └─ Materialized views:    │         │  · realize-raroc (cron mensual)│
│       pricing_slo_minute   │         │  · elasticity-recalibrate     │
│       usage_aggregates_daily│        │      (cron nocturno)          │
└────────────────────────────┘         └───────────────────────────────┘
                     ▲
                     │ adapters
                     │
┌────────────────────┴────────────────────────────────────────────────┐
│  integrations/ (Phase 4)                                            │
│  ├─ types.ts          AdapterResult<T> Result type                  │
│  ├─ registry.ts       singleton routed by kind                      │
│  ├─ inMemory.ts       Reference adapters (dev/tests)                │
│  ├─ sso.ts            SsoProvider interface + DemoSsoProvider       │
│  ├─ sso/google.ts     GoogleSsoProvider real (OAuth2Client)         │
│  ├─ crm/salesforce.ts STUB — pending bank credentials               │
│  └─ marketData/bloomberg.ts STUB — pending BLPAPI                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Multi-tenancy (Phase 0)

### Modelo

- Cada tabla entity-scoped tiene `entity_id UUID` con FK a `entities(id)`.
- 3 helpers Postgres:
  - `get_current_entity_id()` — lee `current_setting('app.current_entity_id')`,
    raise si `app.tenancy_strict='on'`, fallback a Default Entity en `off`.
  - `get_current_user_role()` — análogo para `app.current_user_role`.
  - `get_current_user_email()` — coalesce de `auth.jwt()` (Supabase) y
    `app.current_user_email` (server pg). Permite que las policies sirvan
    a ambos runtimes.
- 3 políticas RLS por tabla:
  - `read`: `entity_id = ANY(get_accessible_entity_ids())`
  - `insert`: `entity_id = get_current_entity_id()`
  - `update`/`delete`: igual + check de rol cuando aplica

### Defensa en dos capas

**Capa 1 — middleware explícito** (`server/middleware/tenancy.ts`):
- Extrae `x-entity-id`, valida UUID.
- Verifica que `(user_email, entity_id)` existe en `entity_users`.
- Si falla, persiste a `tenancy_violations` (append-only) y devuelve 403.
- Pobla `req.tenancy = { entityId, userEmail, role, requestId }`.

**Capa 2 — `withTenancyTransaction(tenancy, fn)`**:
- Setea via `set_config($1, $2, true)` los `app.current_*` settings dentro de
  una transacción. `SET LOCAL` evita leaks entre conexiones del pool.
- Las queries dentro del callback ejecutan bajo RLS estricto.
- Opt-in: handlers legacy siguen funcionando con la conexión bypass-RLS.

### Rollout (4 fases)

Controlado por dos env vars (ver `docs/phase-0-rollout.md`):

| Fase | `TENANCY_ENFORCE` | `TENANCY_STRICT` | Comportamiento |
|---|---|---|---|
| 0 — Deploy | off | off | Migrations aplicadas, comportamiento legacy |
| 1 — Warn | on | off | Middleware activo, fallback a Default Entity en DB |
| 2 — Canary | on | on (1 tenant) | Strict para canary; legacy para el resto |
| 3 — Global | on | on | Multi-tenant duro |

Kill switch: flip las dos env vars a `off`, sin migración inversa.

---

## Reproducibilidad de pricing (Phase 0)

### Tabla `pricing_snapshots`

| Columna | Propósito |
|---|---|
| `id` | UUID surrogate |
| `entity_id` | Tenancy |
| `deal_id`, `pricing_result_id` | Lineage opcional |
| `request_id`, `engine_version`, `as_of_date` | Correlación + versionado |
| `used_mock_for` | Array con secciones del context que cayeron a mock |
| `input` JSONB | `{ deal, approvalMatrix, shocks }` |
| `context` JSONB | curvas + reglas + rate cards + ESG + behavioural + sdrConfig + lrConfig + clients + products + BUs |
| `output` JSONB | FTPResult completo |
| `input_hash`, `output_hash` | sha256 hex (CHECK constraint formato) |

Inmutable por RLS (sin UPDATE/DELETE) + trigger `enforce_snapshot_hashes`.

**Hash chain (Ola 6 C).** Tres columnas adicionales (`scenario_id`,
`scenario_source`, `prev_output_hash`) documentadas en migrations
`20260619000002` / `20260619000003`. Cada snapshot extiende la cadena
vinculando su `output_hash` con el anterior del mismo tenant via
`prev_output_hash`. Partial UNIQUE index sobre `(entity_id, prev_output_hash)
WHERE prev_output_hash IS NOT NULL` previene forks silentes por writers
concurrentes. Edge writer (`supabase/functions/pricing/index.ts`)
implementa retry exponencial (10 → 40 → 160 ms, max 3) ante conflict
23505 — el loser extiende sin dividir la cadena.

**Verificación.** `verifySnapshotChain(links)` puro en
`utils/snapshotHash.ts` + endpoint admin `GET /api/snapshots/verify-chain`
barren el rango y detectan tampering retroactivo (devuelve `brokenAt`
al primer mismatch).

### Replay

`POST /api/snapshots/:id/replay`:
1. Carga el snapshot.
2. Llama a `calculatePricing(input.deal, input.approvalMatrix, context, input.shocks)` con el motor **actual**.
3. Recomputa `sha256(canonicalJson(currentOutput))`.
4. Si hash difiere → produce diff field-by-field con `deltaAbs` y `deltaBps`
   para los 8 campos numéricos de `FTPResult` + sweep top-level para
   detectar nuevos campos.

Esto es el contrato regulatorio con el banco: cualquier deal aprobado en
T0 puede demostrarse byte-perfect en T+N.

---

## SLO + alertas (Phase 0)

### 8 SLIs catalogados (`types/phase0.ts` `PRICING_SLOS`)

| SLI | Target inicial | Window | Severity |
|---|---|---|---|
| `pricing_single_latency_ms` p95 | < 300 ms | 1h | warning |
| `pricing_single_latency_ms` p99 | < 800 ms | 1h | warning |
| `pricing_batch_latency_ms_per_deal` | < 50 ms | 1h | warning |
| `pricing_error_rate` | < 0.5% | 5 min | page |
| `tenancy_violations_total` | = 0 | 1 min | critical |
| `mock_fallback_rate` | < 5% | 1h | warning |
| `snapshot_write_failures_total` | = 0 | 5 min | page |
| `auth_failures_total` | (sin SLO formal) | — | — |

### Pipeline

1. Edge Functions y server emiten métricas a la tabla `metrics` con
   dimensions `{ request_id, endpoint, status_code }`.
2. Vista materializada `pricing_slo_minute` agrega p50/p95/p99 + n_errors
   por (entity, minuto, endpoint). Refresh por pg_cron (opcional) o por el
   propio worker.
3. Alert evaluator (`workers/alertEvaluator.ts`):
   - Pure core (`alertEvaluatorCore.ts`): `shouldTrigger` + `evaluateAlerts`
     con deps inyectables (testable sin DB).
   - Adapters DB: `loadRulesFromDb`, `lookupMetricInDb`,
     `recordInvocationInDb`, `touchTriggeredInDb`.
   - Loop opt-in via `ALERT_EVAL_INTERVAL_MS=30000` (default off).
4. Dispatcher `integrations/alertChannels.ts` con 5 canales:
   email, Slack, PagerDuty (dedup_key determinista), webhook (HMAC), Opsgenie.
5. Cooldown por regla → no spam aunque el SLO siga roto.

### Surface

`GET /api/observability/slo-summary?entity_id=…` devuelve un payload
estructurado para la UI (`SLOPanel.tsx` embebido en `HealthDashboard`).

**Tenancy violations canary (Ola 6 A).** `GET /api/observability/tenancy-violations?window_minutes=60`
devuelve total + top-10 breakdown por `(endpoint, error_code)` para el
tenant solicitante. El widget dedicado *Tenancy violations · last 60m*
en `SLOPanel` renderiza cero → mensaje "Safe to hold TENANCY_STRICT flip
observation" y >0 → tabla con counts. Diseñado para la ventana de 48h de
observación descrita en [`docs/runbooks/tenancy-strict-flip.md`](./runbooks/tenancy-strict-flip.md).

---

## Customer 360 (Phase 1)

### Tablas

- `client_positions` — posiciones activas/maduradas/canceladas por cliente.
- `client_metrics_snapshots` — append-only, una fila por (entity, client, period).
- `pricing_targets` — top-down por (entity, segment, product, currency, period)
  con `pre_approved_rate_bps` (sucursal puede bookar sin escalación) y
  `hard_floor_rate_bps` (debajo requiere comité).

### Aggregator puro

`utils/customer360/relationshipAggregator.ts` expone:

- `findApplicableTargets` / `pickActiveTarget` — match por
  entity×segment×product×currency×date.
- `buildClientRelationship({ client, positions, metricsHistory, targets, asOfDate })`
  → `ClientRelationship` aggregate con derived (totales, isMultiProduct,
  relationshipAgeYears).
- Mappers DB → domain en el mismo módulo (single source of truth).

### Cross-bonus relacional

`deriveAttachmentsFromRelationship(rel, opts)` recorre las posiciones
activas del cliente, las mapea a `CrossBonusProductType` (sinónimos
ES/EN), y devuelve `CrossBonusAttachment[]` con `overrideProbability`
boostada según antigüedad (1y/3y/5y, capada a 0.95).

Antes el motor cross-bonus dependía de checkboxes per-deal manuales;
ahora consume la cartera real.

### Importador CSV

`POST /api/customer360/import/{positions|metrics}` acepta `text/csv` o
`{ csv }` JSON. Single transaction + chunked inserts + per-row error
report. Parser puro (`csvImport.ts`) sin dependencias externas — sopote
locale español (decimal con coma).

---

## Channels & Bulk (Phase 2)

### Channel API

`POST /api/channel/quote` con `x-channel-key`:

1. `channelAuthMiddleware` busca por `sha256(key)` en `channel_api_keys`.
2. `rateLimitMiddleware` consume del token bucket per-key (capacity = burst,
   refill = rpm/60).
3. Carga campañas activas, las pasa por `findApplicableCampaigns`,
   `pickBestForBorrower` (más negativo = más descuento).
4. Llama al motor + aplica delta de campaña a `finalClientRate`.
5. Persiste a `channel_request_log` (best-effort, no bloquea).

Headers de respuesta: `x-rate-limit-remaining`, `Retry-After` en 429,
`x-request-id`.

### Pricing campaigns

State machine: `draft → approved → active → exhausted | expired | cancelled`.
CHECK constraints garantizan `active_to >= active_from` y volúmenes positivos.

UI (`/campaigns`): tabla agrupada por status + form de creación + acciones
inline para transitar.

---

## Governance (Phase 3)

### Model inventory

Tabla `model_inventory` (SR 11-7 / EBA): `kind` (engine, ruleset, elasticity,
shock_pack, behavioural, rate_card, other), `version`, `status`
(candidate, active, retired, rejected), owner, validation_doc_url,
effective dates.

### Signed dossiers

`signDossier(payload)` = `sha256(canonicalJson(payload))` + HMAC-SHA256
con `DOSSIER_SIGNING_SECRET`. `verifyDossierSignature` separa
payloadHashMatches de signatureMatches → audit precisa: tampering del
payload vs forge de signature.

### Drift detector

`detectDrift(BacktestResult, thresholds?)` evalúa PnL drift % y RAROC
drift pp independientemente; severity overall = peor de las dos.
Defaults: 5%/10% PnL warn/breach; 1pp/2pp RAROC warn/breach.
Symmetric: positivo y negativo igual.

---

## Adapter layer (Phase 4)

### Result type

`AdapterResult<T> = { ok: true, value: T } | { ok: false, error: AdapterError }`.
Adapters jamás throw — fallas de transporte son datos. Categorías de error:
`unreachable`, `auth`, `rate_limited`, `not_found`, `parse_error`, `unknown`.

### Tres familias

| Kind | Interface | Reference impl | Stubs production-ready |
|---|---|---|---|
| `core_banking` | `CoreBankingAdapter` | `InMemoryCoreBanking` | (T24/FIS/FlexCube — pending bank ancla) |
| `crm` | `CrmAdapter` | `InMemoryCrm` | `SalesforceCrmAdapter` |
| `market_data` | `MarketDataAdapter` | `InMemoryMarketData` | `BloombergMarketDataAdapter` |

`adapterRegistry` singleton con `coreBanking()`, `crm()`, `marketData()`,
`healthAll()`. Stubs validan config en constructor (fail fast) y devuelven
`fail('unreachable', '...stub pending real implementation')` para que el
sistema arranque y la observabilidad muestre el adapter down.

### SSO

`SsoProvider` interface → dos implementaciones:
- `DemoSsoProvider` — token shape `'demo:<sub>:<email>:<name>:<groups>'` para tests.
- `GoogleSsoProvider` — `OAuth2Client.verifyIdToken` real, opcionalmente
  restringido a un Workspace domain (`GOOGLE_ALLOWED_HOSTED_DOMAIN`).
  Surfaces `hd` claim como group sintético.

Server: `POST /api/auth/google` resuelve `entity_users` y devuelve
JWT + `primaryEntityId`. `GET /api/auth/me` introspección.

---

## Observabilidad operativa (Phase 5)

### Sin billing

El producto lo opera el banco como parte de su plataforma. Las métricas
de uso son operativas (capacity planning, abuse detection, SLO), **no
facturables**. La capa de billing del SaaS se eliminó explícitamente.

### Componentes que sobreviven

- `usage_events` (append-only) — escrito por pricing/channel/governance routes
  via `recorderFromPool`. Best-effort: nunca bloquea la respuesta de
  negocio.
- `usage_aggregates_daily` (vista materializada) — totales por
  (entity, day, kind) refrescables nightly.
- `tenant_feature_flags` con kill switches: `pricing_enabled`,
  `channel_api_enabled`, `ai_assistant_enabled`, `kill_switch`.
- `scripts/provision-tenant.ts` — idempotente, < 60 s SLO, en una
  transacción crea entity + admin user + entity_users + 4 default flags.
- `GET /api/metering/usage` y `/feature-flags`.

---

## Stress Pricing (Ola 6 B)

### Escenarios EBA GL 2018/02

Tipos en `types/pricingShocks.ts`: `ShockScenario` lleva `curveShiftBps`
per-tenor (8 buckets: 1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 20Y), `interestRate`
(legacy uniform), `liquiditySpread`, `source` (`preset_eba_2018_02`,
`market_adapter`, `user_custom`), y `id` del escenario.

Presets en `utils/pricing/shockPresets.ts` — 6 escenarios canónicos:
parallel ±200, short ±250, steepener, flattener. Steepener/flattener
computados con la fórmula Annex III (decay `exp(-t/4)`).

### Cableado al motor

`calculatePricing(deal, approvalMatrix, context, shocks)` acepta un
`ShockScenario` completo (además del `PricingShocks` legacy). Cuando el
flag `VITE_PRICING_APPLY_CURVE_SHIFT=true` Y `shocks.curveShiftBps` está
presente, el motor interpola per-tenor al `RM` del deal; si no, fallback
al shift uniforme. **100% retrocompatible**.

### Adapter

`MarketDataAdapter.fetchShockedCurve(scenarioId, asOfDate)` — aplica
`curveShiftBps` sobre la curva base in-memory (reference) o delega al
proveedor (Bloomberg stub firma el contrato).

### Vista

`/stress-pricing` — selector de deal + tabla 7×7 (base + 6 EBA presets ×
FTP/ΔFTP/Margin/ΔMargin/RAROC/ΔRAROC). Chip en header muestra estado del
flag. CSV export via pure builder. Footer disclaimer: "no sustituye
cálculo IRRBB regulatorio (ΔEVE, SOT, ΔNII runoff)".

---

## Testing

### Suite por capas

| Tipo | Tooling | Cuándo correr |
|---|---|---|
| Unit | Vitest 4 (~1.37k tests) | Cada commit |
| Integration RLS | Vitest + Postgres real | Opt-in, cuando se cambian helpers PG |
| E2E | Playwright (20 specs) | Pre-PR |
| Component | Storybook 8.6 | Diseño visual aislado |

### Integration tests opt-in

`utils/__tests__/integration/tenancy.integration.test.ts` se auto-skip
sin `INTEGRATION_DATABASE_URL`. Cobertura:
- Strict mode raise vs legacy fallback.
- `SET LOCAL` no leak entre conexiones del pool.
- Append-only de `tenancy_violations`.
- Fuzz 50 ops concurrentes alternando entity A/B → 0 cross-reads.

Setup: `supabase start` o Docker Postgres, exportar `INTEGRATION_DATABASE_URL`,
`npx vitest run utils/__tests__/integration`. Detalle:
[`docs/integration-tests.md`](./integration-tests.md).

---

## Operación

### Variables de entorno críticas

| Var | Default | Rol |
|---|---|---|
| `DATABASE_URL` | required | pg pool del server |
| `JWT_SECRET` | dev fallback | required en prod |
| `VITE_GOOGLE_CLIENT_ID` | — | habilita Google SSO |
| `GOOGLE_ALLOWED_HOSTED_DOMAIN` | unset | restringe SSO |
| `TENANCY_ENFORCE` | off | activa middleware |
| `TENANCY_STRICT` | off | hace strict el helper PG |
| `PRICING_ALLOW_MOCKS` | unset (false) | rechaza pricing si falta config |
| `ENGINE_VERSION` | `dev-local` | grabado en `pricing_snapshots` |
| `ALERT_EVAL_INTERVAL_MS` | unset | activa alert worker |
| `DOSSIER_SIGNING_SECRET` | dev fallback | required en prod |
| `VITE_PRICING_APPLY_CURVE_SHIFT` | unset (false) | `true` → motor interpola per-tenor con `ShockScenario.curveShiftBps` (Ola 6 B.4). Off = legacy uniform shift |
| `INTEGRATION_DATABASE_URL` | unset | activa tests integración |

### Runbooks

13 plantillas en [`docs/runbooks/`](./runbooks/) cubren los eventos más
probables: tenancy violation · tenancy-strict-flip · pricing latency ·
snapshot write failure · mock fallback · campaign volume exhausted ·
adapter down · feature flag kill switch · backtest drift · escalation
timeouts · CLV ops · seed demo · Replit demo.

Cada runbook trae las queries SQL de diagnóstico y los criterios de
mitigación.

### Provisioning

```bash
tsx scripts/provision-tenant.ts \
  --short-code BANK-ES \
  --name "Bank, S.A." \
  --legal-name "Bank, Sociedad Anónima" \
  --country ES --currency EUR \
  --admin-email admin@bank.es
```

Idempotente. Se puede correr 10 veces sin daño. Logs incluyen el
`elapsedMs` para validar el SLO < 60 s.

---

## Decisiones arquitectónicas notables

1. **Result type para adapters** (no try/catch en consumidores) — la
   capa de integración nunca propaga errores de transporte; los expone
   como datos. Tests de adapters son triviales.

2. **Pure core + DB adapter** en el alert evaluator — separar la lógica
   de evaluación del I/O permitió tests de ms en lugar de fallar al
   cargar el módulo (porque `db.ts` requiere `DATABASE_URL`).

3. **`set_config(key, value, true)` en lugar de `SET LOCAL <name> = '<val>'`**
   — soporta parámetros `$1/$2`, evita interpolación de UUIDs (riesgo de
   inyección).

4. **Snapshot escribe `context` completo** (no solo `curveId`) — sin esto
   un cambio en la curva referenciada rompe la reproducibilidad. Coste
   ~5-20 KB por snapshot, asumible.

5. **Tres `entity_id NULL = global`** en Olas 1-3 (`canonical_deal_templates`,
   `tolerance_bands`, `methodology_snapshots`) — preservado durante el
   hardening RLS de Phase 0 (la migración 7 reemplaza `USING(true)` por
   `entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids())`).

6. **No inventar Salesforce/Bloomberg** — stubs que devuelven `fail()`
   con mensaje claro, no `throw new Error('not implemented')`. El sistema
   arranca, la observabilidad muestra el adapter down, el equipo del
   banco ve qué falta.

7. **Eliminación del billing SaaS** — N-Pricing es un motor que el banco
   opera; cobrar por uso del propio motor era una hipótesis comercial
   débil. Mantenemos `usage_events` para observabilidad operativa, no
   para facturación.

---

## Referencias rápidas

- **Integral review 2026-04-18** (hallazgos verificados + propuesta Olas 6-8): [`docs/integral-review-2026-04-18.md`](./integral-review-2026-04-18.md)
- Roadmap fase a fase: [`docs/roadmap-execution-summary.md`](./roadmap-execution-summary.md)
- Diseño Phase 0 detallado: [`docs/phase-0-design.md`](./phase-0-design.md)
- SQL + tipos + ejemplos Phase 0: [`docs/phase-0-technical-specs.md`](./phase-0-technical-specs.md)
- Rollout de flags: [`docs/phase-0-rollout.md`](./phase-0-rollout.md)
- Tests integración: [`docs/integration-tests.md`](./integration-tests.md)
- Runbooks: [`docs/runbooks/`](./runbooks/)
- API spec: [`docs/api-spec.yaml`](./api-spec.yaml)
- Metodología FTP: [`docs/pricing-methodology.md`](./pricing-methodology.md)
- Setup Supabase: [`docs/supabase-setup.md`](./supabase-setup.md)
- Auditoría RLS: [`docs/rls-audit-2026-04.md`](./rls-audit-2026-04.md)
- Baseline seguridad: [`docs/security-baseline-2026-04.md`](./security-baseline-2026-04.md)
- Contexto IA / agentes: [`CLAUDE.md`](../CLAUDE.md)
