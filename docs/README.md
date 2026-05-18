# N-Pricing — Índice de documentación

> Source-of-truth consolidado (2026-04-21). Si añades un documento nuevo,
> registra su ruta y propósito aquí.

## 📚 Estructura viva

La tabla de este índice es la fuente canónica de documentación. El árbol ya no
mantiene snapshots históricos ni planes de consolidación paralelos: si un doc
queda obsoleto, se retira o se reemplaza por una entrada viva aquí.

---

## 🟢 Active reference (lectura viva)

| Documento | Propósito | Owner |
|---|---|---|
| [`roadmap.md`](roadmap.md) | **Single source of truth del roadmap.** Estado por Ola/Phase, pendientes, gates externos. | Core team |
| [`architecture.md`](architecture.md) | **Overview maestro post-roadmap.** Lectura obligatoria para onboarding. | Core team |
| [`pricing-methodology.md`](pricing-methodology.md) | Metodología FTP completa (19 componentes). | Risk / ALM |
| [`api-spec.yaml`](api-spec.yaml) | OpenAPI v2. Fuente única validada por `npm run check:api-spec`. | Core team |
| [`integration-tests.md`](integration-tests.md) | Cómo correr los tests de integración opt-in. | Core team |
| [`pricing-calculation-observability.md`](pricing-calculation-observability.md) | SLO + snapshots. | SRE |
| [`pricing-plugin-architecture.md`](pricing-plugin-architecture.md) | Cómo extender el motor sin tocar core. | Core team |
| [`external-readiness-gates.md`](external-readiness-gates.md) | Gates bloqueados por input externo (credenciales, datasets, decisión ops). | Core team |
| [`platform-restructure.md`](platform-restructure.md) | Estado del split `packages/*` (facades, no aislamiento físico). | Core team |

## 🟡 Phase design (design + rollout de cada Phase)

Cada Phase (0-6) tiene hasta 3 documentos: `-design.md` (concepción), `-technical-specs.md` (detalle), `-rollout.md` (secuencia de activación). Se mantienen mientras el rollout no esté al 100% en producción.

| Phase | Estado | Docs |
|---|---|---|
| 0 — Tenancy / snapshots / SLO | ✅ rollout 75% | [design](phase-0-design.md) · [specs](phase-0-technical-specs.md) · [rollout](phase-0-rollout.md) |
| 1 — Customer 360 | ✅ live | (en architecture.md) |
| 2 — Channels + Campaigns | ✅ live | (en architecture.md) |
| 3 — Governance (SR 11-7) | ✅ live | (en architecture.md) |
| 4 — Integrations adapter layer | ✅ live | (en architecture.md) |
| 5 — Metering / feature flags | ✅ live | (en architecture.md) |
| 6 — CLV + 360º temporal | ✅ live | ver sección abajo |

## 🟠 Security & audits

| Documento | Propósito | Fecha |
|---|---|---|
| [`security-baseline-2026-04.md`](security-baseline-2026-04.md) | Baseline actual. Auditar trimestralmente. | 2026-04 |
| [`rls-audit-2026-04.md`](rls-audit-2026-04.md) | Auditoría RLS (26 migraciones). | 2026-04 |

## 🔵 Olas (post-Phase 6)

Estado consolidado en [`roadmap.md`](roadmap.md). Resumen ejecutivo:

| Ola | Estado | Foco |
|---|---|---|
| 6 — Tenancy strict + Stress Pricing + Hash chain | ✅ MERGED en `main` (2026-04-23) | Tenancy hardening · stress pricing 6 EBA presets · pricing snapshots hash chain |
| 7 — UX colaborativa y copiloto contextual | 🟡 PARCIAL — B/C live, A/D/E pendientes | Deal timeline · live presence · Cmd+K copilot · i18n namespaces · onboarding por rol |
| 8 — Atribuciones jerárquicas + Approval Cockpit | ✅ MERGED en `main` (2026-04-30) | Modelo dominio atribuciones · Approval Cockpit + Simulator · reporting drill-down |
| 9 — Integración Banca March (PUZZLE + HOST + ALQUID) | ✅ MERGED en `main` (2026-04-30) | PUZZLE admission adapter · HOST mainframe SFTP + reconciliation · ALQUID budget wrapper |
| 10 — AI grounding + drift recalibrator + mobile + Web Push | ✅ MERGED en `main` (2026-04-30) | Copilot entiende atribuciones · drift recalibrator · mobile cockpit · web-push VAPID |
| 11 — Security hardening | ✅ MERGED en `main` | Cross-tenant fixes · role guards · SSRF · worker overlap protection · CSP reporting |

## 🔴 Operational runbooks

| Runbook | Trigger |
|---|---|
| [`runbooks/tenancy-violation.md`](runbooks/tenancy-violation.md) | `tenancy_guard_missing` en logs |
| [`runbooks/tenancy-strict-flip.md`](runbooks/tenancy-strict-flip.md) | Activar `TENANCY_STRICT=on` en producción |
| [`runbooks/pricing-latency.md`](runbooks/pricing-latency.md) | p95 del motor > SLO |
| [`runbooks/snapshot-write-failure.md`](runbooks/snapshot-write-failure.md) | Fallo escribiendo `pricing_snapshots` |
| [`runbooks/mock-fallback.md`](runbooks/mock-fallback.md) | Motor usó mock en prod |
| [`runbooks/campaign-volume-exhausted.md`](runbooks/campaign-volume-exhausted.md) | Campaign hit volume cap |
| [`runbooks/adapter-down.md`](runbooks/adapter-down.md) | CoreBanking/CRM/MarketData adapter ko |
| [`runbooks/feature-flag-kill-switch.md`](runbooks/feature-flag-kill-switch.md) | Activar kill switch por tenant |
| [`runbooks/backtest-drift.md`](runbooks/backtest-drift.md) | Drift > threshold en backtest |

## 💼 Commercial / Sales

Documentación orientada al equipo comercial NFQ y al comprador en el banco.
**No** es documentación técnica del producto — esa vive en
[`architecture.md`](architecture.md) y siblings.

| Documento | Propósito | Audiencia |
|---|---|---|
| [`commercial/README.md`](commercial/README.md) | Entry point del directorio comercial + workflow de validación con prospects | Sales NFQ |
| [`commercial/modules.md`](commercial/modules.md) | Catálogo de módulos comerciales (Core + 4 módulos opcionales) con buyer persona, workshop, KPIs y pricing tiers | Sales NFQ + comprador del banco |

---

## 🆕 Phase 6 — CLV + 360º temporal

Capa de **Customer Lifetime Value** y **timeline temporal** sobre Customer 360.

### Cambios
- Migración: `supabase/migrations/20260608000001_clv_360.sql`
  (3 tablas: `client_events`, `client_ltv_snapshots`, `client_nba_recommendations`).
- Motor puro: `utils/clv/` — ltvEngine, marginalLtvImpact, nextBestAction.
- Server: `server/routes/clv.ts` (tenancy-scoped, patrón Phase 1).
- UI: `components/Customer360/` → LtvProjectionCard, ClientTimeline, NbaRecommendationCard, LtvImpactPanel.
- Pricing workspace: `components/Calculator/CalculatorWorkspace.tsx` embebe `LtvImpactPanel`.
- i18n: `translations/clv.{en,es}.ts` (primer namespace migrado fuera del monolito).
- Tests: 31 tests motor + 10 tests guard tenancy.

### Endpoints
- `GET /api/clv/clients/:id/timeline`
- `POST /api/clv/clients/:id/timeline`
- `GET /api/clv/clients/:id/ltv`
- `POST /api/clv/clients/:id/ltv/recompute`
- `GET /api/clv/clients/:id/nba`
- `POST /api/clv/clients/:id/nba/generate`
- `PATCH /api/clv/nba/:id/consume`
- `POST /api/clv/preview-ltv-impact` ⭐ **killer demo endpoint**

### Bloqueos externos
- Integración Salesforce real vía `integrations/crm/salesforce.ts` para
  alimentar `client_events` automáticamente. El adapter existe como stub hasta
  contar con credenciales y contrato SOQL definitivo.

---

## Reglas para documentación nueva

1. **Todo documento nuevo debe registrarse en este índice** con propósito y owner.
2. **No añadir snapshots históricos como fuente viva**; si se necesita conservar
   historia, enlazar al commit o release externo.
3. **Runbook obligatorio** para cada alerta nueva que genere paging.
4. No mezclar **decisiones** con **rollout**: dos documentos distintos.
