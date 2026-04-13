# N-Pricing — Methodology-First Evolution Plan

> **Status:** Draft v1 · 2026-04-13
> **Owner:** Gregorio Gonzalo
> **Scope:** Strategic product pivot from deal-centric pricing review to methodology-first target pricing & pricing discipline analytics.
> **Companion docs:** [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md) (UX/UI roadmap H1–H3), [pricing-methodology.md](./pricing-methodology.md) (19-gap engine spec).

---

## 0. TL;DR

Hoy N-Pricing es excelente priceando **una** operación. Este plan añade la capa que los Tier-1 nos están pidiendo: **cómo debería pricearse masivamente** (target grid) y **dónde nos desviamos** (pricing discipline).

Tres olas, cada una entregable de forma independiente:

| Ola | Objetivo | Duración | Valor entregado |
|-----|----------|----------|-----------------|
| **1 — Target Grid** | Materializar la metodología como rate card objetivo consultable, versionada y exportable. | 8 sem | Política de pricing oficial auditable; base para olas 2–3. |
| **2 — Pricing Discipline** | Medir desviación cartera vs target; alertar outliers; scorecards por originador. | 12 sem | Detección de fuga de margen, disciplina comercial. |
| **3 — Methodology What-If** | Simular cambios de política, elasticidad precio-volumen, backtesting. | 20 sem | Decisión data-driven sobre políticas; optimización de cartera. |

**Total:** ~40 semanas calendario. Equipo objetivo: 2 FE + 1 BE + 0.5 QA + 0.3 Product/Methodology.

---

## 1. Contexto y hipótesis

### 1.1 Problema observado
- Los usuarios senior (ALM Head, CRO, Head of Pricing) **no revisan deals uno a uno**. Quieren ver política, desviaciones agregadas y fuga de margen.
- La metodología existe (19 gaps en `pricingEngine`) pero **está atomizada en reglas**, no expuesta como política navegable.
- El análisis "¿qué porcentaje de producción Q1 está fuera del RAROC objetivo?" hoy **no es posible** sin extracción manual a Excel.

### 1.2 Hipótesis
1. Un 70% del valor percibido por un director de ALM viene de **agregados y disciplina**, no de priceo individual.
2. El ciclo de venta se acelera si enseñamos una rate card "tipo Moody's Analytics" + dashboard de disciplina en la demo.
3. El mismo motor (`pricingEngine.calculatePricing`) sirve ambos mundos sin fork: cambia la unidad de trabajo (deal canónico vs. deal real).

### 1.3 Non-goals de este plan
- No sustituye el roadmap UX/UI H1–H3 (command palette, notifications, etc.) — corre en paralelo.
- No introduce un motor ML en producción (Ola 3 solo calibra elasticidad con modelos ligeros + juicio experto).
- No cambia el contrato público del `pricingEngine`: se extienden inputs/outputs, no se rompen.

---

## 2. Arquitectura objetivo

```
                      ┌─────────────────────────────┐
                      │     METHODOLOGY STUDIO      │
                      │  (Rules & Config actual +   │
                      │   Methodology What-If)      │
                      └─────────────┬───────────────┘
                                    │ defines
                                    ▼
        ┌──────────────────────────────────────────────┐
        │           TARGET PRICING GRID                │
        │  product × segment × tenor × currency ×      │
        │  entity → {FTP, margin, client rate, RAROC}  │
        │  versioned snapshots, exportable             │
        └──────────────────┬───────────────────────────┘
                           │ benchmarks
                           ▼
        ┌──────────────────────────────────────────────┐
        │      PRICING DISCIPLINE / GAP ANALYTICS      │
        │  realized deals vs target, leakage €,        │
        │  outliers, originator scorecards, alerts     │
        └──────────────────┬───────────────────────────┘
                           │ feeds
                           ▼
        ┌──────────────────────────────────────────────┐
        │   OPERATIONAL PRICING (existing views)       │
        │   Calculator · Blotter · RAROC · Shocks      │
        └──────────────────────────────────────────────┘
```

**Invariante arquitectónica:** `pricingEngine.calculatePricing()` sigue siendo la única fuente de verdad del cálculo. Target grid = N invocaciones sobre deals canónicos sintéticos. Variance analytics = comparación deal-a-deal contra snapshot de grid.

---

## 3. OLA 1 — Target Pricing Grid (8 semanas)

### 3.1 Objetivo
Que un usuario senior entre a N-Pricing, vaya a *Target Grid*, y vea la rate card oficial derivada de la metodología actual, filtrable, versionada y exportable.

### 3.2 Alcance funcional
- [F1.1] Navegar matriz producto × segmento × tenor × divisa × entidad.
- [F1.2] Ver por celda: FTP objetivo, margen, rate cliente, RAROC, breakdown de componentes.
- [F1.3] Filtros persistentes por dimensión.
- [F1.4] Export PDF y XLSX como rate card oficial.
- [F1.5] Versionado: cada aprobación de cambio metodológico en Governance congela un snapshot.
- [F1.6] Comparar dos snapshots (diff celda por celda, colorcoded).
- [F1.7] Configurar "deal canónico" por cohorte (monto, tenor exacto, rating medio, LTV, etc.).

### 3.3 Data model

**Nueva tabla `methodology_snapshots`:**
```sql
create table methodology_snapshots (
  id uuid primary key default gen_random_uuid(),
  version text not null,                -- e.g. "2026.04.v3"
  approved_at timestamptz not null,
  approved_by uuid references auth.users(id),
  governance_request_id uuid references governance_requests(id),
  methodology_hash text not null,       -- hash of rules+curves+params at snapshot time
  notes text,
  entity_id uuid references entities(id),
  created_at timestamptz default now()
);
```

**Nueva tabla `target_grid_cells`:**
```sql
create table target_grid_cells (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references methodology_snapshots(id) on delete cascade,
  product text not null,
  segment text not null,
  tenor_bucket text not null,           -- "0-1Y" | "1-3Y" | "3-5Y" | "5-10Y" | "10Y+"
  currency text not null,
  entity_id uuid references entities(id),
  canonical_deal_input jsonb not null,  -- inputs used to synthesize
  ftp numeric(10,6) not null,
  liquidity_premium numeric(10,6),
  capital_charge numeric(10,6),
  esg_adjustment numeric(10,6),
  target_margin numeric(10,6) not null,
  target_client_rate numeric(10,6) not null,
  target_raroc numeric(10,6) not null,
  components jsonb not null,            -- full breakdown per 19 gaps
  computed_at timestamptz default now(),
  unique (snapshot_id, product, segment, tenor_bucket, currency, entity_id)
);

create index idx_target_grid_cells_snapshot on target_grid_cells(snapshot_id);
create index idx_target_grid_cells_dims on target_grid_cells(product, segment, tenor_bucket, currency);
```

**Nueva tabla `canonical_deal_templates`:**
```sql
create table canonical_deal_templates (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  segment text not null,
  tenor_bucket text not null,
  currency text not null,
  entity_id uuid references entities(id),
  template jsonb not null,              -- {amount, tenor_months, rating, ltv, ...}
  editable_by_role text[] default array['methodologist','admin'],
  updated_at timestamptz default now(),
  unique (product, segment, tenor_bucket, currency, entity_id)
);
```

**RLS:** read permitido a `pricing_viewer`+; write a `methodologist`, `admin`.

### 3.4 API layer (`api/targetGrid.ts`)

```typescript
// Read
listSnapshots(entityId?: string): Promise<MethodologySnapshot[]>
getSnapshot(id: string): Promise<MethodologySnapshot>
getGridCells(snapshotId: string, filters?: GridFilters): Promise<TargetGridCell[]>
diffSnapshots(fromId: string, toId: string): Promise<GridDiff[]>

// Canonical templates
listCanonicalTemplates(entityId: string): Promise<CanonicalDealTemplate[]>
upsertCanonicalTemplate(t: CanonicalDealTemplate): Promise<void>

// Compute (server-side, invoked on governance approval)
computeSnapshot(governanceRequestId: string): Promise<MethodologySnapshot>

// Export
exportGridXlsx(snapshotId: string, filters?: GridFilters): Promise<Blob>
exportGridPdf(snapshotId: string, filters?: GridFilters): Promise<Blob>
```

Reaprovecha `api/mappers.ts` para snake↔camel. Añade query keys nuevas en `hooks/queries/queryKeys.ts`: `targetGrid.snapshots`, `targetGrid.cells(snapshotId)`, `targetGrid.diff(a,b)`, `targetGrid.templates`.

### 3.5 Engine changes

**Nuevo módulo `utils/targetGrid/`:**
- `synthesizer.ts` — Genera el objeto `PricingInput` canónico a partir de un template + la combinación de dimensiones. Maneja reglas de validación (p.ej. un producto no existe en ciertas divisas).
- `gridCompute.ts` — Orquesta: para cada dim-combo, sintetiza deal, invoca `pricingEngine.calculatePricing()`, persiste celda. Paraleliza con `Promise.all` en lotes de 50 para no saturar la Edge Function.
- `diff.ts` — Lógica de diff celda-a-celda con umbral configurable (p.ej. solo destacar cambios > 5bp en FTP o > 0.5pp en RAROC).

**No se toca `pricingEngine.ts`** — se consume tal cual.

### 3.6 UI components

**Nueva carpeta `components/TargetGrid/`:**

| Componente | Responsabilidad |
|-----------|-----------------|
| `TargetGridView.tsx` | Shell: header con selector de snapshot + filtros, cuerpo con grid o heatmap, panel lateral con detalle. |
| `TargetGridTable.tsx` | Tabla virtualizada (usa `@tanstack/react-virtual` ya presente). Columnas: dimensiones + métricas objetivo. Sort/search. |
| `TargetGridHeatmap.tsx` | Vista alternativa: matriz 2D (tenor × segmento) por producto/divisa, color = RAROC vs. benchmark. |
| `GridCellDetailPanel.tsx` | Detalle lateral: inputs canónicos, breakdown de 19 componentes, histórico del cell. |
| `SnapshotSelector.tsx` | Dropdown con histórico de snapshots, tag "current/approved". |
| `SnapshotDiffView.tsx` | Dos selectores + grid con celdas diff colorcoded. Usado también en Governance workflow (modal). |
| `CanonicalTemplateEditor.tsx` | Form para que el metodólogo defina qué deal canónico usar por cohorte. |
| `ExportGridModal.tsx` | Preview + opciones de export (PDF/XLSX), integra `utils/pdfExport.ts`. |

**Integración navegación:** añadir entrada "Target Grid" en `appNavigation.ts` bajo sección "Methodology". Reordenar según arquitectura objetivo propuesta en §2.

### 3.7 Governance integration

Extender `GovernanceContext` y `utils/governanceWorkflows.ts`:
- Al aprobarse una `methodology_change_request`, disparar `computeSnapshot()` en background.
- En la vista de aprobación, añadir botón "Preview grid diff" que invoca `diffSnapshots(currentApproved, proposed)` y muestra `SnapshotDiffView` en modal → aprobador ve impacto antes de aprobar.
- Registrar en audit log: snapshot creado, hash de metodología, usuario aprobador.

### 3.8 Tests

| Tipo | Cobertura mínima |
|------|------------------|
| Unit | `synthesizer.ts` (todas las combinaciones dim → input válido), `diff.ts` (umbrales, signos), `gridCompute.ts` (batch, error handling). |
| Integration | Mock Supabase + `pricingEngine` real → verificar que una metodología conocida produce una grid conocida (fixture). |
| E2E (Playwright) | Spec nuevo `target-grid.spec.ts`: usuario navega, filtra, abre detalle, exporta XLSX, compara 2 snapshots. |
| Visual (Storybook) | Stories para `TargetGridTable` (loading, empty, populated, outlier), `SnapshotDiffView`. |

**DoD Ola 1:**
- [ ] `npm run verify:full` verde.
- [ ] Grid se computa en <30s para configuración default (5 productos × 4 segmentos × 5 tenors × 3 divisas × 1 entidad = 300 celdas).
- [ ] Export XLSX abre sin errores en Excel y LibreOffice.
- [ ] Aprobar un cambio metodológico de prueba crea snapshot nuevo automáticamente.
- [ ] Demo grabada de 5 min con un cliente interno (BBVA o Sabadell).

### 3.9 Sprint breakdown Ola 1

| Sprint | Semanas | Entregable |
|--------|---------|------------|
| S1 | 1-2 | Data model + migraciones + RLS. API layer read-only con datos mock. `CanonicalTemplateEditor` funcional. |
| S2 | 3-4 | `synthesizer` + `gridCompute` + integración con `pricingEngine`. Primera grid calculada persistida. |
| S3 | 5-6 | UI: `TargetGridView` + `TargetGridTable` + `GridCellDetailPanel`. Filtros persistentes. |
| S4 | 7-8 | Snapshots versionados + `SnapshotDiffView` + integración Governance + export PDF/XLSX + E2E + demo. |

---

## 4. OLA 2 — Pricing Discipline & Gap Analytics (12 semanas)

### 4.1 Objetivo
Medir sistemáticamente la desviación de la producción real vs. target grid. Detectar fuga de margen y outliers. Dar herramientas de coaching comercial.

### 4.2 Alcance funcional
- [F2.1] Dashboard "Pricing Discipline" con KPIs: % deals en banda, leakage €, top outliers, top segmentos con fuga.
- [F2.2] Cálculo de varianza deal-a-deal contra el snapshot vigente al momento de la operación (histórico coherente).
- [F2.3] Tolerance bands configurables por producto/segmento (±bp FTP, ±pp RAROC).
- [F2.4] Drill-down: celda de la grid → lista de deals de esa cohorte con desviación individual.
- [F2.5] Pricing exceptions workflow: deal fuera de banda requiere justificación y aprobación.
- [F2.6] Originator scorecards: métricas por gestor/oficina, evolución temporal.
- [F2.7] Filtros temporales (día, semana, mes, trimestre, custom range) y comparativa YoY.
- [F2.8] Alertas: "si >X% del volumen mensual de cohorte Y va fuera de banda, notificar".

### 4.3 Data model

**Nueva tabla `tolerance_bands`:**
```sql
create table tolerance_bands (
  id uuid primary key default gen_random_uuid(),
  product text,
  segment text,
  tenor_bucket text,
  currency text,
  entity_id uuid references entities(id),
  ftp_bps_tolerance numeric(8,2) not null,       -- e.g. 15 = ±15bp
  raroc_pp_tolerance numeric(8,2) not null,      -- e.g. 1.5 = ±1.5pp
  margin_bps_tolerance numeric(8,2),
  priority int default 100,                       -- lower wins on match
  active boolean default true,
  effective_from date not null,
  effective_to date,
  created_at timestamptz default now()
);
```

**Nueva tabla `deal_variance_snapshots`:**
```sql
create table deal_variance_snapshots (
  deal_id uuid primary key references deals(id) on delete cascade,
  snapshot_id uuid not null references methodology_snapshots(id),
  cohort jsonb not null,                          -- {product, segment, tenor_bucket, currency, entity_id}
  target_ftp numeric(10,6),
  realized_ftp numeric(10,6),
  ftp_variance_bps numeric(8,2),
  target_raroc numeric(10,6),
  realized_raroc numeric(10,6),
  raroc_variance_pp numeric(8,2),
  target_margin numeric(10,6),
  realized_margin numeric(10,6),
  margin_variance_bps numeric(8,2),
  leakage_eur numeric(18,2),                      -- (realized_margin - target_margin) * EAD * tenor_factor
  out_of_band boolean not null,
  band_applied_id uuid references tolerance_bands(id),
  computed_at timestamptz default now()
);

create index idx_variance_cohort on deal_variance_snapshots using gin (cohort);
create index idx_variance_out_of_band on deal_variance_snapshots(out_of_band) where out_of_band = true;
```

**Nueva tabla `pricing_exceptions`:**
```sql
create table pricing_exceptions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id),
  reason_code text not null,                      -- "relationship", "strategic_client", "market_spread", ...
  reason_detail text not null,
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  status text not null default 'pending',         -- pending | approved | rejected
  created_at timestamptz default now(),
  resolved_at timestamptz
);
```

### 4.4 API layer (`api/pricingDiscipline.ts`)

```typescript
getDisciplineKpis(filters: DisciplineFilters): Promise<DisciplineKpis>
listVariances(filters: VarianceFilters, page: PageOpts): Promise<Paged<DealVariance>>
getCohortBreakdown(cohort: Cohort, range: DateRange): Promise<CohortBreakdown>
getOriginatorScorecard(originatorId: string, range: DateRange): Promise<OriginatorScorecard>
listToleranceBands(filters?): Promise<ToleranceBand[]>
upsertToleranceBand(b: ToleranceBand): Promise<void>
recomputeVariance(dealId: string): Promise<void>       // triggered on deal create/update
recomputeAllVariances(snapshotId: string): Promise<JobId>  // batch, returns job to poll
```

### 4.5 Engine changes

**Nuevo módulo `utils/discipline/`:**
- `cohortMatcher.ts` — Dado un deal, resolver su cohorte (dimensiones) y encontrar la celda de target grid aplicable (snapshot vigente + dimensiones).
- `varianceCalculator.ts` — Calcular variance_bps, variance_pp, leakage_eur.
- `bandResolver.ts` — Encontrar la tolerance band aplicable (priority-based matching, similar a `ruleMatchingEngine`).
- `leakageAggregator.ts` — Agregar leakage por cualquier dimensión para KPIs.

**Hook en flujo de deal:** al crear/aprobar un deal en `deals.ts`, disparar `recomputeVariance(dealId)` en background (Supabase function o Edge Function).

**Job batch:** al crearse un `methodology_snapshot` nuevo, ofrecer (opcional) recomputar variance de deals abiertos contra el nuevo target — decisión de producto: ¿variance se congela al momento del deal o se re-evalúa?

> **Decisión documentada:** Variance **se congela** contra el snapshot vigente en `deal.created_at`. Re-evaluación solo a petición explícita (what-if, analítica histórica).

### 4.6 UI components

**Nueva carpeta `components/Discipline/`:**

| Componente | Responsabilidad |
|-----------|-----------------|
| `DisciplineDashboard.tsx` | Shell del dashboard con filtros temporales, selector entidad/divisa. |
| `DisciplineKpiCards.tsx` | 4 KPIs: % in-band, leakage €, outliers count, trend vs prev period. |
| `LeakageByDimensionChart.tsx` | Bar chart: leakage agregado por dimensión seleccionable (product/segment/originator). |
| `VarianceDistributionChart.tsx` | Histograma de distribución de varianza (ideal: centrada en 0, colas controladas). |
| `OutlierTable.tsx` | Top N deals outlier, ordenable por leakage o |variance|. |
| `CohortDrilldownModal.tsx` | Al click en celda de grid → modal con deals de esa cohorte y sus varianzas. |
| `OriginatorScorecard.tsx` | Card por originador: in-band%, leakage atribuible, evolución. |
| `ToleranceBandEditor.tsx` | CRUD de bandas con preview de impacto. |
| `PricingExceptionForm.tsx` | Form al guardar deal fuera de banda. |

**Integración Blotter:** en cada fila de deal añadir chip "variance" (bp/pp, color) + filtro "solo outliers".

### 4.7 Alert engine integration

Reaprovechar el alert engine planificado en H2 del roadmap UX (`IMPROVEMENT_PLAN.md`). Definir tipos de alerta nuevos:
- `DisciplineThresholdAlert` — `%_out_of_band_monthly > threshold` para una cohorte.
- `LeakageAlert` — leakage mensual agregado > threshold absoluto.
- `OriginatorDriftAlert` — scorecard de un originador degrada > Xpp vs baseline.

Notificaciones usan el sistema `useNotifications.ts` + Supabase Realtime.

### 4.8 Tests

| Tipo | Cobertura mínima |
|------|------------------|
| Unit | `cohortMatcher`, `varianceCalculator` (boundary: margen negativo, RAROC cero, divisas mixtas), `bandResolver` (priority matching). |
| Integration | Crear deal → variance calculada correctamente vs snapshot fixture. |
| E2E | Spec nuevo `discipline.spec.ts`: navegar dashboard, filtrar, drill-down, crear pricing exception. |
| Property-based | Leakage aggregator: sum(cohort leakage) == total leakage. |

**DoD Ola 2:**
- [ ] Variance se calcula en <500ms por deal (p95).
- [ ] Dashboard renderiza <2s con 10k deals en el range.
- [ ] Tolerance bands respetan priority matching (test específico).
- [ ] Pricing exception workflow bloquea cierre del deal si status = pending.
- [ ] Alertas llegan en realtime cuando cruza el umbral.

### 4.9 Sprint breakdown Ola 2

| Sprint | Semanas | Entregable |
|--------|---------|------------|
| S1 | 1-2 | Data model discipline + RLS + API read-only. `cohortMatcher` + `varianceCalculator`. |
| S2 | 3-4 | `bandResolver` + `ToleranceBandEditor`. Trigger de variance en create/update de deal. |
| S3 | 5-6 | `DisciplineDashboard` + KPIs + charts principales. |
| S4 | 7-8 | `OutlierTable` + `CohortDrilldownModal` + filtro en Blotter. |
| S5 | 9-10 | `PricingExceptionForm` + workflow de aprobación + audit. |
| S6 | 11-12 | `OriginatorScorecard` + alertas + E2E + demo. |

---

## 5. OLA 3 — Methodology What-If & Optimization (20 semanas)

### 5.1 Objetivo
Pasar de descriptivo a prescriptivo: permitir al metodólogo simular cambios de política y medir impacto sobre la cartera actual antes de aprobarlos.

### 5.2 Alcance funcional
- [F3.1] Duplicar metodología activa a "sandbox methodology".
- [F3.2] Modificar en sandbox cualquier parámetro: fórmulas, curvas, spreads, thresholds ESG.
- [F3.3] Recalcular target grid + variance sobre cartera vigente con sandbox.
- [F3.4] Reporte de impacto: ΔNII estimado, ΔRAROC, volumen en riesgo según elasticidad.
- [F3.5] Modelo de elasticidad precio-volumen por segmento (calibrable: histórico, juicio, o híbrido).
- [F3.6] Backtesting: aplicar methodology_X a cartera histórica de fecha_Y → simular P&L.
- [F3.7] Benchmarking competitivo: comparar target grid vs. mercado (feed externo o input manual).
- [F3.8] Commercial budget integration: cargar objetivos NII/volumen del budget y validar consistencia con target grid.
- [F3.9] Publicar sandbox → se convierte en nueva propuesta de governance.

### 5.3 Data model (resumen — detalle en ola dedicada)
- `sandbox_methodologies` — workspace con hash + diffs sobre la approved.
- `elasticity_models` — por segmento: slope, r², source (empirical/expert/hybrid).
- `market_benchmarks` — feed manual/automatizado de pricing competencia.
- `budget_targets` — objetivos comerciales por dimensión/periodo.
- `backtesting_runs` — resultados de backtest con inputs/outputs/metadata.

### 5.4 API layer (`api/whatIf.ts`, `api/backtesting.ts`, `api/benchmarks.ts`)

Ver detalle en apéndice A (documento separado a producir al iniciar Ola 3).

### 5.5 Engine changes

- `utils/whatIf/sandboxEngine.ts` — Aplica sandbox methodology sobre deals históricos/vigentes sin persistir.
- `utils/elasticity/model.ts` — Calibra y predice volumen afectado por ΔFTP.
- `utils/backtesting/runner.ts` — Orquestador de backtest, reaprovecha backtesting engine del roadmap UX H2.

### 5.6 UI components (resumen)

- `WhatIfWorkspace.tsx` — Shell con selector de methodology, editor, panel de impacto.
- `ImpactReport.tsx` — ΔNII, ΔRAROC, volume at risk, gráficos de sensibilidad.
- `ElasticityCalibration.tsx` — Gestión de modelos de elasticidad.
- `BacktestingConsole.tsx` — Configurar y ejecutar backtests.
- `BenchmarkGrid.tsx` — Target grid side-by-side con mercado.
- `BudgetConsistencyPanel.tsx` — Gap entre budget comercial y target grid.

### 5.7 Sprint breakdown Ola 3

Plan macro (detalle por sprint al iniciar la ola):

| Bloque | Semanas | Entregable |
|--------|---------|------------|
| B1 — Sandbox core | 1-6 | Duplicación de metodología, sandbox engine, recálculo on-the-fly, Impact Report v1. |
| B2 — Elasticity | 7-10 | Modelo de elasticidad, calibración, integración en Impact Report. |
| B3 — Backtesting | 11-14 | Runner, console, validación contra P&L real. |
| B4 — Benchmarks | 15-17 | Feed competitivo, comparativa, alertas de gap de mercado. |
| B5 — Budget & publish | 18-20 | Budget integration, flujo "publicar sandbox → governance request", E2E, demo. |

---

## 6. Cross-cutting concerns

### 6.1 Performance
- Target grid compute: paralelismo en batches de 50, cache de 24h en Supabase.
- Variance: recomputar en Edge Function async (queue), no bloqueante en UI.
- Dashboard discipline: usar materialized views para agregados comunes (`mv_leakage_by_month_cohort`).

### 6.2 Multi-entity
Desde día 1: toda tabla nueva incluye `entity_id`. UI respeta `EntityContext` y permite consolidado del grupo.

### 6.3 i18n
Cada string nuevo va en `translations.ts` en EN y ES. Target ~80 keys nuevas para Ola 1, ~120 para Ola 2.

### 6.4 Offline mode
Target grid: último snapshot en localStorage + fallback a seed.
Variance: read-only en offline (usa snapshot persistido en IndexedDB vía `useSupabaseSync`).

### 6.5 Observability
- Telemetría de compute: duración de `gridCompute`, errores por cohorte.
- Telemetría de UX: eventos de uso de filtros, drill-down, exports.
- Reaprovechar `utils/errorTracking.ts` y `api/observability.ts` existentes.

### 6.6 Security & RLS
- Target grid: read a todos los roles con acceso a pricing; write (canonical templates, bands) a `methodologist`/`admin`.
- Pricing exceptions: write solo a usuarios del deal; aprobación según `governance_approval_matrix`.
- Auditar todo cambio en `tolerance_bands`, `canonical_deal_templates`, aprobaciones de exceptions.

### 6.7 Accesibilidad
Mantener WCAG 2.1 AA como en el roadmap H3. Tablas virtualizadas con `role="grid"`, headers sticky, keyboard navigation en drill-downs.

### 6.8 Mobile
Target grid en mobile: vista compactada por cohorte (card list en vez de tabla). Dashboard discipline: KPI cards + lista top-5.

---

## 7. Dependencias y secuenciación

```
Ola 1 ──► Ola 2 ──► Ola 3
  │         │         │
  │         │         └── depende de: sandbox needs snapshots (Ola 1), elasticity calibrates on variance history (Ola 2)
  │         └── depende de: needs target grid snapshots to compute variance
  └── sin dependencias externas bloqueantes
```

**Dependencias con roadmap UX existente (`IMPROVEMENT_PLAN.md`):**

| Este plan requiere | Viene de | Bloqueante |
|---|---|---|
| Alert engine | UX H2 — "Alert engine" | Sí para Ola 2 F2.8 (puede hacerse después) |
| Backtesting engine | UX H2 — "Backtesting engine" | Sí para Ola 3 B3 (misma pieza) |
| Report scheduling | UX H2 — "Report scheduling" | No (deseable para rate card emails) |
| Real-time collab | UX H3 | No |

**Propuesta de coordinación:** adelantar "Alert engine" y "Backtesting engine" del roadmap UX H2 al periodo de Olas 2–3 de este plan. Fusionar backlogs.

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|
| El cómputo de la grid escala mal con N dimensiones | Alto | Media | Limitar dimensiones default a 5 (ya propuesto); pre-computar asíncrono; cache. |
| La metodología actual no es determinista (depende de curva snapshot) | Medio | Alta | Congelar curva en el snapshot de methodology; documentar como invariante. |
| Tolerance bands se convierten en política política en vez de técnica | Medio | Alta | Governance workflow obligatorio; audit trail; defaults conservadores + plantilla por mercado. |
| Adopción baja por ALM Heads si la grid no resuena con su mental model | Alto | Media | Validar en Sprint 1 con 2–3 clientes (ver quick wins §10); ajustar dimensiones antes de UI final. |
| Pricing exceptions workflow frena negocio | Alto | Media | Hacerlo soft-by-default (alerta, no bloqueo) hasta decidir por cliente; toggle config por entidad. |
| Elasticity model calibrado pobre → what-if poco fiable | Alto | Alta | Etiquetar claramente "estimación con supuestos X"; ofrecer modo "juicio experto" puro sin pretender ser empírico. |
| Divergencia snapshot vs. reality (curvas se mueven, deals llegan tarde) | Medio | Alta | Timestamp explícito en cada celda; permite re-snapshot manual; documento de política de versionado. |
| Multi-entity explota complejidad UI | Medio | Media | Patrón de "scoping" ya resuelto en `EntityContext`; extender con tests específicos multi-entity en Ola 1. |

---

## 9. Métricas de éxito

### 9.1 Ola 1
- Grid expuesta a al menos 2 clientes Tier-1 en demo dentro de 10 sem.
- 100% de cambios metodológicos aprobados generan snapshot automático.
- Usuarios objetivo (metodólogos) exportan rate card al menos 1x/semana.

### 9.2 Ola 2
- >80% de deals en producción tienen variance computada en <5min de creación.
- Al menos 1 cliente identifica fuga de margen medible gracias al dashboard (caso de éxito documentado).
- Reducción del ciclo "detectar outlier → exception" de ad-hoc a <48h.

### 9.3 Ola 3
- Al menos 1 cambio metodológico mayor por cliente usa what-if antes de aprobación.
- Backtest se ejecuta en <10 min para 12 meses de cartera (10k deals).
- Diferencia backtest vs P&L real <10% en validación.

### 9.4 Producto/comercial
- Adopción: +30% de sesiones por usuario senior (ALM/CRO level) vs. baseline pre-Ola 1.
- Win rate comercial en oportunidades donde se demo-ea target grid vs. baseline.
- NPS de director de ALM > NPS actual.

---

## 10. Quick wins de validación pre-compromiso (3 sem antes de Sprint 1 Ola 1)

1. **Prototipo HTML estático de Target Grid** (1 sem) — 1 producto, 1 divisa, 3 segmentos, 4 tenors. Generado manualmente con datos BBVA de ejemplo. Formato pdf + html interactivo.
2. **Mockup Discipline Dashboard** (0.5 sem) — Figma/HTML mock, no funcional.
3. **Entrevistas estructuradas** (1.5 sem) — 3 ALM Heads / Heads of Pricing:
   - ¿Tienen rate card oficial hoy? ¿Qué formato? ¿Quién la mantiene?
   - ¿Cómo miden disciplina hoy? ¿Cuál es la pregunta que más les cuesta responder?
   - ¿Qué tolerancias usarían si pudieran definirlas?
   - Reacción al prototipo + mockup.
4. **Decisiones go/no-go** basadas en feedback:
   - Dimensiones de la grid (confirmar 5 vs. 4).
   - Bloquear o solo alertar en exception workflow.
   - Prioridad de benchmarking competitivo (Ola 3 F3.7) — adelantar o mantener.

---

## 11. Decisiones abiertas (a resolver en kick-off)

| # | Decisión | Opciones | Owner | Deadline |
|---|----------|----------|-------|----------|
| D1 | Dimensiones de la target grid | 5 (prod, seg, tenor, ccy, entity) vs. 4 (sin ccy) vs. 6 (+rating) | Gregorio + cliente piloto | Pre-Sprint 1 |
| D2 | ¿Override manual en celdas de grid? | Sí con governance / No, siempre derivada | Methodology lead | Sprint 1 |
| D3 | Pricing exceptions: hard-block vs soft-alert | Per-entity config / Global hard / Global soft | Product + cliente piloto | Sprint 4 Ola 2 |
| D4 | Tolerance bands: ¿fuente manual o derivada? | Manual solo / Auto-suggest desde histórico + override | Methodology lead | Sprint 1 Ola 2 |
| D5 | Backtest: ¿usa motor FTP actual o motor específico? | Reusar / Fork | Tech lead | Inicio Ola 3 |
| D6 | Elasticity: ¿modelo incluido o plug-in cliente? | Built-in con plantilla / Plug-in cliente | Product + Methodology | Inicio Ola 3 B2 |

---

## 12. Equipo y recursos

### 12.1 Composición mínima por ola
- **Ola 1:** 2 FE (1 senior + 1 mid) + 1 BE/data (partial) + 0.5 QA + 0.3 methodology consultant.
- **Ola 2:** 2 FE + 1 BE dedicado + 0.5 QA + 0.3 methodology.
- **Ola 3:** 2 FE + 1 BE + 0.5 data scientist + 0.5 QA + 0.5 methodology.

### 12.2 Stakeholders
- **Sponsor:** Gregorio (Partner nfq Advisory).
- **Cliente piloto:** por confirmar — candidatos BBVA (ALM Markets) o Sabadell (Treasury).
- **Methodology lead:** rol interno nfq + validación por cliente piloto.
- **Governance approver:** metodólogo del cliente + comité de precios interno.

---

## 13. Artefactos paralelos a generar

| Artefacto | Cuándo | Propósito |
|-----------|--------|-----------|
| Brief comercial (1-pager) | Pre-Ola 1 | Presentar a clientes la evolución como propuesta de upgrade. |
| Demo grabada Ola 1 | Fin Ola 1 | Asset comercial. |
| Whitepaper "Methodology-First FTP" | Durante Ola 1 | Posicionamiento thought leadership (usar `/pov-generator`). |
| Checklist de adopción cliente | Pre-Ola 2 | Pre-requisitos de datos/config para activar discipline. |
| Demo grabada Ola 2 | Fin Ola 2 | Asset comercial + training. |
| Caso de éxito documentado | Post-Ola 2 | Material para decisión de Ola 3. |

---

## 14. Próximos pasos inmediatos

1. ✅ **Revisar este plan** (ahora, con Gregorio).
2. 🔲 Resolver decisiones D1, D2 como mínimo.
3. 🔲 Confirmar cliente piloto para entrevistas quick-win §10.
4. 🔲 Sprint 0: entrevistas + prototipo estático (3 sem).
5. 🔲 Go/no-go Sprint 1 Ola 1.
6. 🔲 Kick-off técnico: crear issue epics por ola en backlog, enlazar a este documento.

---

*Este plan es vivo. Revisión y update al final de cada ola. Changelog al pie del documento.*

---

## Changelog

- **2026-04-13** — v1 draft inicial creado por Gregorio + Claude (explanatory session). Estructura de 3 olas, scoping, data model preliminar.
