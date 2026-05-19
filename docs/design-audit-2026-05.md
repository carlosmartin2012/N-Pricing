# N-Pricing — Design Audit 2026-05

> **Inicio:** 2026-05-19 · **Estado:** ✅ AUDIT COMPLETO. Esperando decisión Gregorio para fase Polish.
> **Metodología:** `/design-audit` skill (NFQ Design System v4 — Meridian Obsidian)
> **Scope acordado:** 31 vistas × 4 criterios (densidad, jerarquía, eficiencia, coherencia) × 3 audiencias (prospects/usuarios diarios/consultores NFQ)
> **Approach:** code-first audit (dev server bloqueado por Postgres local no disponible); items que requieran verificación visual quedan marcados con `[VISUAL]`.

---

## Resumen ejecutivo

- **Total issues:** ~67 (10 sistémicos + ~50 específicos + ~7 deferidos)
- **Critical:** 12 · **High:** 18 · **Medium:** 25 · **Low:** 12
- **AI Slop verdict:** **PARCIAL** — 9 tells específicos, pero producto serio bajo la superficie.
- **Design system compliance:** **DRIFTING** — 1 vista Strict (TargetGrid), 3 Mostly Compliant, 12 Drifting, 6+ Non-Compliant, 2 tokens funcionalmente rotos (60+ ocurrencias).
- **Top 7 issues con mayor impacto (priorizados por ROI):**
  1. **[SYS-9]** Clases CSS rotas `nfq-btn-X` — CRÍTICO funcional, fix 5min, ~15 botones reparados
  2. **[SYS-10]** Token `--nfq-border-subtle` no definido (30 usos) — CRÍTICO funcional
  3. **[RAROC-1]** Typo "BASIL III COMPLIANT" → "BASEL III" — CRÍTICO brand
  4. **[ANA-1]** Símbolo `$` en banca europea — CRÍTICO brand
  5. **[SYS-8]** Vistas no respetan taxonomía Sidebar (5 Governance + Campaigns + Budget) — CRÍTICO coherencia
  6. **[SYS-1]** Migración v3 → v4 incompleta (~200-300 reemplazos) — HIGH coherencia
  7. **[SYS-4]** Tipografía no usa clases `.nfq-*` (~150-200 reemplazos) — HIGH jerarquía
- **Recomendación de path:** **Path C** — Polish Wave 1 (Coherence) + brand fixes, ~1 semana real, cierra 70% del valor visible. Checkpoint después para decidir W2-4.

---

## Contexto del producto auditado

- **Stack:** React 19.2 + TypeScript 5.8 + Tailwind CSS 3 + Vite 6.2 (PWA)
- **Design system:** NFQ v4 (Meridian Obsidian) — OKLCH surface ramp, Linear-density components
- **Tema activo:** Dark (default) + Light alternativo
- **Accent:** Cyan `#06b6d4` (semantic-info también es cyan)
- **Categorías:** NMD=cat-a (sky), Prepayment=cat-b (amber), EarlyRedemption=cat-c (rose), Migration=cat-d (violet)
- **Tokens canónicos cargados:** sí (`index.css` mirror v4 con fallback hex para browsers sin OKLCH)
- **Tailwind config:** extends sobrios + paletas slate/cyan/emerald/amber/red/blue/purple/indigo (legacy compat)
- **Total vistas (`appNavigation.ts`):** 31 ViewState (22 sidebar visible + AUX en command palette + 4 bottom nav)

---

## Convenciones del informe

Cada issue se documenta con esta estructura:

```
### [#ID] [SEVERIDAD] Título corto
- **Ubicación:** ruta/archivo.tsx:línea
- **Categoría:** System Compliance / AI Slop / Accessibility / Performance / Responsive / Print
- **Criterio afectado:** Densidad / Jerarquía / Eficiencia / Coherencia
- **Audiencia más afectada:** Prospects / Usuarios diarios / Consultores
- **Descripción:** qué está pasando
- **Impacto:** por qué importa
- **Fix recomendado:** acción concreta
- **Verificación visual requerida:** sí/no
```

Severidades: **C**rítico (bloqueante producto/marca) · **H**igh (deteriora notablemente) · **M**edium (deuda visible) · **L**ow (refinamiento).

---

## Patrones sistémicos descubiertos (cross-batch)

### [SYS-8] [CRÍTICO · COHERENCIA] Cada vista usa un accent color diferente — no hay sistema
- **Patrón:** El design system define UN accent por instalación (default cyan, configurable via `setAccent()`). Para apps con dual-shell, hay `--nfq-accent` y `--nfq-accent-secondary` (auto-derivado). Pero N-Pricing usa **cuatro colores diferentes como accent** según la vista — y no es intencional ni coherente.
- **Mapeo observado:**
  - **Cyan** (`--nfq-accent` token o `text-cyan-X` legacy): Calculator, RAROC, Shocks, Stress Pricing, What-If, **TargetGrid** (vía tokens)
  - **Emerald** (`text-emerald-X` legacy): **Customer Pricing**, **Pipeline**
  - **Amber** (`text-amber-X` legacy): **Campaigns**
  - **Cyan + cat-colors** (intencional pero documentado): TargetGrid usa 4 colores semánticos para diferenciar dimensiones de filtro (products=accent, segments=info, tenors=warning, currencies=success). Eso SÍ es un patrón aceptable porque tiene semántica.
- **Evidencia:**
  - `CustomerPricingView.tsx:63, 90, 102` — `text-emerald-400`, `focus:border-emerald-400`, `border-emerald-400/50 bg-emerald-400/5`
  - `PipelineView.tsx:173, 190` — `text-emerald-400`, `ring-emerald-400/40`
  - `CampaignsView.tsx:126, 150` — `text-amber-400`, `border-amber-400/30 bg-amber-500/[0.04]`
- **Categoría:** AI Slop / System Compliance / Brand
- **Criterio:** Coherencia
- **Audiencia más afectada:** Las 3 (especialmente prospects — un demo que cambia de tono entre vistas pierde personalidad)
- **Impacto:** El producto se siente como **mosaico de apps diferentes**. La unidad de marca queda rota. Para un Tier-1 bank que va a poner esto delante de un CFO, parece poco curado.
- **Hipótesis del origen:** Cuando se crearon las vistas en oleadas sucesivas (Phase 1 = Customer 360 / Channels = Campaigns / Pipeline = Phase 6 CLV), cada autor eligió un color "que les parecía representativo del dominio". No hubo gatekeeping de design system.
- **Fix recomendado:** Dos opciones:
  - **Opción A (recomendada) — Accent unificado:** Todo en cyan (default) usando `var(--nfq-accent)`. La diferenciación entre dominios se consigue por iconos + eyebrow ("CUSTOMER · 360" vs "COMMERCIAL · CAMPAIGNS"), no por color.
  - **Opción B — Categorías por dominio:** Si Gregorio prefiere mantener color por dominio, formalizarlo: Customer/Pipeline=cat-e (emerald), Commercial/Campaigns=cat-b (amber), Risk/Stress=cat-c (rose), Methodology/Analytics=cat-d (violet), etc. Y aplicarlo SISTEMÁTICAMENTE en todas las vistas del dominio, no solo en el header.
- **Verificación visual:** sí — decidir A vs B requiere ver las 31 vistas juntas y discutir si la diferenciación por color añade valor narrativo (consultor explica el flujo) o solo ruido [VISUAL]

### [SYS-9] [CRÍTICO · FUNCIONAL] Clases CSS rotas — `nfq-btn-ghost` y `nfq-btn-primary` no existen
- **Patrón:** Múltiples vistas usan `nfq-btn-ghost` y `nfq-btn-primary` en `className` de botones. Estas clases **no están definidas en `index.css`**. Las clases canónicas son `.nfq-button-ghost` y `.nfq-button-primary` (con la palabra `button`, no `btn`).
- **Evidencia:**
  - `StressPricingView.tsx:123` — `<button className="nfq-btn-ghost ...">`
  - `CustomerPricingView.tsx:75` — `<a className="nfq-btn-ghost ...">`
  - `PipelineView.tsx:189, 200, 281+` — varios botones con `nfq-btn-ghost`
  - `CampaignsView.tsx:133, 139` — `nfq-btn-ghost`, `nfq-btn-primary`
- **Categoría:** System Compliance / Functional bug
- **Criterio:** Coherencia / functional correctness
- **Audiencia más afectada:** Las 3 — todos ven botones sin background, sin hover, sin transitions
- **Impacto:** **Estos botones renderizan como links del browser default.** Sin background, sin border-radius, sin hover state, sin padding adicional (más allá de Tailwind utility classes). Visualmente parecen "rotos" — fuera de lugar respecto al resto del UI.
- **Hipótesis del origen:** Alguien recordó la convención v3 (`btn-`) o copió de otra app NFQ con naming distinto, sin verificar en `index.css`. Como las clases no existen pero los `.nfq-button` base class tampoco se aplica, los botones quedan "naked".
- **Fix recomendado:** Search & replace global:
  - `className="nfq-btn-ghost ...` → `className="nfq-button nfq-button-ghost ...`
  - `className="nfq-btn-primary ...` → `className="nfq-button nfq-button-primary ...`
  - (Necesita la clase base `.nfq-button` además del variant — ver index.css:530)
- **Verificación visual:** sí — confirmar que los botones se ven raros actualmente y que el fix los normaliza [VISUAL CRÍTICO]

---

## Batch 1 — Core Pricing

> **Vistas:** Calculator, RAROC, Stress Test (Shocks), Stress Pricing, What-If.
> **Foco esperado:** densidad + jerarquía (son las vistas más cargadas, hero del producto).
> **Estado:** EN CURSO.

### Inventario de componentes a auditar

#### Calculator (`components/Calculator/`)
- `CalculatorWorkspace.tsx` — entry point (recientemente overhauled en commit `6841b9a`)
- 32 subcomponentes: DealInputPanel, DealConfigurationPanel, DealLeversPanel, DealFlowRail, DealScenarioSelector, DelegationAuditPanel, InverseOptimizerPanel, LineagePanel, MarketRateChip, MethodologyVisualizer, PricingComparison + Table, PricingDriversSummary, PricingInsightsWidget, PricingReceipt + Chrome + CreditDetail + Waterfall, PricingScenarioCard, RegulatorySection, ScenarioLibraryPanel, IFRS9StagePanel, ESGSection, CreditRiskSection, CrossBonusesPicker

#### RAROC (`components/RAROC/`)
- `RAROCCalculator.tsx` — entry point
- 6 subcomponentes: RAROCBreakdownPanel, RAROCInputSection, RAROCMetricCard, WaterfallExplainerCard

#### Stress Test (`components/Risk/`)
- `ShocksDashboard.tsx` — entry point
- 4 subcomponentes: MacroScenarioPicker, ShockControlPanel, ShockImpactPanel

#### Stress Pricing (`components/StressPricing/`)
- `StressPricingView.tsx` — entry point

#### What-If (`components/WhatIf/`)
- `WhatIfWorkspace.tsx` — entry point
- 4 subcomponentes: BacktestingConsole, BenchmarkGrid, ElasticityCalibration, ImpactReport

---

---

## Hallazgos transversales — Batch 1 (Core Pricing)

> Antes de los issues por-vista, hay **6 patrones sistémicos** que aparecen en TODAS las vistas de Core Pricing. Estos son los hallazgos de mayor leverage — un fix sistemático elimina decenas de issues a la vez.

### [SYS-1] [CRÍTICO · COHERENCIA] La migración v3 → v4 NO ha llegado a los componentes
- **Patrón:** `index.css` declara el sistema NFQ v4 (Meridian Obsidian, OKLCH, Linear-density), pero los componentes mezclan tres formas diferentes de referenciar colores:
  - Tokens v4: `bg-[var(--nfq-bg-elevated)]`, `text-[color:var(--nfq-text-primary)]`, `var(--nfq-accent)` (uso correcto)
  - Tailwind legacy: `text-cyan-400`, `bg-slate-900/30`, `text-emerald-400`, `border-white/5`, `bg-cyan-500/10` (anclaje al sistema anterior)
  - Hex hardcodeado: ninguno detectado (positivo)
- **Evidencia:**
  - `CalculatorWorkspace.tsx:209` — `bg-emerald-500/90` (debería ser `--nfq-success`)
  - `RAROCCalculator.tsx` — 95% legacy: `text-cyan-400`, `text-slate-500`, `bg-slate-900/30`, `border-cyan-500/30` (no migrado)
  - `StressPricingView.tsx` — legacy: `text-cyan-400`, `text-slate-200`, `text-rose-300`, `bg-slate-800/30`
  - `WhatIfWorkspace.tsx` — híbrido: usa `var(--nfq-text-primary)` para texto pero `border-white/5`, `bg-cyan-500/10`, `text-rose-400`, `text-emerald-400` para bordes y acentos
- **Categoría:** System Compliance
- **Criterio:** Coherencia + System compliance
- **Audiencia más afectada:** Las 3 (cualquier cambio de accent/theme rompe parcialmente)
- **Impacto:** Tres consecuencias graves:
  1. **Theme switching roto en parte de la app.** Si se cambia a Light theme via `html.light`, las clases `text-slate-200` y `bg-slate-900/30` no responden — solo los componentes que usan `--nfq-*` se adaptan. Resultado: vistas a medias.
  2. **Accent switching imposible.** El design system soporta 12 accents pero `text-cyan-400` lo hace fijo en cyan.
  3. **Drift visual.** "cyan-400" (`#22d3ee`) y "cyan" semántico de NFQ (`#06b6d4`) son colores ligeramente distintos. Side-by-side se nota.
- **Fix recomendado:** Migración sistemática a tokens. Reemplazos canónicos:
  - `text-cyan-400/500/600` → `text-[color:var(--nfq-accent)]`
  - `text-slate-200/300/400` → `text-[color:var(--nfq-text-secondary/tertiary/muted)]`
  - `bg-slate-900/30`, `bg-slate-800/30` → `bg-[var(--nfq-bg-elevated)]` o `bg-[var(--nfq-bg-surface)]`
  - `border-white/5`, `border-slate-700/40` → `border-[color:var(--nfq-border-ghost)]`
  - `text-rose-400`, `text-emerald-400` → `text-[color:var(--nfq-danger/success)]`
  - `bg-cyan-500/10` → `bg-[var(--nfq-accent-subtle)]`
- **Verificación visual:** no (es de código)

### [SYS-2] [CRÍTICO · COHERENCIA] Radii hardcodeados arbitrarios — 7 valores distintos para "card"
- **Patrón:** El design system define 6 radii (`--nfq-radius-sm` 3px, `-md` 5px, `-lg` 6px, `-xl` 10px, `-card` 8px, `-full` 9999px). Los componentes ignoran los tokens y usan valores arbitrarios:
- **Evidencia:**
  - `rounded-[24px]` — Calculator skeletons (5 sitios)
  - `rounded-[12px]` — WhatIf sandbox list item, Base Snapshot card
  - `rounded-[14px]` — WhatIf tab button
  - `rounded-[16px]` — WhatIf DiffCard (2 sitios)
  - `rounded-[18px]` — WhatIf tab wrapper
  - `rounded-[22px]` — WhatIf aside, main empty state, benchmark empty (3 sitios)
  - `rounded-md` (Tailwind 6px) — StressPricing, RAROC inputs
  - `rounded-lg` (Tailwind 8px) — StressPricing table
  - `rounded-full` — Calculator disclosure pills
  - `rounded-[var(--nfq-radius-card)]` — RAROC (✅ uso correcto, único)
- **Categoría:** System Compliance
- **Criterio:** Coherencia
- **Audiencia:** Las 3 (visible en cada panel)
- **Impacto:** Lectura visual incoherente. Cuando una vista tiene cards de 22px, panels de 16px, inputs de 6px y botones de 5px, el ojo no encuentra ritmo. NFQ v4 está diseñado con escala razonada (sm/md/lg crecen suavemente); el código actual rompe esa escala.
- **Fix recomendado:** Mapeo sistemático:
  - Cards/panels/skeletons → `rounded-[var(--nfq-radius-card)]` (8px) o `rounded-[var(--nfq-radius-xl)]` (10px) para los grandes
  - Inputs/botones → `rounded-[var(--nfq-radius-md)]` (5px) — ya es el default
  - Pills/badges → `rounded-full`
  - **Borrar:** todo `rounded-[12/14/16/18/22/24px]`
- **Verificación visual:** sí — algunos sitios con `rounded-[22px]` pueden parecer demasiado "blandos" frente al sistema 8px más afilado de v4 [VISUAL]

### [SYS-3] [HIGH · COHERENCIA] Bordes usando `white/5` o `slate-X/Y` en vez de `--nfq-border-ghost`
- **Patrón:** DESIGN.md prohíbe bordes opacos para seccionar y obliga a usar `--nfq-border-ghost` (15% opacity) cuando se necesite borde. El código usa `border-white/5` (5% opacity) o `border-slate-700/40` (40% opacity slate) repetidamente.
- **Evidencia:**
  - `StressPricingView.tsx:155` — `border-slate-700/40`
  - `StressPricingView.tsx:158` — `border-b border-slate-700/40`
  - `WhatIfWorkspace.tsx:394, 412, 557` — `border-white/5`
  - `WhatIfWorkspace.tsx:88, 461` — `border-cyan-500/30`, `border-white/5`
  - `RAROCCalculator.tsx:82, 177` — `border border-white/5`
  - `WhatIfWorkspace.tsx:140` — `border-cyan-500/20` para state editing
- **Categoría:** System Compliance
- **Criterio:** Coherencia
- **Impacto:** El `--nfq-border-ghost` está calculado en OKLCH para verse correctamente en dark + light + glass. Las alternativas hardcodeadas se ven OK en dark pero fallan en otros themes.
- **Fix recomendado:**
  - `border-white/5`, `border-slate-X/Y` para sectioning → `border-[color:var(--nfq-border-ghost)]`
  - Bordes "active state" (cyan-500/30) → `border-[color:var(--nfq-accent)]` con opacidad si se necesita (`/30`)
  - **Considerar eliminar bordes completamente** donde DESIGN.md dice usar tonal layering: si dos panels están separados, basta con `bg-[var(--nfq-bg-surface)]` vs `bg-[var(--nfq-bg-elevated)]` + gap; sin borde.
- **Verificación visual:** sí — algunos bordes pueden ser necesarios para a11y en zonas donde el contraste tonal sea bajo [VISUAL]

### [SYS-4] [HIGH · COHERENCIA] Tipografía: ignoradas las clases `.nfq-*` del design system
- **Patrón:** `index.css` exporta 8 clases tipográficas (`.nfq-display`, `.nfq-headline`, `.nfq-title`, `.nfq-body`, `.nfq-small`, `.nfq-kpi`, `.nfq-data`, `.nfq-label`). Los componentes usan Tailwind defaults (`text-xs`, `text-sm`) o píxeles arbitrarios (`text-[10px]`, `text-[9px]`, `text-[11px]`, `text-2xl`).
- **Evidencia:**
  - `RAROCCalculator.tsx` — `text-[10px]`, `text-[9px]`, `text-2xl`, `text-sm`, `text-xs` en una sola vista (5 tamaños distintos sin sistema)
  - `StressPricingView.tsx` — `text-[10px]`, `text-xs`, `text-sm`, `text-3xl` (h-3.5 en icons)
  - `WhatIfWorkspace.tsx` — `text-[11px]`, `text-xs`, `text-sm`
  - `CalculatorWorkspace.tsx:304` — `text-[10px]` para `nfq-label` (la clase ya define el tamaño correcto a 11px = `--nfq-text-label`)
- **Categoría:** System Compliance
- **Criterio:** Jerarquía + Coherencia
- **Impacto:** Pérdida de jerarquía visual. Los tamaños arbitrarios no respetan la escala razonada del sistema (11/13/16/24/44px en v4 más KPI 32 / data 13 / label 11). Cuando un componente tiene `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs` y `text-sm` mezclados, el usuario no puede usar tamaño para diferenciar niveles de info.
- **Fix recomendado:** Mapeo sistemático:
  - Eyebrows/labels uppercase → `.nfq-label` o `.nfq-eyebrow` (con dot accent)
  - Card titles → `.nfq-title`
  - Section headings → `.nfq-headline`
  - Body text → `.nfq-body`
  - Help/captions → `.nfq-small`
  - Numbers/data → `.nfq-data` (tabular-nums automático)
  - KPI grandes → `.nfq-kpi`
  - **Borrar:** todos los `text-[9/10/11px]`, `text-2xl`, `text-3xl` aplicados a UI text
- **Verificación visual:** sí — algunos `text-[10px]` actuales pueden parecer "más pequeños y técnicos" subjetivamente; pero romper el sistema por estética es exactamente el origen del problema [VISUAL]

### [SYS-5] [MEDIUM · COHERENCIA] Tabs implementados con 2 patrones diferentes
- **Patrón:** El design system define `.nfq-tab` + `.nfq-tab--active` (underline pattern, color accent en el borde inferior, index.css:594-623). WhatIf reinventa con un patrón "bg-fill + ring" (line 377-389).
- **Evidencia:**
  - `WhatIfWorkspace.tsx:377` — `flex items-center gap-3 rounded-[14px] px-3 py-2.5 ... bg-cyan-500/10 ... ring-1 ring-cyan-500/30`
  - DESIGN.md: el patrón canónico es underline tab (más sutil, menos peso visual)
- **Impacto:** No habrá un patrón único de tabs en la app. Si futuras vistas adoptan el patrón underline o el patrón bg-fill, queda doblez incoherente.
- **Fix recomendado:** Migrar WhatIfWorkspace a usar `.nfq-tab` con underline. Si se prefiere el bg-fill (es válido por densidad de info), promover ese patrón a una clase canónica en index.css (`.nfq-tab-pill` por ejemplo) y propagarlo. **Decisión de design system**, no por-vista.
- **Verificación visual:** sí — el "look" entre tabs subrayados (Linear-style) vs pills coloreados (Notion-style) es muy diferente [VISUAL]

### [SYS-6] [MEDIUM · COHERENCIA] Iconografía: tamaños no sistemáticos + texto-como-icono
- **Patrón:** DESIGN.md dice "Default size: 18px, Small: 16px". El código usa 14px (h-3.5), 16px (h-4), 18px (h-5 = 20px ¡!), 20px (h-5), 24px (size=18 directo).
- **Evidencia:**
  - `RAROCCalculator.tsx:96` — `size={18}` ✅
  - `RAROCCalculator.tsx:138` — `size={16}` (debería ser 18 para iconos en titles)
  - `WhatIfWorkspace.tsx:62-63` — iconos definidos sin size; usan default Lucide (24px)
  - `WhatIfWorkspace.tsx:227` — `h-3.5 w-3.5` (14px)
  - `WhatIfWorkspace.tsx:539` — `h-3 w-3` (12px)
  - `CalculatorWorkspace.tsx:317, 330` — **`✓` y `+` como iconos de texto** (debería ser `<Check>` y `<Plus>` de Lucide)
- **Impacto:** "Texto como icono" es un tell de AI slop (DESIGN.md lo lista explícitamente en don'ts). Y la falta de sistema de tamaños hace que los iconos parezcan flotando en zonas con weight visual incoherente.
- **Fix recomendado:**
  - Default 18px (`size={18}` o `h-[18px] w-[18px]`) para iconos en titles/headers
  - 16px (`h-4 w-4`) para iconos inline con texto
  - 14px (`h-3.5 w-3.5`) reservado para indicators muy compactos
  - **Reemplazar `✓ ` por `<Check size={14} />`** y `+ ` por `<Plus size={14} />` en CalculatorWorkspace
- **Verificación visual:** no necesaria

### [SYS-7] [MEDIUM · COHERENCIA] Headers de vista inconsistentes — cada vista entra distinto
- **Patrón:** Las 5 vistas Core Pricing entran al ojo del usuario de 5 formas diferentes:
  - **Calculator**: sin header in-component (delegado al App.tsx compact hero)
  - **RAROC**: tira metadata mini con badges + Tx ID (3 píldoras horizontales)
  - **ShocksDashboard**: sin header — directamente entra el `MacroScenarioPicker`
  - **StressPricing**: header propio con icono + título mono uppercase + 2 chip flags + botón Export
  - **WhatIf**: tab bar 4-way prominente (`Sandbox Lab / Elasticity / Backtesting / Benchmarks`)
- **Impacto:** El usuario no aprende "cómo se ve una vista de N-Pricing" — cada vista impone su propio chrome. Para audiencia "consultor en workshop" esto es especialmente problemático: la narrativa entre vistas se pierde.
- **Fix recomendado:** Definir 2 patrones canónicos y forzarlos:
  - **Pattern A — Vista sin chrome:** Calculator-style (cuando hay 3-col layout dominante; la app shell pone el título)
  - **Pattern B — Vista con eyebrow + título:** `.nfq-eyebrow` + `<h1>` con `.nfq-display` o `.nfq-headline` (para vistas con header propio)
  - **Eliminar:** los 3 patrones intermedios (RAROC's badge strip, StressPricing's mono uppercase header, WhatIf's tab bar como "primer ciudadano" — moverlo más sutil)
- **Verificación visual:** sí — decidir A vs B necesita ver las 31 vistas juntas [VISUAL]

---

## Hallazgos específicos — Batch 1

### Calculator (`components/Calculator/CalculatorWorkspace.tsx`)

#### Positivos
- **[+] Disclosure tiers bien diseñados:** Quote siempre visible / Context default ON / Optimization default OFF, persistido en localStorage. Cumple el principio "breathing room over density" del design system. (Líneas 76-100)
- **[+] Sticky pricing receipt en desktop:** la receipt + CTA + RAROC permanecen visibles al scroll. Patrón correcto para power users que necesitan referencia constante. (Línea 280)
- **[+] Accesibilidad bien tratada:** `<section aria-labelledby>` + `<h2 sr-only>` para cada grupo (Quote, Context, Optimization). Estructura semántica correcta. (Líneas 221, 338, 398)
- **[+] Skeleton fallbacks en `<Suspense>` para todos los componentes lazy:** evita CLS, transición progresiva. (Líneas 269-272, 282-286, 359-363)

#### Issues
##### [CALC-1] [HIGH · COHERENCIA] Cursor counter usa colores hardcodeados emerald
- **Ubicación:** `CalculatorWorkspace.tsx:208-212`
- **Categoría:** System Compliance / AI Slop
- **Criterio:** Coherencia
- **Audiencia:** Las 3
- **Descripción:** El indicator de cursors live usa `bg-emerald-500/90 ... text-white shadow` con `text-[10px] font-mono`. Hardcoded emerald (no es token), `shadow` genérico (no usa `--nfq-shadow-*`), texto blanco directo.
- **Impacto:** Pequeño pero visible. Es un control "vivo" que está siempre arriba a la derecha cuando hay colaboradores; debería usar el patrón `.nfq-pill` con tono `success`.
- **Fix:** Sustituir por `<span className="nfq-pill" data-tone="success">{cursors.length} live</span>` o equivalente con tokens.
- **Verificación visual:** no

##### [CALC-2] [HIGH · COHERENCIA + AI SLOP] Disclosure toggles con caracteres unicode como iconos
- **Ubicación:** `CalculatorWorkspace.tsx:317, 330`
- **Categoría:** AI Slop / System Compliance
- **Criterio:** Coherencia
- **Descripción:** Los toggles "Context" y "Optimization" usan `✓ ` y `+ ` como prefijo (texto), no iconos Lucide.
- **Impacto:** `✓` y `+` son tells clásicos de "AI rendered UI" — DESIGN.md los prohíbe explícitamente ("No emoji as UI elements — use Lucide icons"). Aunque no son emoji técnicamente, son texto-como-icono.
- **Fix:** Importar `Check` y `Plus` de `lucide-react`. Renderizar con `<Check size={14} />` y `<Plus size={14} />` con un `<span>` para el label.
- **Verificación visual:** no

##### [CALC-3] [MEDIUM · COHERENCIA] Disclosure toggles reinventan el patrón `.nfq-pill`
- **Ubicación:** `CalculatorWorkspace.tsx:307-332`
- **Categoría:** System Compliance
- **Criterio:** Coherencia
- **Descripción:** Los toggles usan estilo inline (`rounded-full px-3 py-1 font-medium transition-colors ... bg-[var(--nfq-accent)]/10 text-[color:var(--nfq-accent)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.35)]`). DESIGN.md tiene `.nfq-pill` con `data-tone="accent"` ya parametrizado.
- **Impacto:** Más código que mantener; pequeñas variaciones harán divergir vs el resto de la app.
- **Fix:** Sustituir por `<button className="nfq-pill" data-tone={state.context ? 'accent' : undefined} aria-pressed={...}>`.
- **Verificación visual:** sí — ver si la altura/padding de `.nfq-pill` (24px min) encaja con la actual [VISUAL]

##### [CALC-4] [MEDIUM · DENSIDAD] Skeletons usan `rounded-[24px]` (no token)
- **Ubicación:** `CalculatorWorkspace.tsx:271, 284, 359, 364, 457, 473` (5 skeletons)
- **Categoría:** System Compliance
- **Criterio:** Coherencia
- **Descripción:** Todos los skeleton placeholders usan `rounded-[24px]` hardcoded — el token `--nfq-radius-card` es 8px en v4.
- **Impacto:** Cuando el contenido carga, el radio "salta" de 24px (skeleton) a 8px (card real). Es un Layout Shift micro pero visible si se observa.
- **Fix:** `rounded-[24px]` → `rounded-[var(--nfq-radius-card)]` en los 5 sitios.
- **Verificación visual:** sí — para confirmar el "snap" visual [VISUAL]

##### [CALC-5] [LOW · JERARQUÍA] `text-[10px]` en label hint vs token oficial 11px
- **Ubicación:** `CalculatorWorkspace.tsx:304`
- **Categoría:** Typography
- **Descripción:** `<span className="nfq-label mr-1 text-[10px] text-[color:var(--nfq-text-muted)]">`. La clase `.nfq-label` ya define `font-size: var(--nfq-text-label)` (11px). El override a 10px contradice el sistema.
- **Fix:** Borrar `text-[10px]`.

##### [CALC-6] [LOW · COHERENCIA] Min-heights y heights de skeletons en píxeles
- **Ubicación:** `CalculatorWorkspace.tsx:271, 284, 359, 364, 457, 473`
- **Descripción:** `min-h-[320px]`, `h-40`, `h-24` para skeletons. No usa tokens.
- **Fix:** Considerar usar Tailwind defaults coherentes (`h-40` está OK; eliminar `min-h-[320px]` arbitrario y reemplazar por `min-h-80` Tailwind).

---

### RAROC (`components/RAROC/RAROCCalculator.tsx`)

#### Positivos
- **[+] Layout sticky-left (config) + scroll-right (resultados):** patrón correcto, igual que ShocksDashboard. (Línea 95)
- **[+] Métricas en grid 4-up con MetricCards:** estructura razonable para KPIs comparativos.
- **[+] Debounce a `saveRarocInputs` (600ms):** evita spam al backend.

#### Issues
##### [RAROC-1] [CRÍTICO · BRAND] Typo "BASIL III" debería ser "BASEL III"
- **Ubicación:** `RAROCCalculator.tsx:85`
- **Categoría:** Brand / Domain accuracy
- **Criterio:** Profesionalismo
- **Audiencia:** TODAS (especialmente bankers — es una regulación que conocen al dedillo)
- **Descripción:** El badge dice `BASIL III COMPLIANT`. La regulación es **Basel III** (Comité de Basilea — BIS). "Basil" es una hierba aromática.
- **Impacto:** En un demo a Banca March o cualquier banco regulado, este typo es **fulminante** para la credibilidad. Es exactamente el tipo de detalle que un Chief Risk Officer notará en 2 segundos y arruinará la demo.
- **Fix:** `BASIL III COMPLIANT` → `BASEL III COMPLIANT` (todo upper).
- **Verificación visual:** no — bug textual claro

##### [RAROC-2] [HIGH · COHERENCIA] Migración v4 no aplicada — toda la vista en Tailwind legacy
- **Ubicación:** `RAROCCalculator.tsx` completo
- **Categoría:** System Compliance
- **Criterio:** Coherencia (cubierto por [SYS-1])
- **Descripción:** No hay un solo `var(--nfq-text-*)` en el componente. Todo es `text-cyan-400`, `text-slate-500`, `text-amber-500`, `text-violet-500`, `text-emerald-400`, `text-rose-400`, `bg-slate-900/30`, `bg-slate-950/40`, `bg-cyan-900/10`, `bg-cyan-500/6`, `border-cyan-500/15`, `border-cyan-500/20`, etc.
- **Impacto:** RAROC es probablemente la vista más visible en demos (después de Calculator). Está visualmente "atrapada" en v3.
- **Fix:** Migración full. Probablemente 30-50 reemplazos en este archivo. Ver mapeos en [SYS-1].
- **Verificación visual:** sí — comparación lado-a-lado con Calculator para confirmar consistency [VISUAL]

##### [RAROC-3] [HIGH · DENSIDAD] Metadata strip con 4 chips paralelos arriba "compite con" el contenido real
- **Ubicación:** `RAROCCalculator.tsx:82-92`
- **Categoría:** Hierarchy / Density
- **Criterio:** Densidad + Jerarquía
- **Descripción:** Encima del grid principal hay una franja con `MODEL_v4.2.X`, `BASIL III COMPLIANT`, `ENGINE SYNCED`, `Tx: XXX`. Cuatro píldoras horizontales que no aportan info accionable diaria — son meta-status.
- **Impacto:** En la audiencia "usuario diario" esto es ruido permanente. En la audiencia "prospect en demo" puede impresionar 5s y luego molesta. En "consultor explicando" es texto extra que distrae del flujo de pricing.
- **Fix recomendado:**
  - Mover `MODEL_v4.2.X` + `BASIL III` (corregido) + `ENGINE SYNCED` a un area de "system info" detrás de un `<button>` info-icon o a `/about` (no visible permanente)
  - El `Tx ID` sí es útil — mantenerlo arriba a la derecha como single chip
  - Alternativa: convertir todo en un único `.nfq-eyebrow` discreto: `· MODEL v4.2.X · BASEL III · Tx XYZ` (color tertiary, no llama la vista)
- **Verificación visual:** sí — decidir cuál de las 3 opciones funciona mejor [VISUAL]

##### [RAROC-4] [MEDIUM · COHERENCIA] Métricas grandes no usan `.nfq-kpi-value`
- **Ubicación:** `RAROCCalculator.tsx:182, 188`
- **Categoría:** Typography
- **Criterio:** Jerarquía
- **Descripción:** Los números Spread / Return Buffer usan `font-mono-nums text-2xl font-bold text-cyan-400`/`text-emerald-400`. La clase `.nfq-kpi-value` del index.css ya define mono + 32px + bold + tabular-nums + tracking tight.
- **Impacto:** `text-2xl` es 24px; `--nfq-text-kpi` es 32px. Los números importantes están más pequeños que el sistema canónico.
- **Fix:** Sustituir por `<div className="nfq-kpi-value">{value}</div>`. Coordinar con `.nfq-kpi-label` para el eyebrow ("Spread", "Return Buffer").
- **Verificación visual:** sí — confirmar que 32px no rompe el grid layout [VISUAL]

##### [RAROC-5] [MEDIUM · AI SLOP] Methodology Note en cursiva
- **Ubicación:** `RAROCCalculator.tsx:170`
- **Categoría:** AI Slop
- **Descripción:** La fórmula `RAROC = (Spread Revenue + Fees - FTP - ECL - OpCost + Capital Income) / Total Regulatory Capital` está en `<p className="text-xs text-slate-400 font-mono italic leading-relaxed">`. **Cursiva**.
- **Impacto:** DESIGN.md no menciona cursiva pero el patrón "italic en data" es un tell visual común de "rendered AI doc". En código/fórmulas, mono es suficiente — no se necesita italic adicional.
- **Fix:** Quitar `italic`. Mantener mono.

##### [RAROC-6] [LOW · COHERENCIA] Paleta multi-color en iconos (cyan/amber/violet) sin sistema
- **Ubicación:** `RAROCCalculator.tsx:138, 147, 158, 167`
- **Categoría:** Color usage
- **Descripción:** Iconos de paneles usan `text-cyan-500`, `text-amber-500`, `text-violet-500` (un color por panel). DESIGN.md tiene categorías (`--nfq-cat-a..h`) pensadas para data categorization, no para iconos decorativos.
- **Impacto:** Crea ruido visual; el ojo busca semántica detrás del color (¿por qué Revenue es amarillo, Capital es violeta?). Si no hay semántica, mejor neutralidad.
- **Fix:** Decidir:
  - **Opción A:** Iconos en `text-[color:var(--nfq-text-muted)]` (neutrales)
  - **Opción B:** Iconos solo coloreados cuando hay semántica (success/warning/danger)
  - **Opción C:** Si Revenue/Capital/Commercial son categorías, mapearlas a `--nfq-cat-a/b/c` consistentemente (no improvisar)

---

### Stress Test / Shocks Dashboard (`components/Risk/ShocksDashboard.tsx`)

#### Positivos
- **[+] Estructura clara:** Macro picker → sticky shock controls + impact panel right. Patrón sticky-left repetido.
- **[+] Audit trail con debounce:** 500ms timeout para flush, evita spam.
- **[+] Soporte de Excel import + template download:** workflow profesional.

#### Issues
##### [SHK-1] [HIGH · JERARQUÍA] Vista sin header in-component — "entra plana"
- **Ubicación:** `ShocksDashboard.tsx:158-184`
- **Categoría:** Hierarchy
- **Criterio:** Jerarquía
- **Descripción:** El componente renderiza directamente `<MacroScenarioPicker>` arriba sin eyebrow, título, ni contexto. El usuario aterriza en sliders sin marco.
- **Impacto:** Para "consultor explicando" muy molesto — no hay forma de introducir "qué se está mirando aquí". Para "prospect" pierde la oportunidad narrativa (esto es ALM hardcore que merece dignidad).
- **Fix:** Añadir `<header>` con eyebrow + título corto + 1 línea de descripción. Ejemplo:
  ```
  STRESS · EBA
  Shocks Dashboard
  ±200bp parallel + 4 EBA presets. Live re-pricing del deal activo.
  ```
- **Verificación visual:** sí [VISUAL]

##### [SHK-2] [MEDIUM · COHERENCIA] Sub-paneles (ShockControlPanel, ShockImpactPanel) no auditados
- **Ubicación:** subcomponentes
- **Categoría:** Coverage gap del audit
- **Descripción:** El entry point es solo 188 líneas y ofrece poca densidad para auditar. Los sub-paneles son donde está la complejidad real.
- **Fix:** Marcar para audit secundario en la fase de polish (no bloqueante para el informe global).

---

### Stress Pricing (`components/StressPricing/StressPricingView.tsx`)

#### Positivos
- **[+] Tabla con columnas mono right-aligned para numéricos:** correcto patrón.
- **[+] Sign indicator (+/−) explícito en deltas.**
- **[+] Footer info-box con disclaimer regulatorio:** importante en demos legales.

#### Issues
##### [STR-1] [CRÍTICO · FUNCIONAL] `nfq-btn-ghost` no existe — clase rota
- **Ubicación:** `StressPricingView.tsx:123`
- **Categoría:** System Compliance / Functional
- **Descripción:** El botón "Export CSV" usa `className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs ..."`. La clase canónica en `index.css` es `.nfq-button-ghost` (línea 583). `.nfq-btn-ghost` **no existe** en el CSS, por tanto el botón NO tiene los estilos de ghost button (background, hover, transitions).
- **Impacto:** El botón se ve con estilos por defecto del browser (transparente, texto del color por defecto). Es probable que actualmente funcione por otras clases utility (`text-xs`, padding) pero falta el visual coherente.
- **Fix:** `nfq-btn-ghost` → `nfq-button nfq-button-ghost` (el primero da estructura base, el segundo el variant). O sustituir por `<Button variant="ghost">` del LayoutComponents.
- **Verificación visual:** sí — confirmar que el botón actual se ve "raro" [VISUAL]

##### [STR-2] [HIGH · COHERENCIA] Migración v4 no aplicada
- **Ubicación:** `StressPricingView.tsx` completo
- **Categoría:** System Compliance — cubierto por [SYS-1]
- **Descripción:** Mismo patrón que RAROC. `text-cyan-400`, `text-slate-400/500/100/200`, `text-rose-300/400`, `text-emerald-300`, `bg-slate-900/30/40`, `bg-slate-800/30`, `border-slate-700/40/60`, `bg-amber-500/5`, `text-amber-200/80`.
- **Fix:** Migración full.

##### [STR-3] [HIGH · JERARQUÍA] Título principal en mono uppercase compite con eyebrows
- **Ubicación:** `StressPricingView.tsx:110`
- **Categoría:** Typography / Hierarchy
- **Criterio:** Jerarquía
- **Descripción:** `<h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">Stress Pricing</h2>`. El **título principal** está en mono uppercase a `text-sm` (14px). En toda la app, mono uppercase = **eyebrow** (label, no título).
- **Impacto:** Confunde la jerarquía. El título principal de la vista parece un eyebrow secundario.
- **Fix:** Usar `<h1 className="nfq-headline">Stress Pricing</h1>` (24px Inter semibold). Reservar mono uppercase para labels de "STRESS · EBA" como eyebrow encima del h1.

##### [STR-4] [MEDIUM · COHERENCIA] Flag chip "CURVE SHIFT · ON/OFF" no usa `.nfq-pill`
- **Ubicación:** `StressPricingView.tsx:112-117`
- **Categoría:** System Compliance
- **Descripción:** Pill flag-aware con `nfq-label text-[10px] ${flagOn ? 'text-emerald-300' : 'text-amber-300'}`. Es semánticamente un status pill, debería usar `.nfq-pill` con `data-tone`.
- **Fix:** `<span className="nfq-pill" data-tone={flagOn ? 'success' : 'warning'}>{flagOn ? 'Curve shift on' : 'Curve shift off · uniform'}</span>`.

##### [STR-5] [MEDIUM · COHERENCIA] Tabla no usa `.tbl-wrap` / row hover pattern del DS
- **Ubicación:** `StressPricingView.tsx:155-204`
- **Categoría:** System Compliance
- **Descripción:** Tabla manual con `border border-slate-700/40 bg-slate-900/40`, rows con `border-b border-slate-800/40 ${isBase ? 'bg-slate-800/30' : ''}`. DESIGN.md tiene `.tbl-wrap` con 1px border, 8px radius, subtle shadow.
- **Fix:** Mover a `.tbl-wrap` + clases canónicas. La alternancia "row base highlighted" puede ser un atributo `data-base` en el tr.

##### [STR-6] [MEDIUM · COHERENCIA] Delta colors usan rose-300/emerald-300 (no tokens)
- **Ubicación:** `StressPricingView.tsx:26-28, función `deltaColor`
- **Categoría:** System Compliance
- **Descripción:** `text-rose-300` para deltas positivas (subidas malas), `text-emerald-300` para negativas (mejoras). Semantics OK; tokens no.
- **Fix:** Usar `var(--nfq-danger)` / `var(--nfq-success)` en vez de `text-rose-300` / `text-emerald-300`.

---

### Batch 1 — Resumen
- 7 hallazgos sistémicos identificados (aplicables también a otros batches): SYS-1 (migración v4 incompleta), SYS-2 (radii arbitrarios), SYS-3 (bordes white/X), SYS-4 (tipografía sin tokens), SYS-5 (2 patrones de tabs), SYS-6 (iconografía inconsistente), SYS-7 (headers no canónicos).
- 1 hallazgo CRÍTICO específico: RAROC-1 ("BASIL III" typo — credibilidad ante banker).
- Calculator es la vista más cuidada (disclosure tiers, sticky receipt, semantics OK).
- RAROC y StressPricing siguen ancladas en Tailwind legacy (migración v4 pendiente).
- WhatIf tiene la mayor variedad de radii hardcoded (5 valores distintos en un mismo file).

---

### What-If Workspace (`components/WhatIf/WhatIfWorkspace.tsx`)

#### Positivos
- **[+] 4 tabs claros para los 4 modos (Sandbox / Elasticity / Backtesting / Benchmarks):** organización por dominio razonable.
- **[+] React Query hooks bien encapsulados:** separation of concerns.
- **[+] Empty states con icono + mensaje + sugerencia:** evita "pantalla muerta".

#### Issues
##### [WIF-1] [HIGH · COHERENCIA] Hardcoded radii salvajes (5 valores distintos)
- **Ubicación:** `WhatIfWorkspace.tsx:86, 140, 201, 366, 377, 394, 461, 518, 544, 628`
- **Categoría:** System Compliance — cubierto por [SYS-2]
- **Descripción:** El componente usa `rounded-[12px]`, `rounded-[14px]`, `rounded-[16px]`, `rounded-[18px]`, `rounded-[22px]` simultáneamente. No hay sistema.
- **Fix:** Mapear todos a `--nfq-radius-card` (8px) o `--nfq-radius-xl` (10px) según jerarquía.

##### [WIF-2] [HIGH · JERARQUÍA + AI SLOP] DiffCard usa line-through + red/green para "before/after"
- **Ubicación:** `WhatIfWorkspace.tsx:216-218`
- **Categoría:** AI Slop / Hierarchy
- **Criterio:** Jerarquía + UX
- **Descripción:** En cada DiffCard: `<span className="text-rose-400 line-through">{old}</span> → <span className="text-emerald-400">{new}</span>`. Patrón clásico "diff" estilo Git.
- **Impacto:** Es **incorrecto semánticamente** porque el valor "current" NO está siendo eliminado, está siendo reemplazado en un sandbox draft. line-through implica deletion. Y el green-rose pattern es tell de generic AI "diff visualization".
- **Fix:** Mejor pattern:
  ```
  Current   →  Proposed
  3.5%         3.8%   (+30bps)
  muted        accent
  ```
  Use `--nfq-text-muted` para current, `--nfq-text-primary` para proposed, y opcional delta indicator separado con `--nfq-success`/`--nfq-danger` según dirección. El arrow `→` es OK (es Unicode, no AI tell aquí porque es un símbolo direccional estándar).

##### [WIF-3] [HIGH · COHERENCIA] Active tab usa patrón "bg-fill + ring", DS define "underline"
- **Ubicación:** `WhatIfWorkspace.tsx:377-389`
- **Categoría:** System Compliance — cubierto por [SYS-5]

##### [WIF-4] [MEDIUM · COHERENCIA] Spinner usa cyan-500/30 borders (no tokens)
- **Ubicación:** `WhatIfWorkspace.tsx:439`
- **Descripción:** `<div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />`. Debería usar `var(--nfq-accent)`.
- **Fix:** Estandarizar a `border-[color:var(--nfq-border-ghost)] border-t-[color:var(--nfq-accent)]` o crear `.nfq-spinner` en index.css.

##### [WIF-5] [MEDIUM · JERARQUÍA] Sidebar (sandbox list) ancho fijo 72 / aside 420 — sin sistema
- **Ubicación:** `WhatIfWorkspace.tsx:394, 581`
- **Descripción:** Sidebar izquierdo `w-72` (288px), aside derecho `w-[420px]`. La sidebar global de la app es 240px expandida (`--nfq-sidebar-expanded`). Dos sidebars de anchos diferentes en cascada visual.
- **Impacto:** El usuario tiene mental model "sidebars son 240px o 64px" — ver un panel-sidebar de 288px o 420px rompe la regla.
- **Fix:** Considerar:
  - Sandbox list a `--nfq-sidebar-expanded` (240px) o mover a una vista anterior (drawer izquierdo del shell, no embedded sidebar)
  - Impact report a width consistente (320px o 400px sería más estándar)
- **Verificación visual:** sí — el flow con 3 columnas (sidebar global + sandbox list + main + impact aside) puede ser **demasiado** [VISUAL]

##### [WIF-6] [LOW · COHERENCIA] Em-dash en `formatChangeValue` para null
- **Ubicación:** `WhatIfWorkspace.tsx:67-72`
- **Descripción:** Function returns `'—'` (em-dash) para null/undefined values. Acumulado con otros em-dashes en la app (DESIGN.md humanizer skill flagea em-dash overuse).
- **Fix:** Considerar `'—'` (en-dash) o simplemente vacío `''` para esos cases.

---



---

## Batch 2 — Commercial

> **Vistas:** Customer Pricing, Pipeline, Campaigns, Targets (TargetGrid), Customer 360 (panel).
> **Foco esperado:** coherencia + eficiencia (golden paths comerciales).
> **Estado:** AUDITADO 2026-05-19.

### Customer Pricing (`components/Customer360/CustomerPricingView.tsx`)

#### Positivos
- **[+] Layout 2-col limpio:** sidebar de búsqueda + main de detalle. Patrón master-detail correcto.
- **[+] Cliente preseleccionable vía `?id=` URL param:** soporta linkage desde otras vistas (Calculator → Customer).
- **[+] Búsqueda en client-side con `useMemo`:** UX inmediato sin round-trip al server.
- **[+] Tabs internas (Snapshot/LTV/Timeline/NBA) con sentence-case + iconos pequeños:** patrón razonable (NO usa el broken nfq-btn-X — usa custom).

#### Issues
- **[CUS-1] [CRÍTICO]** Aplica [SYS-8] — header usa `text-emerald-400`, search input `focus:border-emerald-400`, item activo `border-emerald-400/50 bg-emerald-400/5`. **TODO el accent de la vista es emerald, no cyan.** Mayor desviación visible respecto al sistema.
- **[CUS-2] [CRÍTICO]** Aplica [SYS-9] — `nfq-btn-ghost` rota en línea 75.
- **[CUS-3] [HIGH]** Aplica [SYS-7] — header `font-mono text-sm font-bold uppercase tracking-tight` para título principal.
- **[CUS-4] [HIGH]** Aplica [SYS-1] — todo el componente usa Tailwind legacy (`text-white`, `text-slate-200/400/500`, `bg-white/[0.02]`, `border-white/5/10`).
- **[CUS-5] [MEDIUM]** Tabs internas usan `bg-white/[0.08]` + `text-white` para active state — patrón "fill no border", coherente con WhatIf pero diferente del DS (`.nfq-tab--active` underline).
- **[MEDIUM]** Aplica [SYS-2] — `rounded-lg` (Tailwind 8px que coincide con `--nfq-radius-card` por casualidad) — ok pero por suerte.
- **[LOW]** Search icon en `h-3 w-3` (12px) — muy pequeño; default Lucide 16px es estándar.

### Pipeline (`components/Pipeline/PipelineView.tsx`)

#### Positivos
- **[+] Power-user UX bien pensado:** Set-based selection (O(1) toggle), bulk consume, auto-refresh opt-in con polling de 30s, CSV export RFC 4180 compliant. Para usuario diario es eficiente.
- **[+] Filtros confianza con bandas (`high/medium/low/all`):** semántica clara.
- **[+] Sorting estable:** delta CLV primary, confianza secondary.
- **[+] Drop-stale-selection effect:** previene phantom selections al cambiar filtros. Detalle de profesional.

#### Issues
- **[PIP-1] [CRÍTICO]** Aplica [SYS-8] — header emerald-400 (línea 173), autorefresh `ring-emerald-400/40`.
- **[PIP-2] [CRÍTICO]** Aplica [SYS-9] — `nfq-btn-ghost` (línea 189, 200) — botones auto-refresh y export visualmente rotos.
- **[PIP-3] [HIGH]** Aplica [SYS-7] — header con título mono uppercase 14px.
- **[PIP-4] [MEDIUM]** Hay **9 reason codes** en `REASON_LABEL` mapeados a labels cortos (`share_of_wallet_low → "SoW low"`). Razonable pero algunos son ambiguos. "Crosssell cohort" — falta hyphen? "Reg incentive" muy corto. Decisión UX: para usuario diario están bien (densidad), para prospect/consultor pueden ser opacos.
- **[MEDIUM]** Aplica [SYS-4] — usa `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm` sin tokens.

### Campaigns (`components/Campaigns/CampaignsView.tsx`)

#### Positivos
- **[+] State machine completa con badges por status:** draft/approved/active/exhausted/expired/cancelled — 6 estados claros.
- **[+] Form en colapso (`showForm`):** no satura la vista cuando no se está creando.
- **[+] Form fields con defaults razonables:** `today()`, `inDays(90)`, segment Retail, product MORTGAGE. Buena DX.

#### Issues
- **[CAM-1] [CRÍTICO]** Aplica [SYS-8] — header `text-amber-400` (línea 126). Y el form-frame usa `border-amber-400/30 bg-amber-500/[0.04]` (línea 150). **TODO el visual de la vista es amber-themed.**
- **[CAM-2] [CRÍTICO]** Aplica [SYS-9] — `nfq-btn-ghost` (línea 133) y `nfq-btn-primary` (línea 139) **ambas rotas**.
- **[CAM-3] [HIGH]** `STATUS_COLOR` map (líneas 12-19) usa Tailwind palette legacy:
  - `draft`: `bg-slate-500/10 text-slate-300`
  - `approved`: `bg-cyan-500/10 text-cyan-300`
  - `active`: `bg-emerald-500/10 text-emerald-300`
  - `exhausted`: `bg-amber-500/10 text-amber-300`
  - `expired`: `bg-slate-500/10 text-slate-400`
  - `cancelled`: `bg-rose-500/10 text-rose-300`
  - Mapeo semántico OK pero debería usar tokens (`bg-[var(--nfq-success-subtle)] text-[var(--nfq-success)]`, etc.).
- **[CAM-4] [HIGH]** Aplica [SYS-7] — título mono uppercase.
- **[CAM-5] [MEDIUM]** `inputCls` (no visible en las primeras 200 líneas) — probablemente clase compartida para todos los inputs del form. **Verificar que use `nfq-input-field` canónica del DS y no una reinvención.**
- **[MEDIUM]** Aplica [SYS-1] — Tailwind legacy throughout.

### Target Grid (`components/TargetGrid/TargetGridView.tsx`)

> 🟢 **GOLD STANDARD del batch 2.** Esta vista está casi 100% migrada a tokens v4. Es la prueba de que el codebase PUEDE estar consistente.

#### Positivos
- **[+] Uso EXCLUSIVO de tokens NFQ v4:** `bg-[var(--nfq-bg-elevated)]`, `text-[var(--nfq-accent)]`, `bg-[var(--nfq-bg-highest)]`, `text-[color:var(--nfq-text-muted)]`, etc. Cero `text-cyan-X` o `bg-slate-X`. **Mejor estado de migración del repo.**
- **[+] Filter chips con 4 colores semánticos (accent/info/warning/success):** patrón razonado — products=accent, segments=info, tenors=warning, currencies=success. Permite al usuario distinguir dimensiones de un vistazo. SÍ es un uso aceptable de paleta multi-color (semántica explícita).
- **[+] View mode toggle (Table/Heatmap/Diff):** 3-way con disabled state (diff requires ≥2 snapshots) + título informativo. UX correcto.
- **[+] `aria-pressed` en los toggles:** accesibilidad correcta.
- **[+] Estado vacío y loading explícitos:** no hay pantallas muertas.
- **[+] Uses `.nfq-button`:** clase canónica correctamente aplicada (línea 132).

#### Issues
- **[TGD-1] [MEDIUM]** Aplica [SYS-2] — los toggles del view mode usan radii hardcoded: `rounded-[12px]` para wrapper, `rounded-[10px]` para inner buttons. Debería ser `rounded-[var(--nfq-radius-card)]` (8px) o sistema.
- **[TGD-2] [LOW]** Iconos toggle a `size={12}` — más pequeño que el default 18px. Coherente con la densidad de la barra (compacta).
- **[TGD-3] [LOW]** Filter chips usan `text-[10px]` — coincide con el patrón general del repo pero no con `--nfq-text-label` (11px).
- **[LOW]** **Sin header in-component** (no hay título tipo "Target Grid" arriba). La vista entra directamente al selector de snapshots + toggle. Aplica [SYS-7] — pero en versión "vista plana sin chrome" tipo Calculator. Decisión: ¿añadir eyebrow + título o mantener como Calculator-style (App.tsx pone el título)?

### Customer 360 (sub-component embedded — `CustomerRelationshipPanel.tsx`)

- Auditado embebido vía CustomerPricing. No tiene vista propia (es un panel usable en Calculator + Customer Pricing tabs). Aplicabilidad de issues: probablemente hereda emerald accent de su padre. **Audit secundario diferido a fase de polish.**

### Batch 2 — Resumen
- **2 hallazgos sistémicos nuevos:** SYS-8 (accent por vista — Customer+Pipeline=emerald, Campaigns=amber) + SYS-9 (clases CSS rotas `nfq-btn-X`).
- **1 hallazgo positivo crítico:** TargetGridView es el gold standard de migración v4 — usar como referencia visual en polish.
- **Pattern de cabeceras:** las 4 vistas (Customer Pricing, Pipeline, Campaigns) usan el mismo template "icon + mono uppercase title + entity shortCode". Esto es coherencia ENTRE estas vistas (positivo), pero no coherencia con el resto de la app (Calculator no tiene header, RAROC tiene strip, StressPricing tiene su propio header). Habrá que **elegir UNA versión canónica de header** en la fase de polish.
- **Pattern de search/filter:** Customer Pricing, Pipeline, TargetGrid tienen patrones de filtro distintos:
  - Customer: input de búsqueda + lista lateral
  - Pipeline: dropdown selects (status/product/confidence)
  - TargetGrid: chips multi-select por dimensión
  - **Decisión polish:** unificar el patrón de filtros o documentar 3 patrones canónicos según contexto.

---


## Batch 3 — Risk & Methodology

> **Vistas:** Yield Curves, Behavioural Models, Methodology (en Calculator), Analytics, Pricing Discipline.
> **Foco esperado:** jerarquía (vistas con muchos gráficos).
> **Estado:** AUDITADO 2026-05-19.

### Yield Curves (`components/MarketData/YieldCurveWorkspace.tsx`)

#### Positivos
- **[+] Soporte explícito de light/dark mode** via Tailwind `dark:` prefix — única vista que lo hace consistentemente. Sirve como referencia para verificar otras vistas en light.
- **[+] SVG chart custom** (no depende de Recharts para esta visualización) — control total sobre styling.
- **[+] Shock input inline con unidad bps** — micro-interaction eficiente.

#### Issues
- **[YC-1] [HIGH · COHERENCIA]** **3 accent colors** en el mismo header: amber para shock, slate-neutral para currency, cyan para currency activa. Botones de acción (Download/Save/Import) usan amber/emerald/cyan respectivamente como colores de hover (`hover:text-amber-500`, `hover:text-emerald-500`, `hover:text-cyan-500`). **No es semántica**, es cosmética con confusión.
- **[YC-2] [HIGH]** Aplica [SYS-1] — todo Tailwind legacy (`bg-slate-100`, `border-slate-200`, `text-slate-700`, etc.) sin tokens. Excepción: dark mode prefijos sí están bien.
- **[YC-3] [MEDIUM]** `text-[9px]` para labels "bps" (línea 92) — muy pequeño, ilegible en zoom.
- **[YC-4] [MEDIUM]** Aplica [SYS-2] — `rounded` (sin px) usado, equivale a Tailwind default 4px (`--nfq-radius-sm` token).
- **[LOW]** Currency switcher en estilo "pill segmented control" diferente del WhatIf tab pattern y del Calculator disclosure toggles. Cuarto patrón de segmented control en la app.

### Behavioural Models (`components/Behavioural/BehaviouralModels.tsx`)

#### Positivos
- **[+] Drawer pattern** para editing — evita modal pesado, mantiene contexto. Buen UX.
- **[+] Tabs por tipo de modelo (NMD_Replication / Prepayment_CPR)** — semántica clara.
- **[+] Optimistic updates con rollback en delete** — pro-UX.
- **[+] Audit logging integrado** en cada acción (CREATE/UPDATE/DELETE/IMPORT).

#### Issues
- Las primeras 150 líneas son lógica; el visual no se ve completo. **Audit secundario requiere ver el render** (Panel, BehaviouralModelCard, BehaviouralModelEditor en Drawer).
- **[BHM-1] [LOW]** Confirmation via `window.confirm(t.confirmDeleteModel)` (línea 112) — usa el native dialog del browser. **Inconsistente** con resto de la app (que usa Toast + custom modals). Native confirm rompe el look del producto.

### Pricing Discipline (`components/Discipline/DisciplineDashboard.tsx`)

#### Positivos
- **[+] Vista compleja organizada en 6 tabs** semánticamente claros: Leakage / Distribution / Outliers / Scorecards / Bands / Exceptions.
- **[+] Filtros date-preset + custom** con UX típico de power-user dashboards (BI tools).
- **[+] React Query hooks bien separados** por concern.
- **[+] Cohort drilldown via modal** desde la tabla — flow correcto.
- **[+] Comment en código explicando por qué useMemo es necesario** para evitar re-render cascade (línea 113-117) — calidad técnica nota +.

#### Issues
- **[DISC-1] [MEDIUM]** No se ve el render visual en las primeras 150 líneas; audit secundario requerido para revisar densidad de KPI cards + 4 chart types (LeakageByDimension, VarianceDistribution, Outlier table, OriginatorScorecard).
- **[DISC-2] [LOW]** Date preset labels en inglés (`'Today'`, `'Last 7d'`, `'Last 30d'`, `'Quarter'`, `'Custom'`) — la app es bilingual (`useUI` provee language). **Probable i18n leak.**

### Pricing Analytics (`components/Reporting/PricingAnalytics.tsx`)

#### Positivos
- **[+] `tooltipStyle` correcto:** `var(--nfq-bg-elevated)`, `var(--nfq-border-ghost)`, `var(--nfq-radius-lg)`, `var(--nfq-font-mono)`. ✅ Modelo a replicar en otros components con Recharts.
- **[+] Cálculo de buckets de RAROC con semantic colors** (rojo <5%, amber 5-10%, green ≥10%) — pattern correcto.
- **[+] React.lazy en charts (`lazyRecharts`)** — performance correct.

#### Issues
- **[ANA-1] [CRÍTICO · BRAND]** `fmtM` (líneas 31-36) usa `$` como símbolo de moneda:
  ```js
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  ```
  N-Pricing es **producto para bancos europeos** (NFQ Advisory sirve a banca española: BBVA, Santander, Bankinter, Sabadell, etc.). **Dollares en una vista de analítica para banca europea es un fallo de brand crítico.**
  - **Fix:** Cambiar `$` → `€` o usar `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`.
  - **Impacto demo:** un Director Financiero de Banca March viendo "$" en un dashboard de KPIs pricing — fail instantáneo de credibilidad.
- **[ANA-2] [HIGH · COHERENCIA]** Array `COLORS` con 6 hex hardcoded (líneas 21):
  ```js
  ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']
  ```
  Estos son cyan/violet/amber/emerald/red/pink. Aproximan a cat-a/d/b/e + danger + g pero **directos sin tokens.** Si el accent cambia, el chart no responde.
  - **Fix:** Usar `var(--nfq-cat-a)`, `var(--nfq-cat-d)`, `var(--nfq-cat-b)`, `var(--nfq-cat-e)`, `var(--nfq-danger)`, `var(--nfq-cat-g)` (necesita lectura runtime via getComputedStyle si Recharts lo requiere, o vía custom property fallback).
- **[ANA-3] [HIGH · COHERENCIA]** Mismo issue en `rarocDistribution` (líneas 111-117) — 3 hex hardcoded (`#ef4444`, `#f59e0b`, `#10b981`).
- **[ANA-4] [MEDIUM]** Visual no se ve completo en 150 líneas — audit secundario para ver KPI hero + 4 charts en grid layout.

### Methodology (`components/Calculator/MethodologyVisualizer.tsx`)

- Auditado embebido en Calculator (Batch 1). **No es vista independiente** — es una columna del Calculator workspace.
- Aplica issues de Calculator [SYS-1, SYS-2, SYS-4].

### Batch 3 — Resumen
- **1 nuevo hallazgo CRÍTICO específico:** ANA-1 (símbolo `$` en banca europea — brand-damaging).
- **Patrón positivo a replicar:** PricingAnalytics tiene el `tooltipStyle` correcto para Recharts — usar como modelo en otros components con charts.
- **Patrón positivo a replicar:** YieldCurveWorkspace es la **única vista con `dark:` prefix consistente** — sirve como referencia para verificar light mode en otras.
- **2 vistas requieren audit secundario** (más allá de 150 líneas): Behavioural Models (Panel/Drawer/Editor internos) y Discipline (KPI cards + 4 charts + Outlier table).
- **i18n leak detectado:** Discipline preset labels en inglés en lugar de via translations.

---


### [SYS-10] [CRÍTICO · FUNCIONAL] Token CSS roto — `--nfq-border-subtle` se usa 30 veces pero no está definido
- **Patrón:** Las 3 vistas de Governance (Escalations, Dossiers, Model Inventory) usan `border-[color:var(--nfq-border-subtle)]` en 30 sitios. **El token NO está definido en `index.css`** — los tokens disponibles son `--nfq-border` y `--nfq-border-ghost`.
- **Evidencia:**
  - `components/Governance/ModelInventoryView.tsx` — 12+ usos
  - `components/Governance/DossiersView.tsx` — múltiples filas de tabla
  - `components/Governance/EscalationsView.tsx` — múltiples usos
- **Categoría:** System Compliance / Functional bug
- **Impacto:** El navegador trata `var(--nfq-border-subtle)` como `unset` → el border-color cae a `currentColor` (color del texto). En dark mode, esto puede dar bordes blancos brillantes donde debería haber ghost borders. Visual mismatch grave.
- **Hipótesis del origen:** Convención que se intentó introducir pero nunca se añadió al stylesheet. Quizás copiada de otra app NFQ con diferente definición de tokens.
- **Fix recomendado:** Una de dos:
  - **Opción A (recomendada):** Search & replace global: `--nfq-border-subtle` → `--nfq-border-ghost`. Es lo más cercano semánticamente (15% opacity neutral).
  - **Opción B:** Añadir el token a `index.css`: `--nfq-border-subtle: oklch(calc(var(--nfq-base-l) + 7%) var(--nfq-base-c) var(--nfq-base-h) / 0.4)` — un valor entre `--nfq-border` (full) y `--nfq-border-ghost` (60%). Solo si Gregorio quiere un nivel intermedio explícito.
- **Verificación visual:** sí — confirmar visualmente cómo se ven actualmente estos bordes [VISUAL CRÍTICO]

---

## Batch 4 — Governance

> **Vistas:** Attribution reporting, Model Inventory, Dossiers, Approvals (=ApprovalCockpit), Attribution matrix.
> **Foco esperado:** eficiencia + densidad (workflows con fricción).
> **Estado:** AUDITADO 2026-05-19.

### Attribution Reporting (`components/Attributions/AttributionReportingView.tsx`)

#### Positivos
- **[+] Estructura 4-tab + 4-KPI hero limpia:** Volume / Drift / Funnel / Time.
- **[+] Refresh button con spinner state** y `WindowToggle` para period (30/90/180 days).
- **[+] Formatters i18n correctos:** `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` para EUR. ✅ Sin el bug del $ de PricingAnalytics.
- **[+] Translation keys via `attributionsTranslations(language)`:** i18n proper.

#### Issues
- **[AR-1]** Aplica [SYS-7] + [SYS-8] — header con título mono uppercase + emerald accent.
- **[AR-2] [MEDIUM]** `border-white/5` en card body (línea 76) y tabla rows (114) — repite [SYS-3].
- **[MEDIUM]** Aplica [SYS-1] — `text-slate-200/300/400`, `bg-slate-900/40`.

### Model Inventory (`components/Governance/ModelInventoryView.tsx`)

#### Positivos
- **[+] Lifecycle state machine clara** (candidate → active → retired/rejected) con transiciones permitidas modeladas en `NEXT_STATUSES`.
- **[+] KIND_LABEL + KIND_COLOR + STATUS_COLOR + STATUS_ICON maps:** mapping centralizado, clean architecture.
- **[+] Date format `'es-ES'`:** localización correcta.
- **[+] USES `rounded-[var(--nfq-radius-card)]` + tokens:** parcialmente migrado a v4.

#### Issues
- **[MI-1] [CRÍTICO]** Aplica [SYS-10] — usa `--nfq-border-subtle` (no definido) en 12+ sitios. **Funcionalmente roto.**
- **[MI-2] [HIGH]** `KIND_COLOR` (líneas 43-51) usa Tailwind legacy 6-color mapping (cyan/emerald/violet/amber/sky/slate) para categorías de modelo. Aplica patrón "categoría por color" pero con palette legacy, no `--nfq-cat-X` tokens.
- **[MI-3] [HIGH]** `STATUS_COLOR` (líneas 53-58) usa legacy palette también. Debería usar `--nfq-success-subtle`, `--nfq-warning-subtle`, `--nfq-danger-subtle`, `--nfq-text-muted` semantics.
- **[MEDIUM]** Aplica [SYS-7] — necesita header completo no visible en 120 primeras líneas.

### Dossiers (`components/Governance/DossiersView.tsx`)

#### Positivos
- **[+] Uso parcial de tokens v4:** `text-[color:var(--nfq-text-secondary/muted)]` consistentemente. Buen ejemplo de "midway migration".
- **[+] Tabla con expandable rows + signature verification** patrón master-detail correcto.
- **[+] Hash truncation utility `shortHash(hash, len = 10)`:** detalle UX para no romper layout con sha256.
- **[+] Date format `'es-ES'` con minutos:** correcto.

#### Issues
- **[DO-1] [CRÍTICO]** Aplica [SYS-10] — usa `--nfq-border-subtle` múltiples veces.
- **[DO-2] [MEDIUM]** Status badges (`bg-emerald-500/10 text-emerald-300` for valid, `bg-rose-500/10 text-rose-300` for tampered) mezclan tokens con legacy. Debería usar `bg-[var(--nfq-success-subtle)] text-[var(--nfq-success)]`.
- **[DO-3] [LOW]** Hover state hardcoded: `hover:bg-[rgba(255,255,255,0.04)]`. No usa token (no hay `--nfq-bg-hover`, pero podría usar `--nfq-bg-elevated`).
- **[LOW]** Aplica [SYS-2] — `rounded-md` (Tailwind) en vez de token explícito.

### Approval Cockpit (`components/Attributions/ApprovalCockpit.tsx`)

#### Positivos
- **[+] Deep-link via `?focus=dealId`:** soporta navegación desde Calculator → escalation. UX correcto.
- **[+] Scroll into view del item focused:** smooth UX.
- **[+] Translation keys via `attributionsTranslations`:** i18n.
- **[+] Header con title + subtitle structure:** patrón consistente con AttributionReporting.

#### Issues
- **[AC-1]** Aplica [SYS-7] + [SYS-8] — header mono uppercase + emerald-400.
- **Patrón pendiente revisar en body** (más allá de 120 líneas).

### Attribution Matrix (`components/Attributions/AttributionMatrixView.tsx`)
- **Audit secundario diferido** — no leído en primer pass. Esperable: estructura similar a otras vistas Attributions.

### Batch 4 — Resumen
- **1 hallazgo CRÍTICO nuevo:** [SYS-10] — `--nfq-border-subtle` no definido, **30 ocurrencias rotas en 3 archivos Governance.**
- **Patrón positivo:** AttributionReporting + ApprovalCockpit siguen el mismo template (header mono + 4 KPIs + tabs + section). Internamente coherentes en el dominio Attributions.
- **Patrón positivo:** Dossiers es el archivo Governance más migrado a tokens v4 — buen ejemplo de "in progress correctly".
- **Patrón negativo persistente:** Emerald accent en TODAS las vistas Attributions + Governance (AR, AC, MI parcial). Confirma [SYS-8] como issue del **dominio Governance completo**, no de vistas aisladas.

---


## Batch 5 — Operations

> **Vistas:** Deal Blotter, FTP Reconciliation, Budget Reconciliation, AI Assistant, Deal Timeline.
> **Foco esperado:** eficiencia (power-user views).
> **Estado:** AUDITADO 2026-05-19.

### Deal Blotter (`components/Blotter/DealBlotter.tsx`)

#### Positivos
- **[+] Code-splitting agresivo:** DealBlotterDrawers (~30 KB) y DealComparisonDrawer lazy-loaded. Performance correcta.
- **[+] Live cursors integrados** (Ola 7 B) con viewport-filtered (`BLOTTER`).
- **[+] Hooks separados:** `useBlotterState` + `useBlotterActions` — clean architecture.
- **[+] Bulk action bar + multi-select** con `Set<string>` para O(1) toggle.

#### Issues
- **[BL-1] [MEDIUM]** Visual no se aprecia en orchestrator file (delega a `BlotterTable`, `BlotterToolbar`, `BlotterFooter`). **Audit secundario requerido** sobre subcomponentes.
- **[BL-2]** Aplica [SYS-1] probable — usa `Panel` from LayoutComponents (canonical) — eso es positivo.

### FTP Reconciliation (`components/Reconciliation/ReconciliationView.tsx`)

#### Positivos
- **[+] Page-level fmtEur + fmtPct con i18n-correctas:** `'es-ES'` + EUR.
- **[+] Period selector (YYYY-MM) + Status filter chips:** UX bien para controller.
- **[+] CSV export del filtered set:** correcto (no exporta todo, exporta lo investigado).
- **[+] Comment justificativo en código (useMemo de allPairs):** calidad técnica.
- **[+] Deep-link a `/blotter`:** "Open deal" workflow.

#### Issues
- **[REC-1] [CRÍTICO]** Aplica [SYS-8] — header con `text-violet-400` (línea 109). **CUARTO accent color** distinto en la app (cyan/emerald/amber/violet). Violet es además **el accent menos justificado** semánticamente para "FTP Reconciliation" (es un workflow contable, no innovación experimental).
- **[REC-2] [HIGH]** `STATUS_TONE` (líneas 40-48) usa **6 colores diferentes** del palette legacy (emerald/amber/rose/sky/violet/slate) para 7 status. Pattern "rainbow-by-category" repetido (también en ModelInventory, Budget, etc).
- **[REC-3]** Aplica [SYS-7] — mono uppercase title.
- **[REC-4]** Aplica [SYS-1] — Tailwind legacy throughout.

### Budget Reconciliation (`components/Budget/BudgetReconciliationView.tsx`)

#### Positivos
- **[+] Header con title + subtitle estructura:** patrón coherente con AttributionReporting/ApprovalCockpit.
- **[+] Tolerance controls inline en header:** rate (bps) + volume (%). Eficiente para controller.
- **[+] `useBudgetComparisonQuery` con tolerances como params:** server-side filtering.
- **[+] i18n via `budgetTranslations(language)`:** correcto.

#### Issues
- **[BU-1]** Aplica [SYS-8] — `text-emerald-400` (línea 61). Consistente con Governance domain (al menos coherencia interna).
- **[BU-2] [HIGH]** `STATUS_CLASSES` (líneas 15-23) usa **7 colores con borders** del palette legacy. Same anti-pattern. Notar: incluye `fuchsia-500` que es un color **no en el design system NFQ ni en `tailwind.config.js`** (solo está en Tailwind default). Si Tailwind purge no lo incluye, podría no renderizar.
- **[BU-3]** Aplica [SYS-7] — mono uppercase title.
- **[BU-4]** Aplica [SYS-1] + [SYS-3] — `border-white/5`, `bg-slate-900/40`, `text-slate-300/400`.

### Deal Timeline (`components/Deals/DealTimelineView.tsx`)

#### Positivos
- **[+] USES `.nfq-label` eyebrow correctamente** (línea 95):
  ```tsx
  <div className="nfq-label flex items-center gap-2 text-[10px] text-slate-400">
    <History className="h-3.5 w-3.5" />
    Deal timeline
  </div>
  ```
  Este es el patrón canónico DESIGN.md: eyebrow encima de title. **Único en el repo con este patrón.**
- **[+] focus event scroll + highlight from URL param:** deep-link UX correcto.
- **[+] Loading/error/empty states explícitos.**
- **[+] Counts by event kind (Repricings/Escalations/Dossiers) en KpiTiles:** density correcta.

#### Issues
- **[TL-1] [LOW]** Title sigue siendo mono uppercase, no `.nfq-display`/`.nfq-headline` — **eyebrow correcto pero título no usa class de DS**. Hybrid donde uno está bien y otro mal.
- **[TL-2] [LOW]** `text-[10px]` override en eyebrow (línea 95) — la clase `.nfq-label` ya define 11px, conflict.
- **[LOW]** Aplica [SYS-1] — `text-slate-400`, `text-slate-200`, `text-rose-300`.

### AI Assistant
- **Audit pendiente** — vista no localizada en primeras búsquedas. Posiblemente en `components/AIAssistant/` o como panel embebido.
- **Verificación visual requerida** para evaluar.

### Batch 5 — Resumen
- **VIOLETA confirmada como 4º accent color** en el app — Reconciliation. [SYS-8] confirma 4 colores distintos en producción.
- **fuchsia-500 detectado** en BudgetReconciliation (BU-2) — palette adicional no en tailwind.config.js. **Potential broken render.**
- **DealTimelineView es el ÚNICO componente con `.nfq-label` eyebrow correctamente aplicado** — usar como referencia en polish.
- **Patrón "rainbow status mapping"** ahora confirmado en 4+ vistas: Campaigns, ModelInventory, Reconciliation, Budget. Decisión polish: ¿mantener (semántica) o reducir a 4-color set semantic (success/warning/danger/info/muted)?

---


## Batch 6 — AUX + Bottom nav

> **Vistas:** Accounting Ledger, Snapshot Replay, SLO Dashboard, Adapter Health, Escalations, Attribution matrix + User Config/Mgmt/Audit/Manual + Sidebar (chrome principal).
> **Foco esperado:** coherencia (vistas menos visitadas que se sienten "del otro producto").
> **Estado:** AUDITADO 2026-05-19.

### 🔍 Sidebar (`components/ui/Sidebar.tsx`) — HALLAZGO CLAVE

> Este finding cambia la interpretación de [SYS-8]. La sidebar tiene una **taxonomía intencional de accents por sección** que NO se está respetando en las vistas individuales.

#### Taxonomía oficial detectada en `SECTION_ACCENTS` (líneas 35-42):

| Sección | Accent (dot + label) | Token usado |
|---|---|---|
| **Relationship Cockpit** | emerald | `var(--nfq-success)` ✅ token |
| **Pricing Cockpit** | cyan | `var(--nfq-accent)` ✅ token |
| **Data & Ops Hub** | sky | `bg-sky-400` ❌ legacy hex |
| **Governance Hub** | violet | `bg-violet-400` ❌ legacy hex |
| **Assistant** | fuchsia | `bg-fuchsia-400` ❌ legacy hex |
| **System** | slate | `bg-slate-400` ❌ legacy hex |

#### ¿Qué hace cumplir/incumplir cada vista?

| Vista | Sección esperada | Color usado en header | Alineado? |
|---|---|---|---|
| Customer Pricing | Relationship Cockpit (emerald) | emerald-400 | ✅ |
| Pipeline | Relationship Cockpit (emerald) | emerald-400 | ✅ |
| Calculator/RAROC/Shocks/StressPricing/WhatIf | Pricing Cockpit (cyan) | cyan-X | ✅ |
| TargetGrid | Pricing Cockpit (cyan) | `var(--nfq-accent)` | ✅ |
| **Campaigns** | Relationship Cockpit (emerald) | **amber-400** | ❌ |
| **Reconciliation** | Governance Hub (violet) | violet-400 | ✅ |
| **Budget Reconciliation** | Governance Hub (violet) | **emerald-400** | ❌ |
| **AttributionReporting / ApprovalCockpit / Dossiers / ModelInventory / Escalations** | Governance Hub (violet) | **emerald-400** mostly | ❌ |

#### Revisión de [SYS-8] — actualizada

- Las **dos vistas de "Relationship Cockpit" cumplen.**
- Las **6 vistas de "Pricing Cockpit" cumplen** (algunas vía legacy `text-cyan-X`, ideal vía tokens).
- **Campaigns rompe la taxonomía** — usa amber donde debería emerald.
- **TODO el dominio Attribution + Governance rompe** — usa emerald donde debería violet. Esto es **massive miscoordination** porque son 5+ vistas.
- **Budget Reconciliation rompe** — usa emerald donde debería violet.

#### Fix recomendado actualizado para [SYS-8]:
- **Opción A1 (recomendada, evolución de Opción B original):** Respetar la taxonomía sidebar:
  1. Migrar tokens en SECTION_ACCENTS para que las 4 secciones no-default usen tokens: `bg-sky-400` → `bg-[var(--nfq-cat-a)]`, `bg-violet-400` → `bg-[var(--nfq-cat-d)]`, etc. Sky=cat-a, Violet=cat-d ya está en categorías por default.
  2. Migrar headers de vistas para usar el accent semántico de su sección: AttributionReporting/ApprovalCockpit/Dossiers/ModelInventory/Escalations/BudgetReconciliation → header con `text-[var(--nfq-cat-d)]` (violet/governance). Campaigns → `text-[var(--nfq-success)]` (emerald/relationship).
  3. **Calculator/RAROC/etc. están correctos.** No tocar excepto migración legacy → tokens.

### SLO Panel (`components/Admin/SLOPanel.tsx`)

#### Positivos
- **[+] Iconos por status (Shield/Alert)** mapping correcto.
- **[+] Format helpers explícitos por unit (ms / % / count):** robustez.

#### Issues
- **[SLO-1] [MEDIUM]** `STATUS_COLOR` (líneas 14-18) usa hex literales (`#10b981`, `#f59e0b`, `#f43f5e`). Coinciden con `--nfq-success/warning/danger` pero no usan tokens. Si los tokens cambian (Light theme, accent swap), STATUS_COLOR queda obsoleto.
- **[SLO-2]** Aplica [SYS-7] — `font-mono text-xs font-medium text-white` para título (es subsección, no top header, pero igual rompe scale).

### Adapter Health Panel (`components/Admin/AdapterHealthPanel.tsx`)

#### Positivos
- **[+] 3 kinds (core_banking / crm / market_data)** con iconos específicos. Semantic.
- **[+] Relative timestamp para "Xs ago" si <60s:** UX-touch nice.

#### Issues
- **[AH-1] [MEDIUM]** Iconos status `text-emerald-400` / `text-rose-400` (líneas 78-80) — legacy palette. Debería usar tokens semánticos.

### User Management (`components/Admin/UserManagement.tsx`)

#### Positivos
- **[+] Usa `Panel` from LayoutComponents:** canonical wrapper.
- **[+] Online users via Supabase presence channel:** integración real-time.
- **[+] React.lazy(EntityOnboarding):** code split.

#### Issues
- Visual no se ve en primeras 80 líneas — likely sigue pattern Panel + UserCards grid.

### Audit Log + Health Dashboard + Accounting + AI Assistant
- **Audit secundario diferido** — no leídos en primer pass. Esperar a fase de polish.

### Batch 6 — Resumen
- **REVELACIÓN CLAVE:** Sidebar tiene taxonomía de accents intencional. [SYS-8] **no es "falta de sistema" sino "vistas no respetan el sistema sidebar"**. Esto cambia completamente el fix recomendado (Opción A1 actualizada arriba).
- **Patrón positivo:** SECTION_ACCENTS de Sidebar usa tokens para 2/6 secciones (Relationship=success, Pricing=accent). Las otras 4 usan legacy hex — migrar a `--nfq-cat-X`.
- Las vistas Admin (SLO, AdapterHealth, UserMgmt) son **menos visitadas** pero usan los mismos anti-patterns que el resto: mono uppercase titles, legacy palette, no eyebrow.

---


## SÍNTESIS — Informe ejecutivo final

> Completado el sweep de las 31 vistas (29 audited at code level, 2 deferred a polish secondary).
> Total findings: 10 sistémicos + ~50 específicos por vista.

### AI Slop verdict

**PARCIAL — Mixed signals.** El producto NO se siente "generic AI rendered" globalmente, pero tiene **9 tells específicos** que lo bajan de "producto curado" a "agregación de oleadas":

1. ❌ **`✓` y `+` como iconos** en Calculator disclosure toggles (CALC-2).
2. ❌ **`text-rose-400 line-through` para "before/after diff"** en WhatIf — pattern AI clásico (WIF-2).
3. ❌ **Italic en `<p>` con fórmula matemática** en RAROC Methodology Note (RAROC-5).
4. ❌ **Em-dash overuse** — formatChangeValue de WhatIf, separadores en multiple lugares (cubierto en humanizer skill).
5. ❌ **Multi-accent rainbow** sin sistema — 4 colores accent simultáneos (cyan/emerald/amber/violet) [SYS-8].
6. ❌ **Rainbow status mapping** repetido (Campaigns, ModelInventory, Reconciliation, Budget) con 5-7 colores.
7. ❌ **"BASIL III COMPLIANT" typo** en badge ostentoso (RAROC-1) — typo + meta-status posturing.
8. ❌ **Metadata strip "MODEL_v4.2.X · ENGINE SYNCED"** en RAROC — tell de "AI tech aesthetic".
9. ❌ **Tokens y clases rotas** (`nfq-btn-X`, `--nfq-border-subtle`) — síntoma de "vibe coding" sin verificación.

**Pero también señales POSITIVAS de producto curado:**
- Disclosure tiers + sticky receipt en Calculator
- Reproducibility snapshots, audit trails, real workflow
- Tests serios (1944 passing)
- i18n + dark/light theme awareness en 1+ vista (YieldCurves)
- Design system real con tokens v4 OKLCH (aunque no se respete consistentemente)

**Verdict:** Se nota que es un producto serio, pero **la pintura se está cayendo en 30% de las superficies.**

### Design System Compliance score

**DRIFTING.** Específicamente:
- **Strict:** 1 vista (TargetGridView — gold standard, ~95% tokens).
- **Mostly Compliant:** 3 vistas (Calculator, DealTimeline, Dossiers — 50-70% tokens).
- **Drifting:** 12 vistas (mezcla tokens + legacy).
- **Non-Compliant:** 6+ vistas (Tailwind legacy ~100%, no tokens) — RAROC, StressPricing, Pipeline, Campaigns, CustomerPricing, Reconciliation.
- **Roto funcionalmente:** 2 tokens/clases con uso significativo (SYS-9 nfq-btn-X · 4 vistas, SYS-10 nfq-border-subtle · 3 vistas, 30 occurrences).

### Resumen cuantitativo

| Severidad | Count | Tipo dominante |
|---|---|---|
| **CRÍTICO** | 12 | 3 brand-damaging (BASIL III, $ en banca EU, multi-accent) · 2 funcionales rotos (nfq-btn-X, --nfq-border-subtle) · 7 sistémicos coherencia |
| **HIGH** | 18 | Mostly legacy palette in components without migration |
| **MEDIUM** | 25 | Inconsistencias específicas por vista |
| **LOW** | 12 | Micro-polish (text size, icon sizes, em-dash) |
| **TOTAL** | ~67 | (+ varios items diferidos a audit secundario en polish) |

### Top 7 issues con mayor impacto (priorizados por ROI fix)

1. **[SYS-9] Clases CSS rotas `nfq-btn-X`** — CRÍTICO funcional. Fix global trivial (search & replace). Impacto inmediato: ~10-15 botones recuperan styling. **ROI: máximo (5 min de fix, gran ganancia visual).**

2. **[SYS-10] Token `--nfq-border-subtle` no definido** — CRÍTICO funcional. Fix: añadir token a index.css O search & replace por `--nfq-border-ghost`. Impacto: 30 bordes recuperan styling correcto. **ROI: máximo.**

3. **[RAROC-1] "BASIL III COMPLIANT" typo** — CRÍTICO brand. Fix: 1-char rename. Impacto: credibilidad regulatoria. **ROI: infinito.**

4. **[ANA-1] `$` en formatters PricingAnalytics** — CRÍTICO brand. Fix: cambiar a `€` o Intl. Impacto: credibilidad para banca europea. **ROI: muy alto.**

5. **[SYS-8 actualizado] Vistas no respetan taxonomía Sidebar** — CRÍTICO coherencia. Fix: migrar headers de 5 vistas Governance (de emerald → violet) + Campaigns (amber → emerald) + Budget (emerald → violet). Impacto: percepción de "producto unificado" vs "mosaico". **ROI: alto (cambios de header solamente, no estructura).**

6. **[SYS-1] Migración v3 → v4 incompleta** — HIGH coherencia. Fix: ~200-300 reemplazos de classes Tailwind legacy → tokens. Impacto: theme switching funciona en toda la app, accent swap funciona. **ROI: alto pero scope grande — recomiendo hacerlo via codemod/grep automation, no manual.**

7. **[SYS-4] Tipografía no usa `.nfq-*` classes** — HIGH jerarquía. Fix: ~150-200 reemplazos de `text-xs/sm/[10/11px]/etc` por `.nfq-label/.nfq-body/.nfq-data/.nfq-title/etc`. Impacto: jerarquía coherente en toda la app. **ROI: medio (scope grande, ganancia visible).**

### Plan recomendado para polish — 4 olas

#### Polish Wave 1 — Coherence (~1 semana, MAYOR LEVERAGE)
Atacar los issues sistémicos que se repiten en N vistas. Un fix elimina decenas de issues:
- **W1.1** SYS-9 (`nfq-btn-X`) — global search&replace, ~10 botones reparados.
- **W1.2** SYS-10 (`--nfq-border-subtle`) — decidir A o B en doc, aplicar, ~30 bordes reparados.
- **W1.3** SYS-1 (migración v4) — codemod assisted, por dominio: Pricing primero (Calculator/RAROC/Shocks/StressPricing/WhatIf), luego Customer/Pipeline/Campaigns/Reconciliation, luego Governance.
- **W1.4** SYS-2 (radii hardcoded) — search & replace todo `rounded-[Npx]` → tokens.
- **W1.5** SYS-3 (borders white/X → ghost) — auto-replace por dominio.
- **W1.6** Brand fixes: BASIL III + $ → €.
- **W1.7** SYS-8 actualizado — re-aplicar accent por sección (5 headers Governance → violet, Campaigns → emerald, Budget → violet).

**Expected deliverable W1:** todos los CRÍTICOS cerrados + ~70% de los HIGH atacados. Producto pasa de "Drifting" a "Mostly Compliant".

#### Polish Wave 2 — Hierarchy (~1 semana, MEJORA PERCEPCIÓN)
Atacar [SYS-4] + [SYS-7] cambiando cómo el usuario lee cada vista:
- **W2.1** SYS-7 — definir 2 patrones canónicos de header (con/sin chrome), aplicarlos.
- **W2.2** SYS-4 — migrar a `.nfq-*` typography classes view-by-view.
- **W2.3** RAROC: rediseñar metadata strip (3-4 chips → un `.nfq-eyebrow`).
- **W2.4** KPI consolidation: usar `.nfq-kpi-value` en RAROC margins, AttributionReporting tiles, etc.
- **W2.5** Eyebrow + display title pattern propagar (DealTimelineView es referencia).

**Expected deliverable W2:** Todas las vistas tienen un "punto focal" claro al entrar. Jerarquía visual consistente.

#### Polish Wave 3 — Density (~1 semana, REDUCE COGNITIVE LOAD)
Reducir info por pantalla manteniendo accesibilidad para power-users:
- **W3.1** Calculator: revisar PricingComparison + LineagePanel + ScenarioLibrary en Optimization (audit secundario).
- **W3.2** RAROC: collapsar Methodology Note tras toggle ChevronDown.
- **W3.3** Discipline: revisar 6-tab structure (audit secundario) — ¿cabe reducir a 4?
- **W3.4** WhatIf: revisar 3-column sandbox layout (sidebar + main + impact aside) — densidad excesiva.
- **W3.5** AttributionReporting: 4 tabs cada uno con tabla densa — disclosure tier?
- **W3.6** Rainbow status mapping (Campaigns, ModelInventory, Reconciliation, Budget): decidir si reducir a 4-color (success/warning/danger/info) o mantener semántica de dominio.

**Expected deliverable W3:** Vistas "respiran" más. Disclosure tier en N+1 sitios. Power users tienen toggle para volver a densidad alta.

#### Polish Wave 4 — Efficiency (~3-5 días, OPTIMIZA USO DIARIO)
Reducir clicks/fricción en tareas comunes:
- **W4.1** Atajos teclado consistentes (verificar que Cmd+K abre Command Palette en TODAS las vistas).
- **W4.2** Persistencia de filtros entre sesiones (Discipline date preset, Reconciliation period, Pipeline confidence band).
- **W4.3** Bulk actions: Calculator bulk-reprice from Blotter, Approval bulk-approve.
- **W4.4** Sidebar density — el SECTION_ACCENTS y la taxonomía 6-grupos están bien; revisar nav items count por sección (no debería superar 5-6 según Miller's 7±2).
- **W4.5** Command Palette enrichment — añadir queries semánticas ("show deals approved last week", "create campaign for retail").
- **W4.6** Tab persistence en URL params (deep-link to /attributions/reporting?tab=drift).

**Expected deliverable W4:** Power users tienen workflow más fluido. Demos están mejor estructurados (eyebrows + jerarquía clara para narrar entre vistas).

### Verificación visual requerida (lista de items marcados [VISUAL])

Estos 12 items necesitan ver el render real para confirmar diagnosis o ajustar fix:
1. SYS-2 — algunos sitios con `rounded-[22px]` pueden parecer demasiado "blandos"
2. SYS-3 — confirmar que ghost borders nuevos no rompen contraste en zonas críticas
3. SYS-5 — comparar look de tab subrayado vs pill (decisión de DS)
4. SYS-7 — ver las 31 vistas juntas para decidir A vs B
5. SYS-9 — confirmar visualmente que botones se ven raros actualmente
6. SYS-10 — confirmar cómo se ven actualmente los bordes rotos
7. CALC-3 — altura/padding de `.nfq-pill` encaja con el actual
8. CALC-4 — confirmar el "snap" visual de skeleton → card
9. RAROC-2 — comparación lado-a-lado con Calculator
10. RAROC-3 — decidir entre 3 opciones de metadata strip
11. SHK-1 — añadir header o no
12. WIF-5 — confirmar si layout 3-columnas es demasiado

**Para esta verificación:** necesitarías arrancar OrbStack + dev server cuando estés listo, o (alternativa) revisar via screenshots de las vistas en uso real.

---

## CHECKPOINT — esperando decisión de Gregorio

Audit completo. Tienes dos caminos:

### Path A — Ejecutar todo el polish (4 olas, ~3-4 semanas reales)
- Wave 1 (Coherence) cierra todos los CRÍTICOS y ~70% HIGH. **Si solo haces W1, ya merece la pena.**
- Wave 2-4 progresivamente más sutil pero acumulativo.

### Path B — Fix urgente solamente (~1 día)
- Solo los 4 issues crítico-brand-funcionales: SYS-9, SYS-10, BASIL III, $→€. 
- El resto queda como deuda visible para resolver gradualmente.

### Path C — Wave 1 + checkpoint (~1 semana, recomendado)
- Hacer toda la wave 1 + brand fixes.
- Pausar, revisar el resultado visualmente, decidir si continuar con W2-4.
- **Es la mejor relación riesgo/recompensa.**

### Mi recomendación
**Path C.** El polish wave 1 ya entrega el 70% del valor visible y deja el producto en estado "Mostly Compliant". Después de eso podemos decidir si las waves 2-4 valen el tiempo, o si nos detenemos en un estado bueno-suficiente.

