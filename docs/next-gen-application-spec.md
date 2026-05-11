# Bank Revenue Intelligence Platform — especificacion de producto y arquitectura

> Propuesta greenfield inspirada por N-Pricing, pero sin heredar su deuda de
> navegacion, duplicidad de fuentes de verdad, mezcla demo/real y crecimiento
> por olas. El objetivo no es "N-Pricing v2"; es una plataforma diferencial
> para decidir, defender y gobernar precio bancario en tiempo real.

---

## 1. Definicion

**Nombre de trabajo:** Bank Revenue Intelligence Platform.

**Categoria:** plataforma de decision de ingresos ajustados a riesgo para banca
comercial, corporate y private banking.

**Promesa:** recomendar el precio defendible de cada operacion, explicar sus
drivers economicos, anticipar la probabilidad de ganar, medir impacto en
portfolio y dejar evidencia auditable para gobierno, modelo y regulador.

**No es:**

- Un calculador FTP aislado.
- Un dashboard de reporting.
- Un chatbot bancario generico.
- Un repositorio de reglas con UI.
- Un clon de N-Pricing con menos pantallas.

**Es:**

- Un **Deal Desk** decision-first.
- Un **Pricing Kernel** determinista, reproducible y versionado.
- Un **Relationship Pricing OS** que mira cliente, balance, capital y
  elasticidad.
- Un **AI-assisted governance cockpit** con trazabilidad, guardrails y human
  approval.
- Un **portfolio steering layer** para NIM, RAROC, crecimiento, concentracion y
  campañas.

---

## 2. Principios de diseño

1. **Decision-first, dashboard-second.** Cada pantalla debe responder una
   decision concreta: que precio, que concesion, que aprobacion, que excepcion,
   que accion comercial o que riesgo operativo.
2. **Motor determinista antes que AI.** La AI propone, resume y explica; el
   motor calcula, valida y registra.
3. **Event-sourced by default.** Toda decision relevante emite eventos
   inmutables. Replay y auditabilidad no se anaden al final.
4. **Una sola fuente de verdad por contrato.** Schema, tipos, API y eventos se
   generan desde contratos versionados.
5. **Demo mode aislado.** Datos demo viven en un paquete/sandbox explicito, no
   mezclados con rutas reales.
6. **Regulatory-by-design.** EBA LOM, DORA, EU AI Act, IRRBB y model-risk
   governance se traducen a controles producto desde el dia uno.
7. **Explainability operativa.** No basta con decir "precio recomendado"; hay
   que mostrar drivers, limites, precedentes, sensibilidad y policy status.
8. **Composicion por bounded contexts.** Los dominios no se organizan por
   carpetas UI sino por capacidades: deal, pricing, governance, portfolio,
   data products, audit, AI.
9. **Bajo acoplamiento con proveedores.** Salesforce, Bloomberg, core banking,
   host, ALQUID, CRM o payments son data products/adapters versionados.
10. **Mobile-aware approvals.** La aprobacion no debe depender de estar en un
    desktop dashboard; deep-links, push y contexto minimo son parte del flujo.

---

## 3. Usuarios y jobs-to-be-done

| Persona                     | Job principal                                                  | Friccion actual que debe resolver                                |
| --------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Relationship Manager        | Defender un precio rentable sin perder la operacion            | No sabe hasta donde puede conceder ni como justificarlo          |
| Pricing Manager             | Controlar excepciones, leaks y disciplina comercial            | Ve reporting tarde y no en el momento de decision                |
| Treasury / ALM              | Alinear precio con funding, liquidez, curvas y balance         | Pricing comercial no siempre refleja coste economico actualizado |
| Risk Manager                | Asegurar RAROC, capital, rating, colateral y policy compliance | Aprobaciones sin suficiente evidencia historica                  |
| Credit Committee            | Decidir excepciones con contexto completo                      | Salta entre snapshots, dossier, audit, blotter y comentarios     |
| CFO / Business Head         | Dirigir margen, crecimiento y mix de portfolio                 | Falta simulacion top-down de targets, campañas y capacidad       |
| Model Risk / Internal Audit | Validar modelos, drift y cambios metodologicos                 | Evidencia repartida en docs, tickets y pantallas                 |
| Platform Ops                | Garantizar resiliencia, integraciones y trazabilidad           | Salud de adapters, workers y terceros poco accionable            |

---

## 4. Producto: navegacion objetivo

La app debe tener una navegacion muy reducida:

1. **Deal Desk**
2. **Portfolio Steering**
3. **Policies & Models**
4. **Data Health**
5. **Audit & Replay**

Todo lo demas aparece contextual: drawers, command palette, panels o deep-links.

### 4.1 Deal Desk

Primera pantalla de la app. No debe ser una landing ni un dashboard decorativo.

Capacidades:

- Inbox de operaciones: draft, priced, exception, pending approval, approved,
  won/lost.
- Recomendacion de precio por operacion:
  - precio objetivo,
  - rango defendible,
  - concesion maxima,
  - hard floor,
  - probability-to-win,
  - RAROC esperado,
  - impacto en NIM y balance,
  - relacion cliente y cross-sell.
- Deal workspace:
  - levers del deal,
  - relationship panel,
  - pricing waterfall,
  - comparable deals,
  - negotiation guidance,
  - policy checks,
  - required approval path,
  - AI deal brief.
- Acciones:
  - request approval,
  - save scenario,
  - compare alternatives,
  - generate committee brief,
  - send CRM note,
  - mark outcome.

Requisitos:

- Cada recomendacion debe indicar version del motor, inputs, context hash y
  policy snapshot.
- Ninguna decision AI debe poder aprobar o cambiar precio sin accion humana
  y rol autorizado.
- El usuario debe poder ver "por que no puedo bajar mas" en una explicacion
  corta, citando reglas y limites.

### 4.2 Portfolio Steering

Vista para direccion y pricing management.

Capacidades:

- NIM, RAROC, spread, volume, win-rate y leakage por:
  - segmento,
  - producto,
  - currency,
  - tenor,
  - rating,
  - business unit,
  - relationship manager,
  - campaign.
- Target grid vivo:
  - objetivos top-down,
  - bandas permitidas,
  - desviacion,
  - excepciones,
  - acciones recomendadas.
- Simulaciones:
  - curva +100 bps,
  - funding stress,
  - campaign discount,
  - tightening de risk appetite,
  - cambio de capital/RWA,
  - escenario macro.
- Elasticity and win-loss:
  - calibration,
  - challenger models,
  - drift,
  - conversion impact.

Requisitos:

- Toda accion masiva debe tener preview, approval, rollback y evidencia.
- Las campañas deben ser policy-aware: no pueden activar precios bajo hard
  floor ni saltar niveles de aprobacion.

### 4.3 Policies & Models

Centro de gobierno funcional, metodologico y de modelo.

Capacidades:

- Inventario de modelos:
  - pricing kernel,
  - elasticity,
  - CLV/LTV,
  - probability-to-win,
  - AI summarization/prompts,
  - rules engines,
  - FTP curves/calibrations.
- Versionado:
  - owner,
  - effective_from/to,
  - validation status,
  - challenger/shadow,
  - rollback target,
  - impact assessment.
- Policy builder:
  - hard floors,
  - delegation of authority,
  - approval matrix,
  - exception bands,
  - customer/segment restrictions.
- Model risk:
  - drift,
  - backtesting,
  - validation pack,
  - limitations,
  - human oversight requirements.

Requisitos:

- Cambios de politica/modelo son propuestas, no mutaciones directas.
- Cada propuesta genera diff, economic impact y approval workflow.
- Para AI, guardar prompt version, tool calls, retrieved sources, refusal/guardrail
  reason y human decision.

### 4.4 Data Health

Vista operativa para datos e integraciones.

Capacidades:

- Health de data products:
  - customers,
  - deals,
  - curves,
  - FTP,
  - capital/RWA,
  - CRM,
  - core banking,
  - payments/ISO 20022,
  - market data,
  - budget/ALQUID.
- Freshness, completeness, reconciliation, schema drift y lineage.
- Workers:
  - ingestion,
  - backtesting,
  - recalibration,
  - alerting,
  - push dispatcher,
  - snapshot chain verifier.
- DORA-oriented operational view:
  - third-party dependencies,
  - incidents,
  - degraded adapters,
  - concentration risk,
  - runbooks.

Requisitos:

- Cada adapter devuelve `AdapterResult<T>` discriminado; no throw como contrato
  de negocio.
- Los fallos de proveedor se clasifican: auth, rate limit, timeout, stale data,
  schema mismatch, provider unavailable, partial data.

### 4.5 Audit & Replay

Centro de evidencia.

Capacidades:

- Snapshot replay:
  - exact replay,
  - current-engine replay,
  - diff numerico,
  - policy diff,
  - context diff.
- Deal timeline:
  - pricing events,
  - approvals,
  - comments,
  - dossiers,
  - AI briefs,
  - outcome,
  - CRM sync,
  - market/context changes.
- Evidence pack export:
  - committee pack,
  - internal audit pack,
  - model validation pack,
  - regulator pack.
- Tamper evidence:
  - hash chain,
  - signature,
  - append-only events,
  - chain verifier.

Requisitos:

- Auditoria no depende de logs tecnicos efimeros.
- La exportacion debe ser reproducible y referenciar IDs de eventos/snapshots.

---

## 5. AI Deal Desk

La AI debe ser un conjunto de capacidades task-specific, no una pantalla de
chat generica.

### 5.1 Agentes/capacidades

| Capacidad              | Entrada                                    | Salida                        | Guardrail                        |
| ---------------------- | ------------------------------------------ | ----------------------------- | -------------------------------- |
| Deal Brief             | deal + cliente + pricing output + policies | resumen ejecutivo y riesgos   | citar fuentes internas           |
| Negotiation Coach      | rango precio + elasticity + comparables    | argumentos y concesion maxima | no recomendar bajo hard floor    |
| Exception Explainer    | policy checks + routing                    | por que requiere aprobacion   | link a reglas/versiones          |
| Committee Pack Drafter | timeline + snapshot + rationale            | dossier editable              | firma humana obligatoria         |
| Portfolio Advisor      | desviaciones + targets + constraints       | acciones tacticas             | simular impacto antes de aplicar |
| Model Risk Assistant   | drift + backtest + model card              | issues y acciones             | no auto-validar modelos          |

### 5.2 Requisitos AI

- Retrieval solo sobre fuentes autorizadas y versionadas.
- Cada respuesta guarda:
  - prompt template id,
  - model id,
  - retrieved source ids,
  - citations,
  - risk flags,
  - user action taken.
- Nunca usar AI para:
  - aprobar excepciones,
  - modificar limites,
  - ocultar drivers,
  - inferir atributos sensibles no presentes,
  - sustituir calculos deterministas.
- Cuando un output pueda afectar creditworthiness o credit scoring de personas
  fisicas, clasificarlo como high-risk candidate bajo EU AI Act y activar:
  - human oversight,
  - logging reforzado,
  - data quality checks,
  - model documentation,
  - bias/fairness review,
  - post-market monitoring.

---

## 6. Pricing Kernel

El kernel debe ser paquete puro, portable y testeable:

```text
packages/pricing-kernel/
  src/
    calculate.ts
    waterfall.ts
    ftp/
    liquidity/
    capital/
    credit/
    esg/
    elasticity/
    relationship/
    stress/
    governance/
    explain/
  tests/
  fixtures/
```

### 6.1 Inputs canonicos

- `DealInput`
- `CustomerContext`
- `RelationshipContext`
- `MarketContext`
- `FundingContext`
- `CapitalContext`
- `PolicyContext`
- `ModelContext`
- `ScenarioContext`

Cada input debe llevar:

- `source`
- `asOf`
- `version`
- `quality`
- `hash`

### 6.2 Outputs canonicos

- `RecommendedPrice`
- `PriceRange`
- `HardFloor`
- `RAROC`
- `NIMImpact`
- `CapitalConsumption`
- `LiquidityCost`
- `WinProbability`
- `RelationshipValue`
- `ApprovalRoute`
- `Waterfall`
- `Explainability`
- `Sensitivity`
- `SnapshotCandidate`

### 6.3 Requisitos de calculo

- Determinismo: mismo input canonico produce mismo output hash.
- No dependencia de DB, HTTP, tiempo real o UI.
- `asOfDate` explicito; nada de `Date.now()` dentro del kernel.
- Tests numericos con tolerancia explicita.
- Fixtures golden para regresion.
- Versionado semantico del engine y de submodelos.

---

## 7. Arquitectura tecnica

### 7.1 Monorepo recomendado

```text
apps/
  web/                         # React app decision-first
  api/                         # BFF / HTTP API
  worker/                      # workers operativos

services/
  pricing-service/             # expone kernel + snapshot writer
  decisioning-service/         # approvals, policies, exceptions
  portfolio-service/           # targets, campaigns, steering
  data-ingestion-service/      # adapters y data products
  ai-orchestrator/             # AI tasks, retrieval, guardrails
  audit-service/               # events, replay, evidence packs

packages/
  domain/                      # tipos de dominio
  contracts/                   # OpenAPI/AsyncAPI/Zod/JSON schema
  pricing-kernel/              # puro
  policy-engine/               # puro
  ai-guardrails/               # validators y citation checks
  ui-system/                   # componentes base
  test-fixtures/               # golden data y scenario fixtures
  data-quality/                # freshness/completeness/reconciliation

infra/
  migrations/
  event-bus/
  observability/
  deployment/
  runbooks/
```

### 7.2 Reglas de dependencia

- `pricing-kernel` no importa nada de `apps`, `services`, DB ni HTTP.
- `domain` no importa infraestructura.
- `contracts` genera clientes y validators.
- `web` habla con `api`, nunca con DB directa.
- `api` orquesta, pero no contiene logica financiera profunda.
- `services/*` son owners de datos/eventos de su bounded context.
- `audit-service` consume eventos; no modifica decisiones de negocio.

### 7.3 Runtime

Opciones razonables:

- **Postgres** para sistema transaccional, RLS si se mantiene Supabase/Postgres.
- **Event bus** para eventos de dominio (`DealPriced`, `ApprovalRequested`,
  `PolicyChanged`, `SnapshotWritten`, `ModelDriftDetected`).
- **Object storage** para evidence packs y documentos firmados.
- **Vector store** solo para retrieval controlado de documentos autorizados.
- **Redis/queue** para workers, rate limits y async jobs si hay multi-replica.

---

## 8. Dominio y eventos

### 8.1 Bounded contexts

| Context               | Owner               | Entidades                                        |
| --------------------- | ------------------- | ------------------------------------------------ |
| Deal                  | Commercial          | Deal, Scenario, Quote, Outcome                   |
| Customer Relationship | Commercial/Risk     | Customer, Position, RelationshipMetric, CLV      |
| Pricing               | Treasury/Pricing    | PricingRun, Waterfall, Snapshot, EngineVersion   |
| Policy & Decisioning  | Risk/Governance     | Policy, ApprovalRoute, Decision, Exception       |
| Portfolio Steering    | CFO/Pricing         | Target, Campaign, SegmentPlan, Simulation        |
| Data Products         | Platform            | DataProduct, AdapterRun, DataQualityCheck        |
| Model Governance      | Model Risk          | ModelCard, Validation, DriftSignal, Challenger   |
| Audit & Evidence      | Internal Audit      | Event, Dossier, EvidencePack, Signature          |
| AI Orchestration      | Platform/Model Risk | AiTask, PromptVersion, RetrievalTrace, Guardrail |

### 8.2 Eventos principales

- `DealCreated`
- `DealPriced`
- `PricingSnapshotWritten`
- `ApprovalRequested`
- `ApprovalDecisionRecorded`
- `PolicyChangeProposed`
- `PolicyChangeApproved`
- `CampaignActivated`
- `DealOutcomeRecorded`
- `ModelDriftDetected`
- `AdapterHealthChanged`
- `EvidencePackGenerated`
- `AiRecommendationGenerated`
- `AiRecommendationAccepted`
- `AiRecommendationRejected`

Cada evento debe tener:

- `eventId`
- `tenantId`
- `occurredAt`
- `actor`
- `correlationId`
- `causationId`
- `schemaVersion`
- `payload`
- `payloadHash`

---

## 9. Datos y contratos

### 9.1 Data products

Cada data product tiene contrato versionado:

- schema,
- owner,
- source system,
- freshness SLO,
- completeness SLO,
- quality checks,
- reconciliation logic,
- allowed consumers,
- retention,
- PII classification.

Data products minimos:

- Customer Master
- Deal Master
- Product Catalog
- Curves
- FTP Rate Cards
- Liquidity Assumptions
- Capital/RWA
- CRM Opportunities
- Core Banking Positions
- Payments/ISO 20022 Signals
- Budget/Plan
- Win/Loss Outcomes
- Market Benchmarks

### 9.2 Contratos API

- OpenAPI para HTTP.
- AsyncAPI para eventos.
- JSON Schema/Zod para payloads.
- Generated TS clients.
- Contract tests obligatorios para cada endpoint/evento publico.

---

## 10. Seguridad, tenancy y resiliencia

### 10.1 Tenancy

- `tenant_id` obligatorio en toda entidad tenant-scoped.
- Middleware valida acceso antes de llegar al handler.
- DB aplica RLS o equivalente.
- Jobs async cargan contexto de tenancy explicitamente.
- Ningun fallback a "default tenant" en modo real.

### 10.2 Seguridad

- RBAC + ABAC para decisiones sensibles.
- Secrets solo server-side.
- Audit append-only.
- Firmas HMAC o asymmetric signatures para dossiers/evidence packs.
- Rate limits por usuario, tenant, API key y adapter.
- Data minimization para AI retrieval.
- Redaction antes de enviar contexto a modelos externos.

### 10.3 DORA/resiliencia

- Inventario de terceros ICT.
- Health por adapter.
- Incident taxonomy.
- SLO/SLA por data product.
- Runbooks por fallo critico.
- Circuit breakers y degraded mode.
- Registro de dependencia critica por proceso de negocio.

---

## 11. UX/UI

### 11.1 Principios

- Densa, sobria, operacional.
- Tipografia: Inter para UI; JetBrains Mono para cifras, hashes, IDs, tablas y
  valores financieros.
- Menos "cards de marketing"; mas surfaces escaneables.
- Cada tabla con acciones inline, filtros persistentes y deep-links.
- Cada decision tiene CTA primario claro.
- Mobile para approvals y review, desktop para analisis denso.

### 11.2 Componentes clave

- Deal Workspace
- Price Recommendation Panel
- Waterfall Explainer
- Relationship Value Strip
- Policy Check Panel
- AI Deal Brief Drawer
- Approval Inbox
- Portfolio Target Grid
- Simulation Console
- Data Product Health Table
- Evidence Timeline
- Replay Diff Viewer

---

## 12. Testing y quality gates

Capas obligatorias:

- Unit tests para kernel y policy engine.
- Golden fixtures para pricing regression.
- Contract tests API/eventos.
- Integration tests con DB efimera.
- E2E criticos:
  - price deal,
  - request approval,
  - approve/reject,
  - replay snapshot,
  - create policy proposal,
  - activate campaign,
  - detect adapter outage.
- AI evals:
  - groundedness,
  - citation coverage,
  - refusal correctness,
  - policy compliance,
  - prompt regression.
- Security checks:
  - dependency audit,
  - tenancy fuzz,
  - SSRF guard,
  - secret scanning,
  - auth/RBAC matrix.

---

## 13. Roadmap greenfield

### Phase 0 — Foundations

- Monorepo, contracts, CI, environments.
- Domain model.
- Pricing kernel extracted.
- Event log.
- Tenancy.
- Snapshot writer.
- Minimal Deal Desk.

### Phase 1 — Deal Desk MVP

- Deal queue.
- Price recommendation.
- Waterfall/explainability.
- Approval request.
- Approval inbox.
- Replay.
- AI deal brief with citations.

### Phase 2 — Relationship Pricing

- Customer 360 data product.
- CLV/LTV.
- Cross-sell and deposits.
- Relationship-aware price range.
- CRM sync.

### Phase 3 — Portfolio Steering

- Target grid.
- Campaigns.
- Budget comparison.
- Elasticity calibration.
- What-if simulations.

### Phase 4 — Governance and Model Risk

- Model inventory.
- Policy proposals.
- Drift/backtesting.
- Evidence packs.
- EU AI Act high-risk workflow where applicable.

### Phase 5 — Industrialization

- Real adapters.
- DORA operational cockpit.
- Workers health.
- Multi-region/degraded mode.
- Bank-specific deployment profiles.

---

## 14. Que no debe entrar al MVP

- 20+ vistas de navegacion.
- Reporting exhaustivo sin decision asociada.
- Billing SaaS/cross-charging si el modelo de negocio no lo exige.
- Chat AI generalista.
- Demo data mezclada en rutas reales.
- Duplicidad de schema: migrations + inline schema divergente.
- Edge functions y server routes escribiendo la misma tabla sin un writer
  comun.
- CSV importers como sustituto de data products.
- UI wrappers genericos sin patron claro.

---

## 15. Referencias externas usadas como constraints

- EBA Guidelines on loan origination and monitoring:
  https://eba.europa.eu/activities/single-rulebook/regulatory-activities/credit-risk/guidelines-loan-origination-and-monitoring
- DORA / EBA:
  https://www.eba.europa.eu/activities/direct-supervision-and-oversight/digital-operational-resilience-act
- EU AI Act Annex III:
  https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3
- NIST AI Risk Management Framework / GenAI profile:
  https://www.nist.gov/itl/ai-risk-management-framework
- Basel Committee IRRBB:
  https://www.bis.org/bcbs/publ/d578.htm
- Swift ISO 20022:
  https://www.swift.com/standards/iso-20022
