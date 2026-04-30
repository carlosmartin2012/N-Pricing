# Ola 8 — Atribuciones jerárquicas y Approval Cockpit (cobertura Banca March)

> **Estado:** 📋 **Plan** — 2026-04-30 · **Predecesor:** [`ola-7-collaborative-ux.md`](./ola-7-collaborative-ux.md) (📋 plan)
> **Origen:** análisis email Banca March (Nov 2022) + PDFs *Visión NFQ F&R — Foco Pricing* (Dic 2022) y *NFQ-BM Enfoque Pricing alternativo* (Oct 2023). Ver [Apéndice A](#apéndice-a--mapping-completo-banca-march).
> **Esta ola NO es:** un módulo cerrado para BM. El modelo de atribuciones es **genérico** (árbol N-ario *delegated authority* + threshold matching) y sirve para BBVA, Sabadell, Pichincha y cualquier banco con jerarquía organizativa.

---

## Estado por bloque (2026-04-30)

| Bloque | Pieza | Base existente | Esfuerzo neto |
|---|---|---|---|
| **A — Modelo de dominio de atribuciones** | Schema (`attribution_levels`, `attribution_thresholds`, `attribution_decisions`) + tipos + router + servicio routing/simulator | Governance workflows, escalation sweeper, RBAC, `pricing_snapshots` hash chain | **3 sem** (alto) |
| **B — Approval Cockpit + Simulador** | Vista `/approvals` por figura comercial + simulador de modulación de palancas + editor de matriz (Admin) | What-If view, RBAC roles, `pricingEngine` cliente-side | **4 sem** (alto) |
| **C — Reporting de atribuciones** | Vistas drill-down volumen/nivel/zona/oficina + drift detector específico | Reporting framework + PDF/xlsx export + `driftDetector.ts` (Phase 3) | **1-2 sem** (bajo) |

**Conclusión:** Ola 8 cierra el **gap funcional principal** identificado en el email de Esteve Morey (Banca March, Nov 2022) y en la fase "Robustez" del PDF Dic 2022. Construye sobre primitives ya existentes; el trabajo neto son ~8-10 semanas-persona repartidos en 3 bloques con bajo acoplamiento. Bloque A es prerrequisito de B y C; B y C pueden trabajarse en paralelo a partir de S4.

---

## 0. TL;DR

Tres bloques que entregan **una solución completa de delegated authority pricing**:

1. **Modelo de dominio (A)** — árbol N-ario `attribution_levels` (Oficina → Zona → Territorial → Comité), thresholds por scope (producto × segmento × plazo × volumen), decisiones append-only con hash chain a `pricing_snapshots`.
2. **Approval Cockpit (B)** — bandeja por figura comercial + simulador "qué pasa si bajo X bp / quién aprueba" + editor visual de la matriz para Admin/Risk.
3. **Reporting (C)** — drill-down jerárquico, drift detector (alerta si Director Oficina aprueba sistemáticamente al límite), export ejecutable.

Cada bloque cierra con un PR mergeable a `main`. Bloque A es prerrequisito de B y C.

---

## 1. Bloque A — Modelo de dominio de atribuciones

### Objetivo

Modelar formalmente la **delegated authority por jerarquía organizativa**: dado un quote (precio propuesto + RAROC + volumen), determinar qué nivel mínimo tiene atribución para aprobarlo, persistir la decisión inmutable, y exponer un servicio de routing/simulator reusable desde server y cliente.

Hoy N-Pricing tiene `governanceWorkflows.ts` + `escalationSweeper.ts` + RBAC, pero **sin modelo formal de jerarquía multinivel ni threshold routing por scope de operación**. Esto es lo que pide explícitamente Esteve Morey en el email Nov 2022 ("modular componentes de rentabilidad para incentivar autorización a figuras comerciales — Directores, Zonas, Territoriales") y la fase Robustez del PDF Dic 2022.

### Pre-condiciones

- ✅ `pricing_snapshots` con hash chain (Phase 0) — base de la trazabilidad.
- ✅ `governance_*` tables (Phase 3) — model inventory + signed dossiers como referencia de patrón append-only.
- ✅ `escalations` + `escalationSweeper` — base de escalation temporal.
- ✅ RBAC con roles `Admin`, `Risk`, `Commercial` — extender, no rediseñar.
- ❌ No existe modelo de jerarquía organizativa multinivel.
- ❌ No existe threshold matcher por scope de operación.
- ❌ No existe servicio `routeApproval(quote, matrix)`.

### Diseño

**Schema** (nueva migración `supabase/migrations/2026XXXX_attributions.sql`):

```sql
CREATE TABLE attribution_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id),
  name text NOT NULL,                      -- "Director Oficina Madrid Centro"
  parent_id uuid REFERENCES attribution_levels(id),  -- N-ario tree, NULL = raíz
  level_order int NOT NULL,                -- 1=Oficina, 2=Zona, 3=Territorial, 4=Dirección, 5=Comité
  rbac_role text NOT NULL,                 -- mapea a `users.role`
  metadata jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (entity_id, name)
);

CREATE INDEX idx_attribution_levels_entity ON attribution_levels(entity_id);
CREATE INDEX idx_attribution_levels_parent ON attribution_levels(parent_id);

CREATE TABLE attribution_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id),
  level_id uuid NOT NULL REFERENCES attribution_levels(id),
  scope jsonb NOT NULL,                    -- {product, segment, currency, tenor_max_months, ...}
  deviation_bps_max numeric,               -- max desviación permitida sobre precio estándar
  raroc_pp_min numeric,                    -- RAROC mínimo permitido (%)
  volume_eur_max numeric,                  -- volumen máximo aprobable a este nivel
  active_from date NOT NULL DEFAULT current_date,
  active_to date,                          -- NULL = sin caducidad
  created_at timestamptz DEFAULT now(),
  CHECK (deviation_bps_max IS NOT NULL OR raroc_pp_min IS NOT NULL OR volume_eur_max IS NOT NULL)
);

CREATE INDEX idx_attribution_thresholds_level ON attribution_thresholds(level_id);
CREATE INDEX idx_attribution_thresholds_scope ON attribution_thresholds USING gin(scope);

-- Append-only por RLS: sin policies UPDATE/DELETE
CREATE TABLE attribution_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  required_level_id uuid NOT NULL REFERENCES attribution_levels(id),
  decided_by_level_id uuid REFERENCES attribution_levels(id),
  decided_by_user uuid REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','escalated','expired')),
  reason text,
  pricing_snapshot_hash text NOT NULL,    -- FK lógica a pricing_snapshots.hash (no FK física porque snapshot es por entity)
  routing_metadata jsonb,                  -- {deviationBps, rarocPp, volumeEur, scope}
  decided_at timestamptz DEFAULT now()
);

CREATE INDEX idx_attribution_decisions_deal ON attribution_decisions(deal_id);
CREATE INDEX idx_attribution_decisions_user ON attribution_decisions(decided_by_user);
CREATE INDEX idx_attribution_decisions_snapshot ON attribution_decisions(pricing_snapshot_hash);

-- RLS estricto: read accesible / insert current / NO update / NO delete
ALTER TABLE attribution_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY attribution_levels_read ON attribution_levels FOR SELECT
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY attribution_levels_insert ON attribution_levels FOR INSERT
  WITH CHECK (entity_id = get_current_entity_id() AND get_current_user_role() IN ('Admin','Risk'));
CREATE POLICY attribution_levels_update ON attribution_levels FOR UPDATE
  USING (entity_id = get_current_entity_id() AND get_current_user_role() = 'Admin');
-- Sin DELETE: levels se desactivan via active=false

-- Thresholds idem
-- Decisions: SOLO insert (append-only)
CREATE POLICY attribution_decisions_read ON attribution_decisions FOR SELECT
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY attribution_decisions_insert ON attribution_decisions FOR INSERT
  WITH CHECK (entity_id = get_current_entity_id());

-- Trigger: rechaza inserts sin pricing_snapshot_hash válido
CREATE OR REPLACE FUNCTION validate_attribution_decision_hash() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pricing_snapshots
    WHERE hash = NEW.pricing_snapshot_hash AND entity_id = NEW.entity_id
  ) THEN
    RAISE EXCEPTION 'attribution_decision rejects unknown pricing_snapshot_hash %', NEW.pricing_snapshot_hash;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_attribution_decision
  BEFORE INSERT ON attribution_decisions
  FOR EACH ROW EXECUTE FUNCTION validate_attribution_decision_hash();
```

**Tipos de dominio** (`types/attributions.ts`, nuevo):

```ts
export interface AttributionLevel {
  id: string;
  entityId: string;
  name: string;
  parentId: string | null;
  levelOrder: number;          // 1..N (1 = más bajo, N = comité)
  rbacRole: string;
  metadata: Record<string, unknown>;
  active: boolean;
}

export interface AttributionScope {
  product?: string[];          // ["loan","mortgage","line_of_credit"]
  segment?: string[];
  currency?: string[];
  tenorMaxMonths?: number;
  // Extensible vía jsonb
}

export interface AttributionThreshold {
  id: string;
  entityId: string;
  levelId: string;
  scope: AttributionScope;
  deviationBpsMax: number | null;
  rarocPpMin: number | null;
  volumeEurMax: number | null;
  activeFrom: string;
  activeTo: string | null;
}

export interface AttributionDecision {
  id: string;
  entityId: string;
  dealId: string;
  requiredLevelId: string;
  decidedByLevelId: string | null;
  decidedByUser: string | null;
  decision: 'approved' | 'rejected' | 'escalated' | 'expired';
  reason: string | null;
  pricingSnapshotHash: string;
  routingMetadata: {
    deviationBps: number;
    rarocPp: number;
    volumeEur: number;
    scope: AttributionScope;
  };
  decidedAt: string;
}

export interface RoutingResult {
  requiredLevel: AttributionLevel;
  approvalChain: AttributionLevel[];     // de bottom-up: oficina → zona → ... → required
  reason: 'within_threshold' | 'deviation_exceeded' | 'raroc_below_min' | 'volume_exceeded';
  metadata: AttributionDecision['routingMetadata'];
}

export interface SimulationInput {
  quote: PricingQuote;                    // snapshot del motor
  proposedAdjustments: {
    deviationBpsDelta?: number;            // ej. -5 = "bajar 5 bps el precio"
    crossSellEur?: number;
    tenorMonthsDelta?: number;
  };
}

export interface SimulationResult {
  adjustedQuote: PricingQuote;
  newRouting: RoutingResult;
  diffVsOriginal: {
    deviationBps: number;
    rarocPp: number;
    requiredLevelChanged: boolean;
    levelsAvoided: AttributionLevel[];     // niveles que ya NO necesitan aprobar
  };
}
```

**Módulo puro** (`utils/attributions/`):

```
utils/attributions/
├── attributionRouter.ts        # routeApproval(quote, matrix): RoutingResult
├── thresholdMatcher.ts         # findApplicableThresholds(scope, thresholds): AttributionThreshold[]
├── chainBuilder.ts             # buildApprovalChain(level): AttributionLevel[]
├── attributionSimulator.ts     # simulate(input, matrix): SimulationResult
└── __tests__/
    ├── attributionRouter.test.ts
    ├── thresholdMatcher.test.ts
    ├── chainBuilder.test.ts
    └── attributionSimulator.test.ts
```

**Algoritmo `routeApproval`** (resumen):

1. Calcular `deviationBps` = `(finalClientRate - standardRate) * 10000`.
2. Obtener `rarocPp` y `volumeEur` del quote.
3. Para cada `level` ordenado ascending por `levelOrder`:
   - Buscar thresholds aplicables al `scope` del deal (matcher en `thresholdMatcher`).
   - Si `deviationBps <= threshold.deviationBpsMax` AND `rarocPp >= threshold.rarocPpMin` AND `volumeEur <= threshold.volumeEurMax`: este nivel puede aprobar → **devolver**.
4. Si ningún nivel puede → escalar a Comité (último level del árbol).

**Server router** (`server/routes/attributions.ts`):

| Endpoint | Auth | Función |
|---|---|---|
| `GET /api/attributions/matrix` | tenancy | devuelve árbol completo + thresholds activos |
| `POST /api/attributions/matrix` | Admin | crea/actualiza level (versioning automático) |
| `POST /api/attributions/thresholds` | Admin / Risk | añade threshold |
| `POST /api/attributions/route` | tenancy | evalúa quote → `RoutingResult` (sin persistir) |
| `POST /api/attributions/simulate` | tenancy | simula ajustes → `SimulationResult` |
| `POST /api/attributions/decisions/:dealId` | tenancy | crea `AttributionDecision` (append-only) |
| `GET /api/attributions/decisions?level_id=...&from=...` | tenancy | listado para reporting |

Patrón consistente con `routes/customer360.ts`, `routes/governance.ts` (Phase 1, 3).

### Entregables Bloque A

1. Migration `2026XXXX_attributions.sql` (schema + RLS + trigger).
2. Migration en `server/migrate.ts` (schema inline para dev/Replit — patrón obligatorio del repo).
3. `types/attributions.ts` + re-export en `types.ts`.
4. `utils/attributions/` con 4 módulos puros + tests.
5. `server/routes/attributions.ts` + middleware `requireTenancy` + tests guard tenancy.
6. `api/attributions.ts` (cliente tipado) + `hooks/queries/useAttributionMatrixQuery.ts`.
7. Tests:
   - Unit: ≥30 tests (router, matcher, chainBuilder, simulator).
   - Integration RLS: 5 tests opt-in (cross-tenant negativo + append-only verification).
   - E2E: `e2e/attribution-routing.spec.ts` (quote → route → simulate → decide).
8. Documentación: actualizar `docs/architecture.md` con sección "Atribuciones jerárquicas".

### Riesgos Bloque A

| Riesgo | Mitigación |
|---|---|
| Modelo no encaja con organigrama real BM | Workshop con Comercial BM en S2 antes de hard-freeze; el modelo N-ario es flexible (3 niveles para BM, 5 para BBVA, etc.) |
| Threshold matching JSONB es lento en DB con 10k+ thresholds | Index GIN sobre `scope` (ya planeado); benchmarks en S3; fallback a Postgres jsonpath si necesario |
| Hash chain a `pricing_snapshots` se rompe si snapshot se borra | `pricing_snapshots` es append-only por RLS (Phase 0); el riesgo es nulo siempre que se respete |
| Simulator cliente-side desync con server | El motor (`pricingEngine`) es **puro** y vive en `utils/`; mismo código corre cliente y server |

### KPIs Bloque A

| KPI | Baseline | Target |
|---|---|---|
| Coverage `utils/attributions/` | 0% | ≥ 90% lines |
| p95 `POST /api/attributions/route` | n/a | < 50 ms |
| p95 `POST /api/attributions/simulate` | n/a | < 100 ms |
| Tests integration RLS pasan | n/a | 5/5 |

---

## 2. Bloque B — Approval Cockpit + Simulador

### Objetivo

Surfacear la matriz de atribuciones en una **UX accionable** para tres personas:

- **Comercial** (Director Oficina, Gestor Zona) → "qué tengo pendiente, qué puedo aprobar, simulador para encontrar el precio que entra en mi atribución".
- **Risk Officer** → "qué deals están escalados, dónde hay drift sistemático".
- **Admin** → "editor visual de la matriz, versioning, dry-run de cambios".

El simulador es **el componente diferenciador**: convierte el motor de pricing en una herramienta colaborativa donde el comercial pelea palancas (margen, V.Cruzada esperada, plazo) y ve **en tiempo real** quién tiene atribución para aprobar el resultado. Esto es exactamente la "modulación de componentes para incentivar a figuras comerciales" del email de Esteve.

### Pre-condiciones

- ✅ Bloque A en `main` (modelo + servicios).
- ✅ `pricingEngine` ejecutable cliente-side (motor puro, ya validado).
- ✅ `What-If` view existe — se reusa la lógica, no la UI.
- ✅ RBAC roles `Admin`, `Risk`, `Commercial` — extender con sub-roles `BranchManager`, `ZoneManager`, `RegionalManager`, `Committee` (o equivalente per-tenant).
- ✅ NFQ design system + `components/ui/` para tablas, chips, modals.
- ❌ No existe vista `/approvals`.
- ❌ No existe simulador de modulación con feedback de routing.

### Diseño

**Vistas nuevas** (`components/Attributions/`):

```
components/Attributions/
├── ApprovalCockpit.tsx              # /approvals — bandeja por figura comercial
├── ApprovalCockpit.stories.tsx
├── AttributionSimulator.tsx         # widget embebible en Calculator + standalone
├── AttributionSimulator.stories.tsx
├── AttributionMatrixView.tsx        # /attributions/matrix — editor para Admin
├── AttributionMatrixTreeNode.tsx    # subcomponente recursivo del árbol
├── ThresholdEditor.tsx              # form per-threshold con scope selector
├── DecisionHistoryDrawer.tsx        # historial inmutable de decisiones por deal
└── __tests__/
```

**1. Approval Cockpit (`/approvals`)**

```
┌─────────────────────────────────────────────────────────┐
│  Mi atribución: Director Oficina (Madrid Centro)        │
│  Pendientes: 12   Volumen agregado: 4.2 M€              │
│  RAROC medio: 14.3%   Drift vs estándar: +8.5 bps       │
├─────────────────────────────────────────────────────────┤
│ Deal       │ Cliente   │ Producto │ Δbps │ RAROC │ Acción│
│ ABC-1234   │ ACME SA   │ Préstamo │ -7.2 │ 13.8% │ [✓][✗][↑]│
│ ABC-1235   │ BETA SL   │ Hipoteca │ -3.1 │ 16.2% │ [✓][✗][↑]│
│ ABC-1240   │ GAMMA SA  │ Línea    │-12.4 │ 11.5% │ [↑] (necesita Zona)│
└─────────────────────────────────────────────────────────┘
```

- Tabla virtualizada con `@tanstack/react-virtual` (ya en deps).
- Acciones inline: `[✓ Aprobar]`, `[✗ Rechazar]`, `[↑ Escalar]` con modal de motivo.
- Hard floor: el botón aprobar **se deshabilita** si la decisión cae bajo el precio mínimo regulatorio (capital + LCR + NSFR) — UX previene errores.
- Filtros: por producto, segmento, drift, urgencia (TTL escalation).
- Bulk actions: aprobar varios a la vez con mismo motivo.

**2. Attribution Simulator (widget en Calculator + standalone)**

```
┌─ Simulador de atribución ──────────────────────────────┐
│  Precio actual: 4.85% (Δ -7.2 bps)  RAROC: 13.8%       │
│  Tu nivel (Director Oficina) ✓ puede aprobar           │
│                                                         │
│  Modular palancas:                                      │
│   Margen comercial:     [-15bp ━━●━━━ +15bp]            │
│   V.Cruzada esperada:   [0 ━━━●━━━━ 50k€]               │
│   Plazo (meses):        [6 ━━━━●━━━ 60]                 │
│                                                         │
│  Resultado simulado:                                    │
│   Precio: 4.92% (Δ -0.2 bps)  RAROC: 15.1%              │
│   ✓ Tu nivel puede aprobar (margen 4.5 bps disponible) │
│   Ahorro de tiempo: ~3 días (no escala a Zona)         │
│                                                         │
│  [Aplicar al deal] [Solicitar aprobación]               │
└─────────────────────────────────────────────────────────┘
```

- Sliders con debounce 200 ms.
- Cada cambio recalcula `pricingEngine` cliente-side + `routeApproval` cliente-side → feedback inmediato sin round-trip al server.
- "Ahorro de tiempo" calculado por SLA medio histórico de cada nivel (de `attribution_decisions`).
- "Aplicar al deal" requiere confirmación + crea `pricing_snapshot` + ofrece "Solicitar aprobación".

**3. Attribution Matrix View (`/attributions/matrix`, Admin only)**

- Árbol jerárquico drag-and-drop (con `@dnd-kit/core` — añadir dep si no está).
- Por cada nodo: thresholds activos, count de decisiones último mes, drift acumulado.
- Editor inline de thresholds (modal con scope selector multi-select).
- **Versioning visible**: cada cambio crea row nuevo en `attribution_levels` (con `active=false` para el predecesor); diff visual entre versiones.
- Dry-run: "si aplico estos cambios, ¿cuántos deals del último mes habrían cambiado de nivel requerido?" — replica decisiones históricas con la nueva matriz.

### Entregables Bloque B

1. 4 vistas nuevas (`ApprovalCockpit`, `AttributionSimulator`, `AttributionMatrixView`, `DecisionHistoryDrawer`).
2. Sub-componentes (`MatrixTreeNode`, `ThresholdEditor`).
3. Wiring en `App.tsx` (rutas `/approvals`, `/attributions/matrix`) + `appNavigation.ts`.
4. Embed de `AttributionSimulator` en `Calculator/PricingWorkspace.tsx`.
5. Storybook stories para los 4 componentes principales.
6. i18n: `translations/attributions.{en,es}.ts` (siguiendo namespaces de Ola 7).
7. Tests:
   - Component (RTL): render + acciones + simulador determinista (~15 tests).
   - E2E `e2e/approval-cockpit.spec.ts`: flujo completo desde Calculator → simulador → solicitud → aprobación.
   - E2E `e2e/attribution-matrix-admin.spec.ts`: editor + versioning + dry-run.
8. Walkthrough nuevo: "Cómo aprobar un deal" para `BranchManager` y "Cómo gestionar atribuciones" para Admin.

### Riesgos Bloque B

| Riesgo | Mitigación |
|---|---|
| Simulador desync con server (cálculo distinto) | Mismo motor puro corre cliente y server; test de paridad cliente↔server con 100 quotes random |
| Comerciales abusan de simulator para encontrar el precio mínimo aprobable y siempre van al límite | Drift detector (Bloque C) detecta el patrón; governance puede ajustar thresholds o auditar comercial |
| Editor de matriz con drag-and-drop rompe relaciones parent_id | Validación server-side rechaza ciclos; versioning permite rollback |
| Bulk approve sin auditoría de calidad | Cada aprobación bulk crea N decisions inmutables; auditable después |

### KPIs Bloque B

| KPI | Baseline | Target post-go-live |
|---|---|---|
| Time-to-decision medio (deal → approved/rejected) | manual, desconocido | < 4 horas |
| % decisiones tomadas via Cockpit (vs email/teléfono) | 0% | ≥ 80% en 3 meses |
| % comerciales que usan Simulador antes de solicitar aprobación | 0% | ≥ 50% |
| Conflictos UX (deal aprobado bajo precio mínimo) | n/a | 0 (UX previene) |

---

## 3. Bloque C — Reporting de atribuciones

### Objetivo

Surfacear el **comportamiento agregado** de la matriz: volumen aprobado por nivel/zona/oficina, drift sistemático por figura comercial, time-to-decision por nivel, y alertas proactivas sobre patrones sospechosos.

Esto cubre el "Generador de Informes" del PDF Dic 2022 (p11 del módulo de Atribuciones) y la solicitud de "cuadro de mando" del email de Esteve.

### Pre-condiciones

- ✅ Bloque A en `main` (`attribution_decisions` poblada).
- ✅ Reporting framework + PDF/xlsx export ya existe.
- ✅ `driftDetector.ts` (Phase 3) — extender para atribuciones.
- ✅ Alert evaluator opt-in (`alertEvaluator.ts`) — añadir SLI de atribuciones.

### Diseño

**Vistas en Reporting** (`components/Reporting/Attributions/`):

1. **Volume Heatmap** — matriz Niveles × (Producto / Segmento / Mes) con colorscale por volumen.
2. **Drift Dashboard** — por figura comercial (gestor / oficina / zona):
   - Drift medio vs estándar (bps)
   - Distribución del drift (histograma)
   - % decisiones al límite (deviation > 80% del threshold)
   - Top 10 figuras con drift sistemático
3. **Time-to-Decision** — distribución por nivel y por producto.
4. **Decision Funnel** — quote → route → decided / escalated / expired.

**Worker nuevo** (`server/workers/attributionDriftDetector.ts`):

- Corre cada 1h (opt-in `ATTRIBUTION_DRIFT_INTERVAL_MS`).
- Calcula por cada `decided_by_user` (últimos 90 días):
  - `drift_mean_bps`, `drift_stddev_bps`, `pct_at_limit`.
- Emite alerta si:
  - `drift_mean_bps > 5` AND `pct_at_limit > 30%` → "Posible patrón sistemático".
  - `time_to_decision_p95 > SLA` → "Cuello de botella en nivel X".

**Plantillas de export** (`utils/reporting/attributionTemplates.ts`):

- Excel: pestañas por mes con filtro por nivel, formato condicional para drift > umbral.
- PDF: report ejecutivo con summary + top 5 deals por drift + recomendaciones.

**SLIs nuevos** en `types/phase0.ts` `PRICING_SLOS`:

```ts
ATTRIBUTION_ROUTE_LATENCY: { p95: 50, p99: 100 },          // ms
ATTRIBUTION_DECISION_TIME: { p95: 4 * 3600 * 1000 },        // ms (4h)
ATTRIBUTION_DRIFT_RATE: { max: 0.10 },                       // 10% deals con drift > 10bps
```

### Entregables Bloque C

1. 4 vistas reporting (Volume Heatmap, Drift Dashboard, Time-to-Decision, Decision Funnel).
2. Worker `attributionDriftDetector.ts` opt-in + tests.
3. Plantillas export PDF/xlsx.
4. SLIs nuevos + alertas en `alertEvaluator`.
5. Runbook nuevo `docs/runbooks/attribution-drift-systematic.md`.
6. Tests:
   - Worker: detección de patrones (~10 tests).
   - Reporting render (~5 tests RTL).
   - E2E export verifica xlsx generado contiene columnas esperadas.

### Riesgos Bloque C

| Riesgo | Mitigación |
|---|---|
| Drift detector con falsos positivos satura ops | Threshold configurable per-tenant + supresión de duplicados (mismo user + mismo patrón) |
| Reporting expone PII a roles que no deberían | Reusa RLS; risk officer ve agregados, admin ve nominales |
| Export xlsx pesado (deals × 12 meses) | Streaming write (xlsx.js writeStream) + paginación |

### KPIs Bloque C

| KPI | Baseline | Target |
|---|---|---|
| Tiempo para generar dashboard mensual | manual, días | < 1 min (automático) |
| Detección proactiva de drift | reactivo | ≥ 80% de casos detectados antes de auditoría |
| % alertas drift que llevan a recalibración | n/a | ≥ 30% (las restantes son ruido legítimo) |

---

## 4. Cronograma sugerido (8-10 semanas)

| Semana | Bloque | Hitos |
|---|---|---|
| 1 | A.1–A.3 | Migration + tipos + módulos puros |
| 2 | A.4–A.5 | Router + tests unit ≥30 — **Bloque A.core mergeable** |
| 3 | A.6–A.8 | API client + hooks + integration tests RLS — **Bloque A completo mergeable** |
| 4 | B.1 | Approval Cockpit (vista + acciones inline) |
| 5 | B.2 | Attribution Simulator (slider + recálculo cliente-side) |
| 6 | B.3 | Matrix View Admin (árbol + editor + versioning) |
| 7 | B.4 | Wiring + Storybook + i18n + e2e — **Bloque B mergeable** |
| 8 | C.1–C.2 | Reporting views + Drift detector worker |
| 9 | C.3–C.4 | Plantillas export + SLIs + runbook — **Bloque C mergeable** |
| 10 | — | Polish, KPIs measurement, demo BM, release notes |

**Hitos comerciales**:
- **S3** — Demo interna del Bloque A con BM (technical workshop).
- **S7** — Demo end-to-end al equipo de Esteve Morey con dataset BM real.
- **S10** — Release candidate listo para integración Ola 9.

---

## 5. Decisiones — resueltas 2026-04-30

1. **Modelo N-ario flexible vs fijo de 4 niveles**: ✅ N-ario. Coste de implementación es marginal y permite cubrir BBVA (5+ niveles), bancos pequeños (2-3) y BM (3-4) con el mismo schema. Fixed levels sería un anti-patrón.

2. **Threshold matching: jsonb GIN vs columnas tipadas**: ✅ jsonb GIN. Trade-off: pierde algo de velocidad en queries muy específicas vs ganancia masiva en flexibilidad (añadir nuevos criterios sin migration). Patrón ya validado en `campaign_matcher` (Phase 2).

3. **Decisiones append-only sin UPDATE/DELETE**: ✅ Mismo patrón que `pricing_snapshots`, `signed_dossiers`. Reproducibilidad regulatoria es non-negotiable. Si una decisión se "anula", se crea una nueva con `decision='reverted'` (no se borra).

4. **Simulator cliente-side**: ✅ Mismo motor puro corre cliente y server. La paridad se valida con test fuzz (100 quotes random comparando outputs cliente↔server). Cualquier divergencia es un bug del motor, no del simulator.

5. **Editor de matriz con dry-run obligatorio**: ✅ Antes de aplicar cambios a `attribution_thresholds`, el editor muestra: "este cambio habría afectado N deals del último mes — X habrían escalado, Y habrían sido auto-aprobados". Reduce riesgo de cambios no informados.

6. **RBAC: extender vs rediseñar**: ✅ Extender. Los roles actuales (Admin, Risk, Commercial) se mantienen; los sub-roles (`BranchManager`, `ZoneManager`, `RegionalManager`, `Committee`) son **labels per-tenant** mapeados a `attribution_levels.rbac_role`. No hay rediseño de RBAC central.

7. **Hard floor regulatorio en UX**: ✅ El botón "Aprobar" se deshabilita si el precio cae bajo el mínimo (capital + LCR + NSFR + opex). Es UX prevention, no business rule — la business rule está en el motor, la UX la surface.

---

## 6. Métricas de éxito (post-Ola 8)

| KPI | Baseline 2026-04-30 | Target post-Ola 8 |
|---|---|---|
| Time-to-decision medio (deal → approved) | manual, días | < 4 horas |
| % decisiones tomadas vía Cockpit (vs email) | 0% | ≥ 80% en 3 meses |
| % decisiones automatizadas (sin intervención humana) | 0% | ≥ 30% (deals dentro de threshold base) |
| Drift sistemático detectado proactivamente | 0% | ≥ 80% antes de auditoría |
| p95 `POST /api/attributions/route` | n/a | < 50 ms |
| Coverage `utils/attributions/` | 0% | ≥ 90% lines |
| Vistas en sidebar | 14 (post-Ola 7) | 16 (+/approvals, +/attributions/matrix) |

---

## 7. Riesgos cross-bloque

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Modelo de jerarquía no encaja con organigrama BM | Media | Alto | Workshop S2 con Comercial BM; modelo N-ario flexible permite ajuste sin migration |
| Comerciales perciben Cockpit como "vigilancia" | Alta | Medio | Roadshow training + framing positivo (autonomía + trade-offs vs control) |
| Drift detector con muchos falsos positivos | Media | Medio | Thresholds configurables per-tenant; periodo de calibración de 30 días post-go-live antes de alertar |
| Schema migration en BM con datos legacy | Media | Alto | Bloque A entrega sin obligar migración inmediata; BM puede empezar con matriz vacía y construir |
| Performance simulator en deals con muchas posiciones | Baja | Medio | Motor puro ya optimizado; add benchmark en S5 |

---

## 8. Lo que NO está en Ola 8

- **Adapters BM** (PUZZLE, HOST mainframe) → **Ola 9** (ver [Apéndice B](#apéndice-b--olas-9-y-10-outline)).
- **Wrapper comparativa presupuestaria ALQUID** → **Ola 9**.
- **Drift recalibrator automático** (sugerencias trimestrales de ajuste de thresholds) → **Ola 10**.
- **AI Assistant entiende atribuciones** (queries en lenguaje natural sobre la matriz) → **Ola 10**.
- **Mobile-first Approval Cockpit** (PWA push notifications) → **Ola 10**.
- Migración de datos legacy de aprobaciones manuales BM → fuera de scope, lo asume BM.

---

## 9. Documentación a actualizar al cierre

- [ ] `CLAUDE.md` — añadir Ola 8 como capa post-Ola 7 + sección "Atribuciones" en pitfalls.
- [ ] `docs/architecture.md` — sección "Atribuciones jerárquicas" + diagrama de capas.
- [ ] `docs/api-spec.yaml` — endpoints `/attributions/*`.
- [ ] `docs/pricing-methodology.md` — sub-sección "Routing de aprobación".
- [ ] `docs/README.md` — registrar este doc + futuros Ola 9 / Ola 10.
- [ ] `docs/runbooks/attribution-drift-systematic.md` — runbook nuevo.
- [ ] `docs/runbooks/attribution-matrix-rollback.md` — runbook nuevo (si versioning de matriz necesita rollback).
- [ ] Release notes consolidadas en `docs/roadmap-execution-summary.md`.

---

## Apéndice A — Mapping completo Banca March

Necesidades extraídas de email Esteve Morey (Nov 2022) + PDF *Visión NFQ F&R Foco Pricing* (Dic 2022) + PDF *NFQ-BM Enfoque Pricing alternativo* (Oct 2023):

| # | Necesidad BM | Fuente | Cobertura N-Pricing | Bloque/Ola |
|---|---|---|---|---|
| 1 | Precio mínimo por **PRODUCTO/GARANTÍA × SEGMENTO × PLAZO** | Email pt.1 | ✅ Total (motor 19 componentes) | producto |
| 2 | Precio estándar a partir del mínimo + margen comercial | Email pt.2 / PDF1 p14 | ✅ Total (Pricing Targets + margen configurable) | producto |
| 3 | Datos necesarios | Email pt.3 / PDF1 p11 | ✅ Total (adapter layer + stubs) | producto |
| 4 | Visualización dos matrices | Email pt.4a | ✅ Total (Target Grid + ESG Grid + Customer Pricing) | producto |
| 5 | Actualización con nuevos segmentos/productos/normativas | Email pt.4b | ✅ Total (Rules & Config + Governance + multi-tenant) | producto |
| 6 | Visión usuario a todos los niveles | Email pt.5 | ✅ Total (17 vistas + RBAC + walkthrough) | producto |
| 7 | Convergencia con RAROC | Email pt.6 / PDF1 p15 | ✅ Total (RAROC Terminal + Economic Profit) | producto |
| 8 | Comparativa precio calculado vs precio real | PDF1 p6 / PDF2 p5 dif. #3 | ✅ Total (Pricing Discipline + Reconciliation) | producto |
| 9 | Análisis sensibilidades + estresados | PDF1 p6 | ✅ Total (Stress Testing + Stress Pricing 6 EBA presets) | producto |
| 10 | **Matriz de Atribuciones jerárquicas** | Email pt.6 / PDF1 p9, p11 | ⚠️ Parcial → Cubierto por **Ola 8** | **Ola 8 A+B** |
| 11 | Generador de informes de atribuciones | PDF1 p11 | ⚠️ Parcial → Cubierto por **Ola 8** | **Ola 8 C** |
| 12 | Integración PUZZLE (CRM riesgos BM) | PDF1 p11 / PDF2 línea C | ⚠️ Adapter → **Ola 9** | Ola 9 A |
| 13 | Integración HOST mainframe | PDF1 p11 | ⚠️ Adapter → **Ola 9** | Ola 9 B |
| 14 | Presupuestación top-down/bottom-up | PDF2 p4 izq. | ❌ Fuera scope (cubierto por ALQUID) | n/a |
| 15 | Comparativa supuestos presupuesto vs precios reales | PDF2 línea B | ⚠️ Parcial → Cubierto por **Ola 9** | Ola 9 C |
| 16 | Análisis as-is del proceso BM | Email final / PDF2 | ❌ Trabajo NFQ Advisory, no producto | n/a |

**Lo que N-Pricing aporta y BM no pidió pero le interesa**:
- Reproducibilidad regulatoria (snapshots inmutables sha256 + replay) — oro para auditoría EBA / SREP.
- Channel pricing API real-time (ready para banca digital).
- Multi-tenant nativo (filiales March Capital / Asset Management).
- PWA offline (sucursales con conectividad intermitente).
- Cross-bonus relacional consumiendo posiciones del cliente (no per-deal).
- Stress Pricing 6 presets EBA estándar.
- Governance SR 11-7 / EBA (model inventory, signed dossiers, drift detection).
- AI Assistant con grounding regulatorio.

---

## Apéndice B — Olas 9 y 10 (outline)

### Ola 9 — Integración Banca March (6-8 semanas, 2 FTEs)

| Bloque | Pieza | Pre-requisito | Esfuerzo |
|---|---|---|---|
| **A — Adapter PUZZLE** | `integrations/admission/puzzle.ts` implementa `AdmissionAdapter`. Webhook real-time + file-drop overnight. | Workshop IT BM en S10 (especificación contrato) | 3-4 sem |
| **B — Adapter HOST mainframe** | `integrations/coreBanking/bm-host.ts`. Patrón file-drop nightly + reconciliation matcher. | Spec de fichero (formato, codificación, calendar) con IT BM | 3 sem |
| **C — Wrapper comparativa presupuestaria ALQUID** | Vista `BudgetReconciliationView` que pulla supuestos de pricing del módulo presupuestario de ALQUID y los compara con precios reales N-Pricing. Línea clara: presupuestación = ALQUID, pricing = N-Pricing. | API ALQUID expuesta (o fallback CSV) | 2 sem |

### Ola 10 — Hardening + AI Insights (4-6 semanas, 1-2 FTEs)

| Bloque | Pieza | Esfuerzo |
|---|---|---|
| **A — AI Assistant entiende atribuciones** | Extender `aiGrounding.ts`. Prompts: "¿Cuántos deals la Zona Norte aprobó al límite el último mes?", "¿Qué Director está más fuera del estándar?". Sugerencias proactivas. | 2 sem |
| **B — Drift recalibrator automático** | Worker `attributionDriftRecalibrator.ts`. Cada Q propone ajustes a thresholds basado en patrón histórico. Governance flow para aprobar/rechazar. | 1-2 sem |
| **C — Mobile-first Approval Cockpit** | PWA push + Cockpit responsive. Decisiones desde móvil para territoriales. | 2 sem (opcional) |

### Estimación coste consolidada

A tarifas NFQ ~600€/día × 5 días/sem:

| Ola | Sem-persona | Coste bruto | Beneficio |
|---|---|---|---|
| **Ola 8** | 8-10 sem × 2-3 FTEs | **70-100 k€** | Producto multi-cliente |
| **Ola 9** | 6-8 sem × 2 FTEs | **60-80 k€** | BM custom (adapters) |
| **Ola 10** | 4-6 sem × 1-2 FTEs | **30-50 k€** | Producto + BM |
| **Total** | ~5-6 meses | **160-230 k€** | |

### Reasignación de los 190 k€ del PDF Oct 2023

| Línea original | Coste original | Nueva asignación N-Pricing | Coste nuevo |
|---|---|---|---|
| A. Revisión + RAROC | 50 k€ + 40 k€/año | Cubierto by default (motor 19 componentes en producción) + licencia anual | 0 k€ + 40 k€/año |
| B. Adaptación ALQUID + comparativa + matriz alocación | 70 k€ | Mitad N-Pricing (Ola 8 B Approval Cockpit + Ola 9 C Wrapper) | 50 k€ |
| C. Integración PUZZLE | 60 k€ | Ola 9 A Adapter PUZZLE | 60 k€ |
| **NUEVO**: Motor de Atribuciones (Ola 8 A) | — | Producto compartido (BM share) | 30 k€ |
| **NUEVO**: Reporting atribuciones (Ola 8 C) | — | BM | 20 k€ |
| **NUEVO**: Adapter HOST (Ola 9 B) | — | BM | 30 k€ |
| **Total one-off** | 180 k€ | | **190 k€** |
| **Recurring** | 40 k€/año | | **40 k€/año** |

Encaje exacto. Mismo presupuesto, producto vivo en lugar de desarrollo ad-hoc, time-to-value 3-4 meses en lugar de >12.

---

## Apéndice C — Argumentario comercial

> **Para la próxima conversación con Esteve Morey:**
>
> "Banca March, lo que en la propuesta de Octubre 2023 planteábamos como evolución a 12-18 meses, hoy es producto vivo. El motor de pricing con los 19 componentes que vimos en el slide 14 está implantado en otros bancos, con multi-tenant, reproducibilidad regulatoria por snapshot inmutable, y stress pricing con presets EBA. Los 190 k€ del PDF Oct 2023 los reasignaríamos así: las líneas A y mitad de B vienen de serie en N-Pricing; el ahorro lo invertimos en lo que en 2023 dejamos en fase Robustez — el **motor de atribuciones jerárquicas** y el cuadro de mando de aprobaciones. Mismo coste, producto vivo, time-to-value 3 meses."

**Pregunta abierta a confirmar con Esteve antes del kickoff de Ola 8**:
- ¿Qué versión de RAROC tienen hoy y cómo lo nutren (ALQUID, Excel, otro)?
- ¿Cuántos niveles tiene su organigrama de atribuciones (Oficina → Zona → Territorial → Comité es lo standard, pero algunas redes tienen 5 o más)?
- ¿Disponen de log histórico de aprobaciones (último año) para alimentar el dry-run del editor?
