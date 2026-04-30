# N-Pricing — Índice de documentación

> Source-of-truth consolidado (2026-04-21). Si añades un documento nuevo,
> registra su ruta y propósito aquí.

## 📚 Estructura canónica

Tres categorías, sin solapamiento:

```
docs/
  reference/   — decisiones arquitectónicas, specs, metodología (evergreen)
  operations/  — runbooks, rollout, seguridad, auditorías (operativo)
  history/     — snapshots históricos (integral reviews, roadmaps completados)
```

La estructura actual mezcla los 3. El plan de consolidación vive más abajo
(sección *Plan de consolidación*). Entre tanto, esta tabla es **LA fuente
canónica**: usa esto para saber dónde está cada cosa, no `git log`.

---

## 🟢 Active reference (lectura viva)

| Documento | Propósito | Owner |
|---|---|---|
| [`architecture.md`](architecture.md) | **Overview maestro post-roadmap.** Lectura obligatoria para onboarding. | Core team |
| [`pricing-methodology.md`](pricing-methodology.md) | Metodología FTP completa (19 componentes). | Risk / ALM |
| [`api-spec.yaml`](api-spec.yaml) | OpenAPI v2. Refresh automático por CI tras cada PR. | Core team |
| [`integration-tests.md`](integration-tests.md) | Cómo correr los tests de integración opt-in. | Core team |
| [`pricing-calculation-observability.md`](pricing-calculation-observability.md) | SLO + snapshots. | SRE |
| [`pricing-plugin-architecture.md`](pricing-plugin-architecture.md) | Cómo extender el motor sin tocar core. | Core team |
| [`methodology-first-evolution-plan.md`](methodology-first-evolution-plan.md) | Plan vivo de evolución metodológica. | Risk / ALM |

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
| 6 — CLV + 360º temporal | 🆕 **DEV** (2026-04-21) | ver sección abajo |

## 🟠 Security & audits

| Documento | Propósito | Fecha |
|---|---|---|
| [`security-baseline-2026-04.md`](security-baseline-2026-04.md) | Baseline actual. Auditar trimestralmente. | 2026-04 |
| [`rls-audit-2026-04.md`](rls-audit-2026-04.md) | Auditoría RLS (26 migraciones). | 2026-04 |

## 🔵 Olas (post-Phase 6)

Capas de evolución posteriores al cierre del roadmap por Phases. Cada Ola es un PR-set mergeable agrupado por bloques A/B/C. El doc se mantiene vivo durante el plan; al cierre del rollout se migra a `📸 HISTÓRICO`.

| Ola | Estado | Doc | Foco |
|---|---|---|---|
| 6 — Tenancy strict + Stress Pricing | ✅ MERGED en `main` (2026-04-23) | [`ola-6-tenancy-strict-stress-pricing.md`](ola-6-tenancy-strict-stress-pricing.md) | A: tenancy hardening · B: stress pricing 6 EBA presets · C: pricing snapshots hash chain |
| 7 — UX colaborativa y copiloto contextual | 📋 PLAN (2026-04-28) | [`ola-7-collaborative-ux.md`](ola-7-collaborative-ux.md) | A: deal timeline · B: live presence · C: Cmd+K copilot · D: i18n namespaces · E: onboarding por rol |
| 8 — Atribuciones jerárquicas + Approval Cockpit (cobertura Banca March) | 📋 PLAN (2026-04-30) | [`ola-8-atribuciones-banca-march.md`](ola-8-atribuciones-banca-march.md) | A: modelo dominio atribuciones · B: Approval Cockpit + Simulator · C: reporting de atribuciones. Apéndice con outline Olas 9 (integración BM) y 10 (AI + drift) |

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

---

## ⚠️ Deprecated / historical (no leer como "live")

Estos documentos fueron snapshots puntuales. Se mantienen como histórico
regulatorio pero **no** son fuente viva:

| Documento | Estado | Reemplazado por |
|---|---|---|
| [`integral-review-2026-04-18.md`](integral-review-2026-04-18.md) | 📸 HISTÓRICO 2026-04-18 | `architecture.md` + `roadmap-execution-summary.md` |
| [`IMPROVEMENT_PLAN.md`](IMPROVEMENT_PLAN.md) | 📸 HISTÓRICO pre-roadmap | este índice + `roadmap-execution-summary.md` |
| [`roadmap-execution-summary.md`](roadmap-execution-summary.md) | ✅ live (snapshot por Phase) | — |
| [`supabase-setup.md`](supabase-setup.md) | ✅ live (dev setup) | — |

---

## 🆕 Phase 6 — CLV + 360º temporal (WIP, 2026-04-21)

Capa de **Customer Lifetime Value** y **timeline temporal** sobre Customer 360.

### Cambios
- Migración: `supabase/migrations/20260608000001_clv_360.sql`
  (3 tablas: `client_events`, `client_ltv_snapshots`, `client_nba_recommendations`).
- Motor puro: `utils/clv/` — ltvEngine, marginalLtvImpact, nextBestAction.
- Server: `server/routes/clv.ts` (tenancy-scoped, patrón Phase 1).
- UI: `components/Customer360/` → LtvProjectionCard, ClientTimeline, NbaRecommendationCard, LtvImpactPanel.
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

### Pendiente
- `LtvImpactPanel` embebido en Pricing Engine (ya existe como componente,
  falta montar en el workspace — depende de tener `selectedDeal` + `clientId`
  en el contexto del calculator).
- Worker nocturno `server/workers/ltvSnapshotWorker.ts` opt-in por
  `LTV_SNAPSHOT_INTERVAL_MS`.
- Integración Salesforce real vía `integrations/crm/salesforce.ts` para
  alimentar `client_events` automáticamente.

---

## Plan de consolidación

Migración propuesta (no ejecutada todavía — es mecánico y puede hacerse en
un PR):

```
reference/
  architecture.md                        (renombrar)
  pricing-methodology.md                 (renombrar)
  pricing-plugin-architecture.md
  methodology-first-evolution-plan.md
  pricing-calculation-observability.md

operations/
  security-baseline.md                   (quitar fecha del nombre)
  rls-audit.md                           (idem)
  integration-tests.md
  runbooks/...                           (sin cambios)

phase/
  0/design.md + specs.md + rollout.md
  6/design.md                            (nuevo — este documento ampliado)

history/
  integral-review-2026-04-18.md
  IMPROVEMENT_PLAN.md
  roadmap-execution-summary.md
  ola-6-tenancy-strict-stress-pricing.md
```

Coste estimado: 1 PR mecánico (1-2h). Riesgo: cero (sólo moves + update de
referencias en CLAUDE.md + README).

## Reglas para documentación nueva

1. **Un documento vive en `reference/`, `operations/` o `history/`** — no hay
   una cuarta categoría.
2. **Si es histórico (snapshot de una fecha), va a `history/`** y se marca
   `📸 HISTÓRICO {fecha}` en el título.
3. **Runbook obligatorio** para cada alerta nueva que genere paging.
4. **Update de este índice** en el mismo PR que añade el doc.
5. No mezclar **decisiones** con **rollout**: dos documentos distintos.
