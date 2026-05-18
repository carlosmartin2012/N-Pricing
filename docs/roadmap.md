# N-Pricing — Roadmap

> **Última actualización:** 2026-05-18 · **Decisión de dirección:** continuar en monorepo actual (greenfield descartado).
> Single source of truth para el estado de desarrollo del producto. Sustituye a `roadmap-execution-summary.md`,
> `ola-{6,7,8}-*.md`, `methodology-first-evolution-plan.md`, `next-gen-application-spec.md`,
> `next-gen-extraction-map.md` y `refactor-followups.md` (todos consolidados aquí o archivados).
>
> Estado canónico del producto vivo: [`architecture.md`](./architecture.md). Operación: [`runbooks/`](./runbooks/).
> Gates externos: [`external-readiness-gates.md`](./external-readiness-gates.md).

---

## 1. Estado actual (2026-05-18)

| Capa | Estado | Métrica |
|---|---|---|
| Tests | ✅ Verde | 1944 passing / 31 skipped (integration opt-in) |
| Lint | ✅ Verde | `--max-warnings=0` |
| Typecheck | ✅ Verde | `strict` global; `noUncheckedIndexedAccess` opt-in en 4 archivos |
| Migrations | 48 SQL secuenciales | última: `20260630000003_market_data_tenancy_hardening.sql` |
| Bundle `index` | 525 KB budget | code-split aplicado a CommandPalette y Login |

**Cobertura funcional:** Phase 0-5 + Olas 1-3 + Olas 6 + 8-10 + 11 cerradas en `main`.
**Banca March demo:** entregable, deck en `~/Developer/Cowork/decks/n-pricing-banca-march-demo.html`.

---

## 2. Olas / Phases cerradas

### Phase 0 — Consolidar base (4 sprints) ✅
Multi-tenancy (`tenancyMiddleware`, `withTenancyTransaction`, flag `TENANCY_STRICT`), reproducibilidad (`pricing_snapshots` inmutable + replay con diff field-level), SLOs (`pricing_slo_minute` matview + SLOPanel UI), alertas (5 canales con HMAC), cron scoping. **Commits clave:** `b623a4c → d6bc5d7`. **Docs vivas:** `phase-0-design.md`, `phase-0-technical-specs.md`, `phase-0-rollout.md` (se mantienen — son operativas para el flip strict).

### Phase 1 — Customer 360 ✅
3 tablas (`client_positions`, `client_metrics_snapshots`, `pricing_targets`), aggregator `buildClientRelationship`, cross-bonus relacional, importer CSV, vista `/customers`. **Commits:** `ed942ec`, `ede9e9c`.

### Phase 2 — Channels & Bulk ✅
`channel_api_keys` (sha256), `pricing_campaigns` state machine, token bucket per-key, vista `/campaigns` con mass-action. **Commit:** `e12e8c5`.

### Phase 3 — Governance ✅
Model inventory (SR 11-7 / EBA), signed dossiers (sha256 + HMAC), drift detector, approval escalations con sweeper temporal. **Commit:** `e3d6495`. **Migración temporal:** `20260607000001_escalation_workflow.sql`.

### Phase 4 — Integración bancaria ✅
Adapter layer (`AdapterResult<T>`, registry, in-memory reference + stubs Salesforce/Bloomberg), SSO Google real con JWKS. **Commit:** `c72651c`.

### Phase 5 — SaaS hardening ✅
`provision-tenant.ts` idempotente (<60s SLO), `usage_events`, `tenant_feature_flags`. **NO incluye billing** (decisión: el banco opera la plataforma). **Commit:** `bb6072b`.

### Olas 1-3 — Methodology-first ✅
Target Pricing Grid + Pricing Discipline + Methodology What-If/Optimization. Migración a `main` ya completa. El plan original (`methodology-first-evolution-plan.md`) queda archivado.

### Ola 6 — Tenancy strict + Stress Pricing + Hash chain ✅
16 PRs `#42–#57` + polish posterior (#66 Login lazy, #67 stress e2e, #68 backfill, #70 storybook). Vista `/stress-pricing` con 7×7 EBA presets, `pricing_snapshots.prev_output_hash` con verifier + endpoint admin, edge writer con retry exponencial. **Pendiente ops:** flip `TENANCY_STRICT=on` (no código). **Pendiente input externo:** Bloque D admin UI CRUD + auto-ingest.

### Olas 8 + 9 + 10 — Cobertura Banca March ✅
12 commits, ~13.5k LOC.
- **Ola 8 — Atribuciones jerárquicas:** schema (`attribution_levels`, `attribution_thresholds`, `attribution_decisions`), router puro, simulator, Approval Cockpit, Matrix Editor, drift detector. Migraciones: `20260620000001_attributions.sql`.
- **Ola 9 — Integración Banca March:** PUZZLE adapter (admission), HOST mainframe (SFTP file-drop + reconciliation), ALQUID wrapper (BudgetReconciliationView). Stubs in-memory listos; reales pendientes de credenciales BM.
- **Ola 10 — Hardening + AI:** copilot Cmd+K con `buildAttributionsContextBlock`, drift recalibrator automático (Admin/Risk_Manager approve), mobile-first cockpit, Web Push real con VAPID.

### Ola 11 — Hardening seguridad ✅
PRs `#100, #105, #106, #111`: cross-tenant fixes en report-schedules, Edge metrics, role guards, SSRF, worker overlap protection. CSP reporting infraestructura (`vercel.json` + `server/routes/cspReport.ts`).

### Refactor mecánico — Análisis 8 bloques ✅
Aplicado en `refactor/8-bloques-mejora`: smoke spec rename, JSDoc, CSP reporting, CI E2E gating, ESLint `no-restricted-imports`, `tsconfig.allowJs:false`. Bloques diferidos cerrados después:
- **3.a** `noUncheckedIndexedAccess` — 4 archivos auditados, opt-in incremental.
- **4** Server logger estructurado — `server/logger.ts` + 36 sites migrados (commit `6c9ca23`).
- **5** Split de monolitos — `whatIf.ts`, `attributions.ts`, `seedData.ts`, `e2e/mockApi.ts` ya troceados.
- **1.2** Consolidación `migrate.ts` → migration runner (commit `ee15140`).

---

## 3. Lo que está pendiente (en orden de prioridad)

### 3.1 Ola 7 — UX colaborativa y copiloto contextual ✅ Completa (2026-05-18)

Cinco bloques ortogonales del plan original. Auditoría 2026-05-18 confirmó que A y C estaban ya integrados en `main` antes de la sesión actual; D y E se cerraron en la misma sesión.

| Bloque | Estado | Evidencia |
|---|---|---|
| **A — Deal Timeline unificado** `/deals/:id/timeline` | ✅ Hecho | `utils/dealTimeline/aggregator.ts` + `server/routes/dealTimeline.ts` + `api/dealTimeline.ts` + `hooks/queries/useDealTimelineQuery.ts` + `components/Deals/DealTimeline{Route,View,Filters}.tsx` + `TimelineEventCard`. Linkado desde Blotter, Calculator/DealFlowRail, Control Room y Copilot suggest-actions. 65 tests verdes. La rama `feat/ola-7-deal-timeline-client` (borrada 2026-05-18) era un duplicado obsoleto — el trabajo real ya estaba en `main`. |
| **B — Live presence + locks** | ✅ Hecho | `usePresenceAwareness` + `PresenceAvatars` integrados en Calculator y Blotter (commits `6f60309`/`a682a21`). |
| **C — Copiloto Cmd+K "Ask"** | ✅ Hecho | `CopilotAskPanel` integrado en `CommandPalette.tsx` con modo `mode === 'ask'` (commit `f18fbd2`). Server route + citation validator + types/copilot. |
| **D — i18n namespaces** | ✅ Hecho (2026-05-18) | 28 `nav*` keys migradas a `translations/navigation.{en,es}.ts`. `getTranslations()` mergea el namespace. `TranslationKeys` exportado e intersectado. Test de monolith hygiene previene regresiones. 10 namespaces totales con lazy loaders. |
| **E — Onboarding por rol** | ✅ Hecho (2026-05-18) | ADMIN_TOUR añadido (5 pasos). `getRecommendedTourId('Admin') → 'admin-tour'` (era fallback a main-tour). Translations completas para los tours de Trader/Risk/Auditor (eran refs muertas) + nuevas de Admin. Test hygiene verifica que cada `UserProfile.role` mapea a tour registrado y que todas las titleKey/descriptionKey resuelven en en+es. |

### 3.2 Deudas técnicas concretas

| Item | Esfuerzo | Razón |
|---|---|---|
| ~~**CSP reporting en Vercel**~~ | ✅ Hecho 2026-05-18 | `api/csp-report.ts` Vercel Serverless Function declarada explícitamente en `vercel.json` `functions`. Mirrors `server/routes/cspReport.ts` normalize logic. 4 tests. |
| ~~**`legacy-peer-deps` audit**~~ | ✅ Hecho 2026-05-18 | `eslint-plugin-react-hooks` bumped 7.0.1 → 7.1.1 (peer eslint ahora `^10.0.0`). `.npmrc` borrado, `vercel.json installCommand` sin `--legacy-peer-deps`. Side-effect: recharts 3.7→3.8 — 6 formatters de Tooltip ajustados al nuevo `Formatter<ValueType, NameType>`. |
| ~~**`VERCEL_FORCE_NO_BUILD_CACHE` audit**~~ | ✅ Hecho 2026-05-18 | Flag retirado. `buildCommand` ya hace `rm -rf node_modules/.vite` (la caché crítica). Esperado 30-60s/deploy más rápidos. Re-añadir sólo si reaparece el bug original. |
| **Ampliar `noUncheckedIndexedAccess`** | iterativo (en progreso) | 4 → 23 archivos auditados (2026-05-18). Cubre TODOS los módulos puros del motor financiero (pricing helpers, attributions, governance, customer360, dealTimeline aggregator, backtesting drift). Pendientes: server/* routes (lower priority — bound viene del SQL), components/* UI. Mover flag a `tsconfig.json` global cuando prod-code esté completo. |

### 3.3 Bloqueados por input externo (no código)

| Item | Bloqueado por | Doc |
|---|---|---|
| Flip `TENANCY_STRICT=on` en prod | Decisión ops (canary → prod) | `runbooks/tenancy-strict-flip.md` |
| Adapter real Salesforce FSC | Credenciales del banco ancla | `external-readiness-gates.md` |
| Adapter real Bloomberg/Refinitiv | Credenciales BLPAPI | `external-readiness-gates.md` |
| Adapter real PUZZLE / HOST / ALQUID | Workshop IT Banca March | `external-readiness-gates.md` |
| Backtesting con dataset histórico real | Dataset del banco | `external-readiness-gates.md` |
| Bloque 6 Ola D — Market benchmarks admin UI CRUD | Validación PO | — |

`npm run check:external-readiness -- --require-all` codifica estos gates como verificables.

---

## 4. Decisión estratégica — Greenfield descartado

El plan paralelo "Bank Revenue Intelligence" (`next-gen-application-spec.md` + `next-gen-extraction-map.md`) queda **archivado**. Decisión 2026-05-18: continuar evolucionando el monorepo actual. N-Pricing está consolidado, demo-ready y cubre el caso Banca March; un rewrite no aporta valor incremental que justifique el coste.

Si en el futuro se reabre la conversación, los docs originales están en la historia git (`git show <commit>:docs/next-gen-application-spec.md`).

---

## 5. Cómo entregar trabajo

1. Cada bloque pendiente = una rama dedicada con scope limitado.
2. Commit messages con prefijos `feat`/`fix`/`refactor`/`test`/`docs`/`chore`/`security`.
3. Pre-push: `npm run verify:full` (lint + typecheck + edge + sync + data + security + test + build + bundle + e2e).
4. Tests boundary en cualquier cambio que toque `pricingEngine`, `ruleMatchingEngine`, accounting, snapshots, attributions.
5. RLS / multi-tenancy: copiar el patrón de `customer360`, `governance`, `metering`.
6. Documentación: cuando un bloque se completa, actualizar este `roadmap.md` (no crear `ola-N-*.md` nuevos).

---

## 6. Referencias

- [`architecture.md`](./architecture.md) — overview vivo de capas y módulos.
- [`api-spec.yaml`](./api-spec.yaml) — OpenAPI v2.
- [`phase-0-design.md`](./phase-0-design.md) + [`phase-0-technical-specs.md`](./phase-0-technical-specs.md) + [`phase-0-rollout.md`](./phase-0-rollout.md) — operativos para flip strict.
- [`external-readiness-gates.md`](./external-readiness-gates.md) — gates para producción real.
- [`pricing-methodology.md`](./pricing-methodology.md) — metodología FTP.
- [`integration-tests.md`](./integration-tests.md) — cómo correr tests opt-in.
- [`runbooks/`](./runbooks/) — 13 plantillas operativas.
- [`platform-restructure.md`](./platform-restructure.md) — estado del split `packages/*`.
- [`security-baseline-2026-04.md`](./security-baseline-2026-04.md) + [`rls-audit-2026-04.md`](./rls-audit-2026-04.md) — auditorías de seguridad.
