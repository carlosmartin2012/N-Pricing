# Mapa de extraccion desde N-Pricing hacia la nueva plataforma

> Inventario repo-backed de que piezas de N-Pricing conviene extraer,
> encapsular, reescribir o descartar para construir la nueva Bank Revenue
> Intelligence Platform sin arrastrar deuda estructural.

---

## 1. Criterio de extraccion

Una pieza se extrae si cumple al menos 3 de 5 condiciones:

1. Es logica de dominio pura o casi pura.
2. Tiene tests suficientes.
3. No depende de UI, DB o estado global.
4. Su concepto sobrevive en la plataforma nueva.
5. Es mas barato aislarla que reescribirla.

Una pieza se reescribe si:

- mezcla demo/real,
- vive en rutas o componentes demasiado acoplados,
- duplica schema/contratos,
- fue creada como showcase,
- o tiene valor conceptual pero implementacion demasiado ligada al repo actual.

---

## 2. Resumen ejecutivo

| Decision                        | Piezas                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Extraer casi directo            | pricing kernel, canonical JSON/hash, snapshot verification, dossier signing, adapter result pattern, selected data-quality scripts             |
| Extraer con envoltorio          | RAROC, liquidity/capital engines, attributions routing, CLV/LTV, elasticity/backtesting, escalation evaluator, alert channels, push dispatcher |
| Reescribir manteniendo concepto | UI, navigation, contexts, API routes, migrations, AI chat, reports, customer/portfolio views                                                   |
| Descartar                       | pitch/brochure HTML, screenshots, legacy docs drift, demo-only surfaces, duplicated inline schema, broad sidebar model                         |

---

## 3. Piezas a extraer como paquetes

### 3.1 Pricing Kernel

**Origen:**

- `utils/pricingEngine.ts`
- `utils/pricing/`
- `utils/rarocEngine.ts`
- `utils/pricingConstants.ts`
- `constants/regulations.ts`
- `utils/ruleMatchingEngine.ts`

**Destino recomendado:**

```text
packages/pricing-kernel/
```

**Extraer:**

- FTP waterfall.
- Liquidity engine.
- Capital CRR3 logic.
- Credit lifecycle/risk.
- Shock presets and interpolation.
- RAROC realization.
- Regulatory constants.
- Golden regression fixtures.

**Ajustar:**

- Eliminar cualquier dependencia implicita de seed data.
- Convertir contexts en contratos explicitos: `MarketContext`,
  `FundingContext`, `CapitalContext`, `PolicyContext`.
- Forzar `asOfDate`, `engineVersion` y `contextVersion`.
- Separar `calculatePrice` de `explainPrice`.

**No extraer tal cual:**

- Estado global o helpers que asuman UI/demo.
- Tipos monoliticos si vienen de `types.ts` sin ownership claro.

### 3.2 Snapshot, hash chain y replay

**Origen:**

- `utils/canonicalJson.ts`
- `utils/snapshotHash.ts`
- `server/workers/snapshotReplay.ts`
- `server/routes/snapshots.ts`
- `supabase/functions/pricing/index.ts`
- migrations de `pricing_snapshots`

**Destino recomendado:**

```text
packages/audit-replay/
services/audit-service/
```

**Extraer:**

- Canonical JSON.
- Input/output hash.
- Chain verifier.
- Replay diff numerico.
- Writer con retry ante fork/conflict.

**Ajustar:**

- El writer debe ser unico por bounded context. Evitar que Edge Function,
  route y worker escriban snapshots con logicas distintas.
- Convertir el snapshot en contrato versionado generado desde `contracts`.

### 3.3 Governance, dossiers y firmas

**Origen:**

- `utils/governance/dossierSigning.ts`
- `utils/governance/escalationEvaluator.ts`
- `utils/governance/*`
- `server/routes/governance.ts`
- `components/Governance/*`

**Destino recomendado:**

```text
packages/policy-engine/
services/decisioning-service/
services/audit-service/
```

**Extraer:**

- Firma/verificacion de dossiers.
- Evaluador de escalaciones.
- Concepto de proposals/versiones.
- Tests de workflow.

**Reescribir:**

- UI de governance.
- Router monolitico.
- Data model mezclado con pantallas auxiliares.

### 3.4 Attribution / approval routing

**Origen:**

- `utils/attributions/`
- `server/routes/attributions.ts`
- `components/Attributions/ApprovalCockpit.tsx`
- `api/attributions.ts`
- `e2e/attributions.spec.ts`

**Destino recomendado:**

```text
packages/policy-engine/src/approval-routing/
services/decisioning-service/
apps/web/src/features/approval-inbox/
```

**Extraer:**

- Threshold matching.
- Approval chain builder.
- Attribution simulator logic.
- Drift recalibration concepts.
- Approval deep-link behavior.

**Ajustar:**

- Cambiar "attribution" por vocabulario mas amplio: `pricing decisioning`,
  `approval routing`, `exception governance`.
- El approval inbox debe ser parte del Deal Desk, no una isla.

### 3.5 Relationship pricing / CLV

**Origen:**

- `utils/customer360/`
- `utils/clv/`
- `components/Customer360/`
- `server/routes/customer360.ts`
- `api/customer360.ts`

**Destino recomendado:**

```text
packages/relationship-pricing/
services/portfolio-service/
apps/web/src/features/deal-desk/relationship/
```

**Extraer:**

- Relationship aggregator.
- CSV parsers como test fixtures/import bootstrap, no como data strategy.
- CLV/LTV engine.
- Marginal LTV impact.
- Next-best-action primitives.

**Reescribir:**

- UI Customer360 como panel contextual dentro de Deal Desk.
- API routes hacia data products versionados.

### 3.6 Elasticity, what-if y backtesting

**Origen:**

- `utils/elasticity/`
- `utils/backtesting/`
- `utils/backtestEngine.ts`
- `utils/pricing/priceElasticity.ts`
- `components/WhatIf/`
- `server/routes/whatIf.ts`

**Destino recomendado:**

```text
packages/portfolio-simulation/
services/portfolio-service/
```

**Extraer:**

- Elasticity model primitives.
- Backtesting runner.
- Drift detector.
- Benchmark compare logic.

**Ajustar:**

- Unificar con Portfolio Steering y Model Governance.
- Separar `simulation definition`, `simulation run`, `simulation result`.

### 3.7 Adapter layer

**Origen:**

- `integrations/types.ts`
- `integrations/registry.ts`
- `integrations/inMemory.ts`
- `integrations/sso.ts`
- `integrations/sso/google.ts`
- `integrations/coreBanking/*`
- `integrations/crm/salesforce.ts`
- `integrations/marketData/bloomberg.ts`
- `integrations/budget/alquid.ts`
- `integrations/admission/puzzle.ts`

**Destino recomendado:**

```text
packages/integration-contracts/
services/data-ingestion-service/
```

**Extraer:**

- `AdapterResult<T>` como contrato.
- Health check shape.
- Registry pattern.
- In-memory adapters para tests.
- Google SSO role derivation como referencia.

**Ajustar:**

- Convertir adapters en data products con schema/freshness/quality.
- No mezclar provider client con route handlers.
- Stubs deben fallar como `not_configured`, no quedarse como "fake success".

### 3.8 Observability, SLOs y workers

**Origen:**

- `server/routes/observability.ts`
- `components/Admin/SLOPanel.tsx`
- `components/Admin/HealthDashboard.tsx`
- `server/workers/*`
- `utils/metrics.ts`
- `server/integrations/alertChannels.ts`
- `docs/runbooks/`

**Destino recomendado:**

```text
services/platform-ops/
packages/data-quality/
infra/runbooks/
```

**Extraer:**

- Alert evaluator core.
- Alert channel senders, con revision de secrets.
- Worker health concepts.
- Runbook templates.
- Tenancy violation/SLO concepts.

**Ajustar:**

- Health debe girar alrededor de data products y procesos de negocio, no solo
  routers/metrics.
- DORA register/third-party risk debe estar modelado como entidad propia.

### 3.9 Web Push y mobile approvals

**Origen:**

- `server/integrations/webPushSender.ts`
- `server/integrations/escalationPushDispatcher.ts`
- `server/routes/notifications.ts`
- `utils/notifications/pushSubscribe.ts`
- `api/pushNotifications.ts`
- `docs/runbooks/web-push-troubleshooting.md`

**Destino recomendado:**

```text
services/notification-service/
packages/browser-push/
```

**Extraer:**

- VAPID integration.
- SSRF allowlist for push endpoints.
- Stale endpoint purge.
- Retry counters.
- Browser subscription helper.

**Ajustar:**

- Generalizar payloads: approval, policy change, incident, model drift.
- Añadir preferences por usuario/tenant.

### 3.10 Testing y quality gates

**Origen:**

- `utils/__tests__/`
- `components/*/__tests__/`
- `e2e/`
- `scripts/check-*.ts`
- `playwright.config.ts`
- `vite.config.ts`

**Destino recomendado:**

```text
packages/test-fixtures/
infra/ci/
```

**Extraer:**

- Golden pricing regression tests.
- E2E mock API pattern.
- Bundle budget check.
- API spec check.
- Seed/schema sync idea.
- Dependency allowlist check.

**Ajustar:**

- En greenfield, sustituir seed/schema sync por generated contracts y DB
  migration tests.
- Crear integration DB efimera obligatoria en CI, no opt-in local solamente.

---

## 4. Piezas a reescribir

### 4.1 UI y navegacion

**Origen actual:**

- `App.tsx`
- `appNavigation.ts`
- `components/*`
- `contexts/*`
- `translations/*`

**Problema:**

- Demasiadas vistas compitiendo por ser producto principal.
- Contexts transversales con alta superficie.
- UI crecida por olas: muchas pantallas correctas individualmente, pero no
  una experiencia unica decision-first.

**Decision:**

Reescribir sobre 5 areas: Deal Desk, Portfolio Steering, Policies & Models,
Data Health, Audit & Replay.

**Se puede reutilizar como referencia visual/funcional:**

- `components/Calculator/PricingReceipt*`
- `components/Calculator/PricingReceiptWaterfall.tsx`
- `components/Attributions/ApprovalCockpit.tsx`
- `components/Deals/DealTimelineView.tsx`
- `components/Admin/AdapterHealthPanel.tsx`
- `components/StressPricing/StressPricingView.tsx`

Pero no copiar el shell ni la navegacion.

### 4.2 API routes

**Origen actual:**

- `server/routes/*`
- `api/*`
- `api/mappers.ts`

**Problema:**

- BFF y dominio mezclados.
- Algunos routers son demasiado amplios.
- Contratos no son la unica fuente de verdad.

**Decision:**

Reescribir como servicios por bounded context y generar clients desde contracts.
Los mappers existentes sirven como referencia de naming snake/camel.

### 4.3 Schema y migrations

**Origen actual:**

- `supabase/migrations/*`
- `server/migrate.ts`
- `supabase/schema_v2.sql`

**Problema:**

- Hay drift historico entre migrations, inline schema y seeds.
- El greenfield no debe tener dos schemas operativos.

**Decision:**

Extraer conceptos de tabla, no SQL completo. Crear migrations nuevas desde
contratos y aplicar migration tests desde el primer dia.

### 4.4 AI chat

**Origen actual:**

- `components/Intelligence/*`
- `utils/ai/*`
- `utils/copilot/*`
- `server/routes/copilot.ts`
- `server/routes/gemini.ts`

**Problema:**

- AI como chat/panel es menos diferencial que AI embebida en decisiones.

**Decision:**

Extraer:

- prompt builder,
- citation validator,
- grounding checks,
- redaction,
- negotiation agent ideas.

Reescribir:

- UX,
- orchestration,
- audit trail,
- model governance.

---

## 5. Piezas a descartar

| Path / familia                                              | Motivo                                           |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `N-Pricing-Pitch-Comercial.html`, `N-Pricing-Brochure.html` | Material comercial, no base producto             |
| `screenshots/`                                              | Artefactos de demo/documentacion                 |
| `.claude/`, `.superpowers/`, `Cowork/`                      | Contexto operativo, no producto                  |
| `dist/`, `coverage/`, `node_modules/`                       | Build/runtime local                              |
| Roadmaps antiguos que contradigan codigo                    | Mantener solo como historia, no como fuente viva |
| Sidebar con 20+ entradas                                    | Antipatron para greenfield                       |
| `server/migrate.ts` como schema operativo paralelo          | Fuente de drift                                  |
| Demo seed como flujo real                                   | Riesgo de mezcla demo/produccion                 |

---

## 6. Extraccion por fases

### Fase A — Carve-out de paquetes puros

1. Crear `packages/pricing-kernel`.
2. Mover/copiar logica pura de `utils/pricing*`.
3. Crear fixtures golden.
4. Eliminar dependencias a `types.ts` monolitico.
5. Publicar API del paquete:
   - `calculatePrice`
   - `explainPrice`
   - `stressPrice`
   - `comparePricingOutputs`

### Fase B — Audit/replay foundation

1. Crear `packages/audit-replay`.
2. Extraer canonical JSON y hash.
3. Definir `PricingSnapshotV1`.
4. Crear writer unico.
5. Crear chain verifier.

### Fase C — Decisioning

1. Crear `packages/policy-engine`.
2. Extraer approval routing y escalation evaluator.
3. Redefinir vocabulario:
   - `ApprovalLevel`
   - `ApprovalRoute`
   - `PolicyBreach`
   - `DecisionRecord`
4. Crear service `decisioning-service`.

### Fase D — Relationship and portfolio

1. Extraer CLV/LTV y relationship aggregator.
2. Extraer elasticity/backtesting.
3. Redisenar outputs para Portfolio Steering.

### Fase E — Integrations/data products

1. Extraer `AdapterResult<T>`.
2. Crear contratos por data product.
3. Portar in-memory adapters.
4. Rehacer adapters reales con config y health estandarizados.

### Fase F — Web app nueva

1. Crear shell minimo.
2. Implementar Deal Desk.
3. Implementar Approval Inbox contextual.
4. Implementar Audit & Replay.
5. Anadir Portfolio Steering.
6. Anadir Policies & Models.
7. Anadir Data Health.

---

## 7. Contrato anti-deuda para el nuevo repo

Reglas que no se deberian negociar:

- No hay ruta nueva sin contrato OpenAPI/handler/test.
- No hay evento nuevo sin schema versionado.
- No hay tabla tenant-scoped sin RLS/policy tests.
- No hay calculo financiero sin golden fixture.
- No hay texto visible sin i18n si el producto sera multi-idioma.
- No hay AI output sin citations/trace/guardrails.
- No hay adapter que lance excepciones como contrato normal.
- No hay demo data en flujo real.
- No hay segunda fuente de schema.
- No hay vista nueva si no pertenece a una de las 5 areas de producto.

---

## 8. Checklist de readiness greenfield

- [ ] `pricing-kernel` puro y con tests golden.
- [ ] Contratos generando tipos y clientes.
- [ ] DB migrations desde cero, sin inline schema paralelo.
- [ ] Event log append-only.
- [ ] Snapshot writer unico.
- [ ] Deal Desk MVP conectado a kernel.
- [ ] Approval workflow con push/deep-link.
- [ ] Audit & Replay con evidence pack minimo.
- [ ] AI Deal Brief con citations y redaction.
- [ ] Data products minimos con health/freshness.
- [ ] E2E critico completo.
- [ ] DORA/AI/model-risk controls documentados y testeables.
