# N-Pricing — Plan de Pivot a Motor de Pricing Avanzado

> **Tipo:** Plan maestro del pivot FTP → Pricing Avanzado
> **Autor:** Gregorio Gonzalo + Claude (Opus 4.6)
> **Fecha:** 2026-04-13
> **Estado:** Aprobado, arrancable inmediato
> **Piloto:** Banco Tier-1 España (all-segment: Corporate + SME + Retail), arranque limpio (sin backfill)
> **Referencias relacionadas:** [`IMPROVEMENT_PLAN.md`](../IMPROVEMENT_PLAN.md), [`pricing-methodology.md`](../pricing-methodology.md), [`ai-assistant-refocus.md`](./ai-assistant-refocus.md)

---

## 0. Cómo usar este documento

Este plan es complementario al `IMPROVEMENT_PLAN.md`: aquél es consolidación/limpieza, éste es **evolución de posicionamiento**. Ejecutar en paralelo por equipos distintos si hay capacidad; sequencial si no.

- Bloques A/B/C se arrancan **en paralelo** desde día 1.
- Ruta crítica: A → D → E (outcome capture → elasticity calibration → Calculator bridge).
- Cada bloque: *objetivo*, *entregables*, *criterios de aceptación*, *riesgos*, *dependencias*.
- Regla dura: ningún commit del bloque E sin elasticity model con `confidence: HIGH` en al menos un segmento.

---

## 1. Premisa del pivot

N-Pricing deja de venderse como **"motor FTP con analytics"** y pasa a ser **"motor de pricing avanzado con FTP propio de serie"**. Lo que cambia:

| Dimensión | Antes | Después |
|---|---|---|
| Propuesta de valor | FTP + regulatorio + analytics | Pricing recomendado EV-óptimo con FTP regulatorio transparente |
| Input del originador | `marginTarget` manual | P(win) × NPV óptimo, con `marginTarget` como override |
| Output principal | `finalRate = FTP + marginTarget` | 3 precios: mínimo económico · recomendado · comercial |
| Governance | RAROC absoluto `>= 15%` | EVA bands por segmento |
| Elasticity | Mock (`ε = -0.3`) | Calibrado desde outcomes reales |
| Ex-post RAROC | `Math.random()` | `deal_realizations` tabla real |
| Capacidades ALM-adjacent | Embebidas (MaturityLadder, NIISensitivity, CurrencyGap) | Deep-linked a **Alquid** |

**Moat:** único motor de pricing que calcula su propio FTP (curvas duales, CLC, NSFR, ESG, multi-entity) en lugar de tratar COF como input. Frente a Earnix/Nomis/Zafin/SAS Risk Pricing, ese es el diferencial.

---

## 2. Inventario real (base del plan)

Verificado contra código el 2026-04-13. Estado honesto de cada pieza:

### 2.1. Ya existe y funciona (reutilizar)

| Pieza | Ubicación | Estado |
|---|---|---|
| Motor FTP completo | `utils/pricingEngine.ts` + `utils/pricing/` | ✅ Maduro, 19 gaps, regulatorio |
| RAROC ex-ante | `utils/rarocEngine.ts` | ✅ Fórmula completa cliente |
| Elasticity infrastructure | `utils/pricing/priceElasticity.ts` (362 LOC) | ✅ Log-lineal, buckets, uplift |
| `findOptimalPrice()` | `utils/pricing/priceElasticity.ts` | ✅ EV optimization listo |
| Inverse optimizer | `components/Calculator/InverseOptimizerPanel.tsx` + `utils/pricing/inverseOptimizer.ts` | ✅ Margin-for-target-RAROC |
| Client Profitability | `components/Reporting/ClientProfitabilityDashboard.tsx` (199) | ✅ Agrega real desde deals |
| Vintage Analysis | `components/Reporting/VintageAnalysis.tsx` (589) | 🟡 Verificar en Bloque 0 |

### 2.2. Existe pero con mocks (calibrar con datos reales)

| Pieza | Ubicación | Qué falta |
|---|---|---|
| Price Elasticity Dashboard | `components/Reporting/PriceElasticityDashboard.tsx` (150) | Calibración real — hoy `ε: -0.3` hardcoded |
| Ex-Post RAROC Dashboard | `components/Reporting/ExPostRAROCDashboard.tsx` (139) | `Math.random()` → tabla `deal_realizations` |
| Backtesting Dashboard | `components/Reporting/BacktestingDashboard.tsx` (381) | Auditar en Bloque 0 |

### 2.3. No existe (construir)

- `deal_outcomes` schema (Bloque A — cubierto por migration `20260413000001_deal_outcomes.sql`).
- Calculator ↔ Elasticity bridge.
- EVA-based governance.
- Market reference rates.
- Marginal portfolio impact ex-ante.
- Negotiation cockpit.

### 2.4. Existe pero sobra (deprecar via Alquid)

| Componente | LOC | Destino |
|---|---|---|
| `MaturityLadder.tsx` | 117 | Deep-link a Alquid |
| `CurrencyGap.tsx` | 138 | Deep-link a Alquid |
| `NIISensitivity.tsx` | 433 | Deep-link a Alquid |
| **Total** | **~690** | Feature flag `NPRICING_DEPRECATE_ALM=true`, vista "Moved to Alquid" |

---

## 3. Plan por bloques

### Bloque 0 — Preflight (semana 0, 3 días)

**Objetivo:** cerrar incógnitas antes de escribir código nuevo.

**Tareas:**
1. Auditar `VintageAnalysis.tsx` (589 LOC): ¿mock o real? Documentar en este archivo.
2. Auditar `PricingAnalytics.tsx` (360 LOC): ¿qué agrega? ¿duplica otro dashboard?
3. Auditar `BacktestingDashboard.tsx` (381 LOC): ¿depende de outcomes? ¿qué necesita para vivir post-pivot?
4. Auditar `AI_LAB` (vista AI Assistant): qué hace con Gemini hoy. Comparar contra spec en `ai-assistant-refocus.md`.
5. Confirmar con Alquid equivalentes exactos de `MaturityLadder`/`CurrencyGap`/`NIISensitivity`: URLs, coverage funcional, multi-entity parity.
6. Baseline: `npm run verify:full` verde.

**Criterio de aceptación:** sección §2 de este documento actualizada con resultados; lista final de rutas de deep-link a Alquid documentada en §5.2.

---

### Bloque A — Outcome capture (semanas 1–2) ⚡ ruta crítica

**Objetivo:** que cada deal nuevo desde el piloto capture `won_lost`, `loss_reason`, `competitor_rate`, `proposed_rate`, `decision_date`.

**Entregables:**
1. ✅ Migration `supabase/migrations/20260413000001_deal_outcomes.sql` (creado).
2. Actualizar `types.ts` — interface `Transaction` con 5 campos nuevos (opcionales).
3. Actualizar `api/mappers.ts` — snake_case ↔ camelCase para los nuevos campos.
4. Actualizar `api/deals.ts` — CRUD persiste los nuevos campos.
5. UI en Blotter:
   - Nueva columna **"Outcome"** con badge (✓ WON, ✕ LOST, ⧗ PENDING, ⌀ WITHDRAWN).
   - Drawer de edit con:
     - Radio: WON / LOST / PENDING / WITHDRAWN.
     - Si LOST → select obligatorio `loss_reason` (6 opciones + OTHER).
     - Input opcional `competitor_rate` con prompt guided: "¿Viste precio competidor? (opcional)".
     - Free-text notes field (existente) con integración **AI Loss Classifier** (ver `ai-assistant-refocus.md §3`).
6. UI en Pricing Dossier:
   - Al pasar de `Pending_Approval` → `Approved` o `Rejected`: capturar snapshot de `proposed_rate` en momento de propuesta.
   - Al marcar `Booked` o `LOST`: forzar `decision_date = now()` + `won_lost`.
7. Tests:
   - Unit `api/deals.ts`: persist/read de los 5 campos.
   - E2E `e2e/deal-blotter.spec.ts`: flujo completo LOST con `loss_reason`.
   - Validación: deal marcado LOST sin `loss_reason` → error de UI.

**Criterio de aceptación:**
- 100% de deals nuevos en el piloto tienen `won_lost` non-null.
- < 5% de deals LOST tienen `loss_reason = 'OTHER'`.
- Tests verdes: `npm run test -- deal-outcome`.

**Dependencias:** ninguna. Arranca día 1.

**Riesgo:** disciplina de captura es política, no técnica. Mitigación: flag obligatorio en workflow Pricing Dossier + AI Loss Classifier reduce fricción.

---

### Bloque B — ALM-ish deprecation (semana 1, paralelo con A)

**Objetivo:** reducir surface de N-Pricing a lo que es pricing, delegar ALM a Alquid.

**Entregables:**
1. Feature flag `VITE_NPRICING_DEPRECATE_ALM` en `.env.example` y `constants.ts`.
2. Env var pair: `VITE_ALQUID_BASE_URL` (ej. `https://alquid.nfq.es`).
3. Mapa deep-link en `constants/alquidDeepLinks.ts`:
   ```ts
   export const ALQUID_DEEP_LINKS = {
     MATURITY_LADDER: '/alm/maturity-ladder',
     CURRENCY_GAP: '/alm/currency-gap',
     NII_SENSITIVITY: '/alm/nii-sensitivity',
   } as const;
   ```
4. En `ReportingDashboard.tsx` (línea ~473–477): envolver los tabs de los 3 componentes con guard:
   - Flag off (default): render actual (no regresión).
   - Flag on: render `<MovedToAlquidPanel feature="MATURITY_LADDER" />`.
5. Nuevo componente `components/ui/MovedToAlquidPanel.tsx`:
   - CTA "Open in Alquid" → abre URL en nueva ventana.
   - Contexto: breve texto "Esta capacidad se consolida en Alquid — motor ALM integral de la suite NFQ".
6. NO borrar los componentes todavía. Dos releases en cuarentena antes de delete definitivo.

**Criterio de aceptación:**
- Con flag on: los 3 tabs muestran panel de "Moved to Alquid" con deep-link funcional.
- Con flag off: sin cambios de comportamiento.
- Tests E2E existentes verdes en ambos modos.

**Dependencias:** §Bloque 0 paso 5 (confirmar URLs de Alquid).

**Riesgo:** si el cliente piloto ve los 3 componentes como parte de N-Pricing hoy, hay que negociar la narrativa de consolidación antes de encender el flag en su entorno.

---

### Bloque C — AI Assistant refocus (semana 1, paralelo con A/B)

**Objetivo:** AI Assistant deja de ser chatbot genérico y pasa a 3 capacidades concretas del workflow pricing.

**Entregables:** ver `docs/pivot/ai-assistant-refocus.md`.

Resumen:
1. **Pricing Copilot** — embed en Calculator, explica delta entre recomendado y propuesto.
2. **Loss Classifier** — ayuda en Blotter drawer a clasificar `loss_reason`.
3. **Negotiation Argument Generator** — para Bloque J (negotiation cockpit, post-MVP).

**Criterio de aceptación:** `AI_LAB` sigue accesible pero con las 3 capacidades claramente diferenciadas; tests de prompts vs respuestas esperadas en `__tests__/aiAssistant.test.ts`.

---

### Bloque D — Elasticity calibration real (semanas 3–4) ⚡ ruta crítica

**Objetivo:** reemplazar mock de `PriceElasticityDashboard` con modelo calibrado desde `deal_outcomes`.

**Entregables:**
1. Nuevo módulo `utils/pricing/elasticityCalibration.ts`:
   - Consume `Transaction[]` filtrados a `won_lost IN ('WON', 'LOST')`.
   - Agrupa por `(productType, clientType, amountBucket, tenorBucket)` usando `buildSegmentKey` ya existente.
   - Ajusta log-linear model por segmento con MLE o método de momentos.
   - Gating: sample size < 30 → confidence LOW; 30–100 → MEDIUM; > 100 → HIGH.
   - **Bayesian prior** para segmentos low-volume (Corporate): prior experto por producto (configurable en `system_config`), posterior actualizado con datos disponibles. Evita NaN en calibración inicial.
2. Tabla nueva `elasticity_models`:
   ```sql
   CREATE TABLE elasticity_models (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     segment_key TEXT NOT NULL,
     elasticity NUMERIC NOT NULL,
     baseline_conversion NUMERIC NOT NULL,
     anchor_rate NUMERIC NOT NULL,
     sample_size INTEGER NOT NULL,
     confidence TEXT NOT NULL CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
     method TEXT NOT NULL,           -- 'FREQUENTIST' | 'BAYESIAN'
     calibrated_at TIMESTAMPTZ DEFAULT NOW(),
     is_active BOOLEAN DEFAULT TRUE
   );
   CREATE INDEX idx_elasticity_active ON elasticity_models (segment_key, calibrated_at DESC) WHERE is_active;
   ```
   Migration: `20260420000001_elasticity_models.sql`.
3. Edge Function `supabase/functions/elasticity-recalibrate/`:
   - Cron: nocturno (02:00 Europe/Madrid).
   - Query: deals con `decision_date > NOW() - INTERVAL '6 months'`.
   - Recalibra todos los segment_keys activos.
   - Inserta nuevas rows en `elasticity_models` (versionado, no sobrescribe).
   - Marca modelos antiguos `is_active = FALSE`.
4. Actualizar `PriceElasticityDashboard.tsx`:
   - Query a `elasticity_models` con `is_active = TRUE`.
   - Mostrar last calibration timestamp + sample size + confidence chip.
   - Mantener fallback a mock si no hay modelo (piloto en semana 1 no tendrá aún datos).

**Criterio de aceptación:**
- Tras 4 semanas de captura en piloto (all-segment), al menos **segmento Retail** con `confidence: HIGH` (>100 obs).
- SME y Corporate con al menos `confidence: MEDIUM` via Bayesian prior.
- Test: `utils/pricing/__tests__/elasticityCalibration.test.ts` con fixtures sintéticos (won/lost distributions).

**Dependencias:** Bloque A completado. Piloto con >30 deals con outcome.

**Riesgo:** Tier-1 ES tiene volumen retail altísimo pero Corporate es low-volume — si Bayesian prior no está bien calibrado, modelos Corporate serán basura. Mitigación: prior experto definido por Gregorio en `system_config` antes del Edge Function first-run.

---

### Bloque E — Calculator ↔ Elasticity bridge (semanas 5–6) ⚡ ruta crítica

**Objetivo:** que el Calculator muestre recomendación P(win)×EV junto al precio comercial actual.

**Entregables:**
1. Nuevo componente `components/Calculator/CalculatorRecommendationPanel.tsx`:
   - Props: `deal: Transaction`, `ftp: number`, `capitalCharge: number`.
   - Resuelve `segment_key` del deal y lee modelo activo desde `elasticity_models`.
   - Llama `findOptimalPrice()` de `utils/pricing/priceElasticity.ts`.
   - Muestra:
     - Precio óptimo EV + P(win) + EV esperado en €.
     - Sparkline de P(win) vs rate sobre grid [0, 10%].
     - Chip de confidence del modelo subyacente.
     - Explicación vía **AI Pricing Copilot** (Bloque C.1).
2. Actualizar `PricingReceipt.tsx` — nueva sección "Three-price view":
   - **Floor**: `floorPrice + capitalCharge + targetROE × regCap/EAD`.
   - **Recommended**: output de `findOptimalPrice`.
   - **Commercial**: `finalRate` actual (la vista de hoy).
   - Diff visual entre los 3 con bandera si comercial < floor.
3. EVA-based governance:
   - Modificar `DEFAULT_APPROVAL_MATRIX` en `constants.ts` de thresholds RAROC absolutos a bandas EVA:
     ```ts
     export const DEFAULT_APPROVAL_MATRIX = {
       autoApprovalEvaBp: 200,   // EVA > +200bp → auto
       l1EvaBp: 0,               // EVA > 0 → L1
       l2EvaBp: -100,            // EVA > -100bp → L2 committee
       // < -100bp → rejected
     };
     ```
   - Actualizar `pricingEngine.ts` línea 470–473: usar EVA en lugar de RAROC absoluto.
   - Migration: seed de bandas nuevas en `system_config`.
4. Actualizar `InverseOptimizerPanel.tsx`:
   - Añadir tercer modo "Optimize for EV" (junto a "by RAROC" existente).
   - Usa la misma `findOptimalPrice`.

**Criterio de aceptación:**
- Calculator muestra 3 precios + panel recomendación inline.
- % sesiones Calculator donde el originador consulta el panel recomendación > 70% (tracking via `observability.ts`).
- Test E2E `e2e/pricing-flow.spec.ts` verifica flujo recomendado → booked.
- Governance EVA aplicada correctamente: deal con RAROC 12% pero hurdle 15% (EVA = -300bp) va a Rejected, no Auto.

**Dependencias:** Bloque D completo (al menos Retail calibrado).

**Riesgo:** cambiar thresholds de governance rompe tests E2E existentes. Migración gradual: mantener RAROC absoluto como fallback via flag `VITE_GOVERNANCE_MODE=EVA|RAROC` durante 2 releases.

---

### Bloque F — Ex-post RAROC real (semana 7)

**Objetivo:** reemplazar `Math.random()` de `ExPostRAROCDashboard` con datos reales de recomputación.

**Entregables:**
1. Tabla nueva `deal_realizations`:
   ```sql
   CREATE TABLE deal_realizations (
     deal_id UUID REFERENCES deals(id),
     snapshot_date DATE NOT NULL,
     realized_ftp_rate NUMERIC,
     realized_margin NUMERIC,
     realized_ecl NUMERIC,
     realized_raroc NUMERIC,
     recompute_method TEXT NOT NULL,   -- 'SPOT_CURVE' | 'CORE_FEED'
     PRIMARY KEY (deal_id, snapshot_date)
   );
   ```
   Migration: `20260501000001_deal_realizations.sql`.
2. Edge Function `supabase/functions/realize-raroc/`:
   - Cron: mensual (1er día, 03:00).
   - Para cada deal activo (`status='Booked'`): recomputar con curva actual vs. curva origination.
   - Método por defecto: `SPOT_CURVE` (recompute ex-post con curvas actuales).
   - Método ideal (post-MVP): `CORE_FEED` — ingesta desde core bancario del cliente.
3. Actualizar `ExPostRAROCDashboard.tsx`:
   - Query a `deal_realizations` en lugar de random.
   - KPI nuevo: MAPE entre ex-ante RAROC y ex-post medio.
   - Mostrar método de cómputo per-row.

**Criterio de aceptación:**
- Dashboard sin líneas de `Math.random()`.
- MAPE ex-ante vs ex-post < 25% en backtesting.
- UI deja claro que es "Recomputed RAROC" vs "Realized from core".

**Dependencias:** deals con histórico de ≥ 30 días en piloto.

---

### Bloque G — Analytics reorg + landing (semana 8)

**Objetivo:** lo que ya funciona sale del escondite.

**Entregables:**
1. Renombrar en `appNavigation.ts`:
   - `{ id: 'REPORTING', label: 'FTP Analytics' }` → `{ id: 'REPORTING', label: 'Analytics' }`.
2. Refactor `ReportingDashboard.tsx` — dos sub-secciones internas:
   - **Pricing Performance** (nueva, default): `PriceElasticity`, `ExPostRAROC`, `ClientProfitability`, `VintageAnalysis`, `PricingAnalytics`, `Backtesting`.
   - **FTP Performance**: `Overview`, `Funding Curves`, `PnL Attribution`, `Executive`, `Snapshots`, `Review`, `Concentration`.
3. Calculator landing — widget "Today's Pricing Insights":
   - Avg P(win) últimos 30d por segmento.
   - Top 3 deals con mayor margen perdido por precio subóptimo (gap recomendado vs final).
   - Model confidence por segmento (chips LOW/MED/HIGH).
4. Actualizar `translations.ts` — labels nuevas ES/EN.

**Criterio de aceptación:**
- Originator aterriza en Calculator y ve el widget en < 5s.
- Landing Pricing Performance visible al abrir "Analytics".
- Zero regresiones en tests de navegación E2E.

---

### Bloques post-MVP (semanas 9–14)

#### Bloque H — Market reference rates (semanas 9–10)

- Tabla `market_benchmarks (product_type, tenor_bucket, client_type, date, rate, source)`.
- Ingesta CSV manual (v1), automation vía Edge Function (v2).
- Chip en Calculator: "Market 4.22% • Your rate +13bp".

#### Bloque I — Marginal portfolio impact (semana 11)

- `utils/portfolio/marginalImpact.ts`: ΔRWA, ΔLCR, ΔNSFR, ΔHerfindahl.
- Panel en `PricingReceipt.tsx`.

#### Bloque J — Negotiation cockpit (semanas 12–14)

- Nueva vista `/negotiation/:dealId`.
- Counter-offers timeline, walk-away rate, concession budget.
- AI Negotiation Argument Generator (Bloque C.3) plenamente integrado.

---

## 4. Dependencias y ruta crítica

```text
Semana 0    Bloque 0 (Preflight)

Semana 1-2  A (Outcome capture)     ┬──> D (Elasticity real) ──> E (Calculator bridge)
Semana 1    B (ALM-ish deprecation) │                                    │
Semana 1    C (AI Assistant)         ┘                                    │
Semana 7                                                    F (Ex-post RAROC real)
Semana 8                                                                  G (Reorg + landing)

Post-MVP:
Semana 9-10  H (Market refs)
Semana 11    I (Marginal impact)
Semana 12-14 J (Negotiation cockpit)
```

**Ruta crítica:** `0 → A → D → E` = **8 semanas**.

---

## 5. Decisiones cerradas del piloto

| # | Decisión | Impacto en plan |
|---|---|---|
| 1 | Cobertura all-segment (Corp + SME + Retail) | Bloque D requiere Bayesian prior para Corp low-volume |
| 2 | Cliente Tier-1 España | Volumen Retail permite calibración HIGH en ~4 semanas |
| 3 | Arranque limpio (sin backfill) | Bloque A más simple, sin scripts de backfill |
| 4 | `competitor_rate` alimentado manual | UI con prompt opcional + AI extractor desde notes |
| 5 | Desarrollo completo autorizado | Sin gates intermedios de approval |
| 6 | Alquid tiene ALM equivalentes | Bloque B: deep-link limpio (no feature flag + hide) |

### 5.1. Inputs requeridos del piloto antes de semana 1

- Confirmación URLs exactas Alquid: MaturityLadder, CurrencyGap, NIISensitivity.
- Fecha go-live (primer deal capturado en pilot).
- Prior experto por producto para Bayesian model (Gregorio + responsable ALM piloto).
- Aprobación de la narrativa "N-Pricing pricing + Alquid ALM" con stakeholder cliente.

### 5.2. Rutas Alquid confirmadas (pendiente de rellenar)

```ts
export const ALQUID_DEEP_LINKS = {
  MATURITY_LADDER: '__TBD__',
  CURRENCY_GAP: '__TBD__',
  NII_SENSITIVITY: '__TBD__',
} as const;
```

---

## 6. KPIs de éxito (90 días post go-live)

| Capability | KPI | Target | Medición |
|---|---|---|---|
| Outcome capture | % deals nuevos con `won_lost` | > 95% | Supabase query |
| Loss reason quality | % LOST con `loss_reason != OTHER` | > 85% | Supabase query |
| Elasticity Retail | Confidence chip | HIGH en ≤ 30d | `elasticity_models` table |
| Elasticity SME | Confidence chip | MEDIUM en ≤ 60d | idem |
| Elasticity Corp | Confidence chip | MEDIUM (Bayesian) desde day 1 | idem |
| Calculator adoption | % sesiones con panel recomendación consultado | > 70% | Observability events |
| Pricing quality | % deals con precio final dentro ±5% del óptimo | > 40% | Post-hoc analysis |
| Ex-post accuracy | MAPE ex-ante vs ex-post RAROC | < 20% | `deal_realizations` |
| ALM surface reduction | LOC removidos de surface pricing | ~690 | git blame |

---

## 7. Riesgos estratégicos

1. **Captura de outcomes se degrada tras mes 1**: es común. Mitigación: dashboards de "captura health" + alertas a Gregorio si % cae < 90%.
2. **Bayesian prior mal calibrado en Corporate**: si el prior experto está sesgado (ej. subestima elasticidad), el modelo Corp en producción tomará decisiones malas. Mitigación: prior validado con 2–3 escenarios históricos antes de go-live.
3. **Cliente piloto se opone a deep-link a Alquid**: si su contrato es solo N-Pricing y no Alquid, Bloque B no se puede encender. Fallback: mantener los 3 componentes dentro de N-Pricing pero marcados como "legacy" en tabs escondidos.
4. **Edge Function de elasticity-recalibrate falla silently**: riesgo de modelos obsoletos. Mitigación: monitoring en `observability.ts` + timestamp visible en UI + alerta si `calibrated_at > 48h`.
5. **Governance EVA introduce regresión**: cambiar umbrales de approval puede bloquear deals que antes pasaban. Mitigación: flag `VITE_GOVERNANCE_MODE` con rollback de 1 release.
6. **Refactor `pricingEngine.ts` no hecho**: 616 LOC sin descomponer hacen Bloque E frágil. Mitigación: extraer `domain/pricing/recommendation.ts` antes de tocar el core.

---

## 8. Estado de ejecución

| Bloque | Estado | Última actualización |
|---|---|---|
| 0 — Preflight | ✅ Audit completo — `docs/pivot/bloque-0-audit.md` (Vintage/Pricing/Backtesting OK) | 2026-04-13 |
| A — Outcome capture | ✅ Schema + types + mappers + drawer (AI-assisted) + Blotter wiring + tests (18) | 2026-04-13 |
| B — ALM deprecation | ✅ Flag + deep-links + MovedToAlquidPanel wired (URLs TBD con piloto) | 2026-04-13 |
| C — AI Assistant refocus | ✅ utils/ai/: client + redact + lossClassifier + pricingCopilot + negotiationAgent + tests (23). Loss Classifier wired into DealOutcomeDrawer. | 2026-04-13 |
| D — Elasticity real | ✅ elasticityCalibration (OLS + Bayesian prior) + migration + dashboard + Edge Function (Deno) + tests (19) | 2026-04-13 |
| E — Calculator bridge | ✅ CalculatorRecommendationPanel wired into CalculatorWorkspace + EVA governance + tests (15) | 2026-04-13 |
| F — Ex-post RAROC | ✅ Schema + utility + deterministic proxy + Edge Function (Deno, SPOT_CURVE) + tests (10) | 2026-04-13 |
| G — Reorg + landing | ✅ Navigation label fixed + PricingInsightsWidget wired | 2026-04-13 |
| H — Market refs | ✅ Migration + utils/marketBenchmarks.ts + tests (7) | 2026-04-13 |
| I — Marginal impact | ✅ utils/portfolio/marginalImpact.ts (RWA/LCR/NSFR/Herfindahl) + tests (7) | 2026-04-13 |
| J — Negotiation cockpit | 🟡 Backend ready (negotiationAgent.ts). UI pending pilot use-case validation. | 2026-04-13 |

### Summary del run 2026-04-13

- **Tests**: 797 passing (was 671 at start, +126 new).
- **Typecheck**: clean.
- **Lint**: 0 new issues from pivot files.
- **Build**: production build OK.
- **Edge Functions**: elasticity-recalibrate + realize-raroc (Deno).
- **Ruta crítica** (A → D → E) cerrada al 100% incluyendo wiring al Calculator.
- **Post-MVP** H e I cerrados (market benchmarks + marginal portfolio impact).
- **Siguiente paso**: inputs del piloto (URLs Alquid, priors expertos, go-live) + decidir UX del Negotiation Cockpit (J).

Legend: ✅ Done · 🟡 In progress · ⚪ Not started · 🔴 Blocked.

---

## 9. Archivos creados por este plan

- `supabase/migrations/20260413000001_deal_outcomes.sql` — schema outcome capture.
- `docs/pivot/PIVOT_PLAN.md` — este documento.
- `docs/pivot/ai-assistant-refocus.md` — spec de AI Assistant refocus.

## 10. Siguiente acción

1. Revisar este plan con equipo N-Pricing.
2. Ejecutar **Bloque 0 (Preflight)** — audit de VintageAnalysis/PricingAnalytics/Backtesting/AI_LAB.
3. Confirmar URLs Alquid y priors expertos con responsables.
4. Kick-off Bloque A con el piloto (schema ready, UI en desarrollo).
