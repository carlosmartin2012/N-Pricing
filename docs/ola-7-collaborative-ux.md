# Ola 7 — UX colaborativa y copiloto contextual

> **Estado:** 📋 **Plan** — 2026-04-28 · **Predecesor:** [`ola-6-tenancy-strict-stress-pricing.md`](./ola-6-tenancy-strict-stress-pricing.md) (✅ código en `main`)
> **Origen:** [`integral-review-2026-04-18.md`](./integral-review-2026-04-18.md) §3 Ola 7 (párrafo de scoping → este plan ejecutable)
> **Esta ola NO es:** un rediseño visual ni un cambio de design system. Reusa NFQ tokens existentes.

---

## Estado por bloque (2026-04-28)

| Bloque | Pieza | Base existente | Esfuerzo neto |
|---|---|---|---|
| **A — Deal Timeline unificado** | Vista `/deals/:id/timeline` que fusiona Escalations + Dossiers + Audit por deal | `EscalationsView`, `DossiersView`, `AuditLog` separados; sin agregador | **3 sem** (alto) |
| **B — Live presence + locks** | Cursors compartidos en Calculator/Blotter, soft-lock por deal | `usePresenceAwareness` (117 LOC), `PresenceAvatars` (52 LOC) — falta wiring | **2 sem** (medio) |
| **C — Copiloto contextual Cmd+K** | Extender `CommandPalette` con modo "Ask" sobre snapshot actual + Gemini grounded | `CommandPalette.tsx`, `GenAIChat`, `aiGrounding.ts`, `ai_response_traces` ya existen | **2 sem** (medio) |
| **D — i18n namespaces** | Split `translations.ts` (80 KB monolítico) → `translations/{common,calculator,blotter,governance,…}` con code-split por locale | `translations/` ya tiene archivos parciales pero `translations.ts` sigue siendo el de verdad | **1 sem** (bajo) |
| **E — Onboarding por rol** | Tours diferenciados Trader / Risk Officer / Committee Member sobre `Walkthrough` existente | `WalkthroughContext`, `constants/walkthroughTours.ts` ya cableados | **1 sem** (bajo) |

**Conclusión:** Ola 7 es una ola de **extensión**, no de construcción. La mayoría de primitives (Outlet, presence, command palette, walkthrough, AI traces) ya viven en `main`. El trabajo neto son ~9 semanas-persona repartidos en 5 bloques con bajo acoplamiento.

> ⚠️ **Corrección al integral review §3 Ola 7 punto 1:** "Layout persistente con `<Outlet/>`" **ya está hecho** (Ola 6 mergeada incluyó `PricingLayoutShell` + `AppLayout variant="bare|flex-col"` en `App.tsx:306-347`). Eliminado del scope de Ola 7.

---

## 0. TL;DR

Cinco bloques **ortogonales** que comparten ventana de 6–8 semanas:

1. **Deal Timeline (A)** — única vista por deal con todo el ciclo de vida (draft → escalation L1/L2 → committee → approved → booked). Cierra el "huérfano de contexto" entre Escalations / Dossiers / Audit.
2. **Live presence (B)** — surfacear cursores y soft-locks. La primitive existe; falta render.
3. **Cmd+K copilot (C)** — palette extendido con tab "Ask" que pasa el snapshot actual a Gemini, devuelve respuesta con citas y la registra en `ai_response_traces`.
4. **i18n namespaces (D)** — refactor mecánico para code-split.
5. **Onboarding por rol (E)** — tours específicos.

Entregable único mergeable por bloque (sin interdependencias fuertes salvo A→B opcional).

---

## 1. Bloque A — Deal Timeline unificado

### Objetivo

Cuando un comité abre un deal pendiente, hoy debe saltar entre **Escalations** (`/escalations`), **Dossiers** (`/dossiers`), **Audit Log** (`/audit`) y **Blotter** (`/blotter`) para reconstruir su historia. Ola 7 entrega `/deals/:id/timeline` con todo el ciclo de vida en una sola vista.

### Pre-condiciones

- ✅ `escalations`, `signed_dossiers`, `audit_log` ya tienen `deal_id` o `request_id` que apunta a un deal.
- ✅ `react-router` 7 con rutas dinámicas (ya usado en otras vistas).
- ❌ No existe agregador `buildDealTimeline(dealId)` — hay que escribirlo.

### Diseño

**Modelo de datos (read-only, agregado en server):**

```ts
// types/dealTimeline.ts (nuevo)
export interface DealTimelineEvent {
  id: string;
  dealId: string;
  occurredAt: string;            // ISO-8601
  actor: { userId: string; name: string; role: string };
  kind:
    | 'deal_created'
    | 'deal_repriced'
    | 'escalation_opened'
    | 'escalation_resolved'
    | 'dossier_signed'
    | 'committee_decision'
    | 'audit_event';
  payload: Record<string, unknown>;   // shape per kind
  snapshotId?: string;                 // link a pricing_snapshots
}

export interface DealTimeline {
  dealId: string;
  events: DealTimelineEvent[];        // ASC por occurredAt
  currentStatus: DealStatus;
  decisionLineage: { stage: string; actor: string; at: string }[];
}
```

**Server route `server/routes/dealTimeline.ts`:**

```ts
GET /api/deals/:id/timeline
  → tenancy-scoped read of:
    - deals (cabecera)
    - pricing_snapshots WHERE deal_id = :id ORDER BY created_at
    - escalations WHERE request_id = :id
    - signed_dossiers WHERE deal_id = :id
    - audit_log WHERE resource_type = 'deal' AND resource_id = :id
  → merge ordenado por occurredAt → DealTimeline JSON
```

**UI:**

- Ruta `/deals/:id/timeline` bajo `<AppLayout variant="flex-col">`.
- Componente `DealTimelineView.tsx` con:
  - Header con `dealId`, status chip, KPIs derivados (RAROC, margen, tiempo total en pipeline).
  - Stepper vertical estilo GitHub PR Timeline. Cada evento es un card con icono semántico, actor, timestamp, payload renderizado por kind.
  - Filtros por kind (toggleable chips).
  - Botón "Replay snapshot" en eventos `deal_repriced` → invoca `/api/snapshots/:id/replay` existente.

**Navegación:**

- Desde `/blotter` cada fila gana un link "View timeline" → `/deals/:id/timeline`.
- Desde `/escalations` y `/dossiers` cada item enlaza a `/deals/:id/timeline?focus=<eventId>`.

### Entregables Bloque A

1. `types/dealTimeline.ts` — tipos.
2. `server/routes/dealTimeline.ts` — agregador read-only entity-scoped.
3. `api/dealTimeline.ts` + `hooks/queries/useDealTimelineQuery.ts`.
4. `components/Deals/DealTimelineView.tsx` + sub-componentes (`TimelineEventCard`, `TimelineFilters`).
5. Wiring en `App.tsx` y `appNavigation.ts` (ruta dinámica, no entry sidebar).
6. Tests:
   - Server: agregación + tenancy guard + ordering (Vitest).
   - UI: render por kind + filtros + link al replay (RTL).
   - E2E: spec `e2e/deal-timeline.spec.ts` (deal con escalation + dossier + repricings).
7. **Eliminar Escalations/Dossiers del sidebar principal** (siguen accesibles desde Audit). Cumple §3 del integral review: *"Ola 7 debería reducir, no añadir"*.

### Riesgos Bloque A

| Riesgo | Mitigación |
|---|---|
| Performance: deal con 200+ snapshots tarda | Paginación server-side + lazy-render con `react-virtual` (ya en deps) |
| Auditoría: timeline omite eventos | Tests de cobertura por kind: cada inserción en `escalations` / `signed_dossiers` / `audit_log` debe aparecer |
| Dual entry (timeline + listas legacy) | A los 30 días post-merge, eliminar `EscalationsView` y `DossiersView` standalone si métricas confirman migración |

### KPIs Bloque A

| KPI | Baseline | Target |
|---|---|---|
| Clicks medios para reconstruir historia de un deal | ~6 (cross-vista) | ≤ 2 (timeline directo) |
| Tiempo medio en página `/escalations` | n/a | -40% (usuarios saltan a timeline) |
| Coverage `dealTimelineRouter` | n/a | ≥ 85% lines |

---

## 2. Bloque B — Live presence + locks

### Objetivo

Surfacear quién está mirando o editando un deal/calculator en tiempo real. Reduce conflictos cuando dos traders abren el mismo blotter row.

### Pre-condiciones

- ✅ `hooks/usePresenceAwareness.ts` (117 LOC) — broadcast vía Supabase Realtime.
- ✅ `components/ui/PresenceAvatars.tsx` — render avatares.
- ✅ `usePresenceAndSessionAudit` — registra sesión en audit.
- ❌ Cursors no están renderizados sobre la UI.
- ❌ No hay soft-lock — dos usuarios pueden editar simultáneamente sin warning.

### Diseño

**Cursors (Calculator + Blotter):**

- Extender `usePresenceAwareness` para emitir `{ x: number, y: number, viewport: 'calculator' | 'blotter' }` con throttle 50 ms.
- Componente nuevo `<LiveCursorOverlay />` posicionado `fixed inset-0 pointer-events-none z-30` que renderiza un cursor SVG por presence remoto con su nombre/inicial.
- Toggle global en UI Context: `liveCursorsEnabled` (default `true`). Persistido en localStorage.

**Soft-locks (Blotter row, Calculator deal):**

- Nueva tabla `deal_active_sessions(deal_id, user_id, entity_id, started_at, last_seen_at)` con TTL 60 s vía Supabase Realtime presence (no DB).
- Hook `useDealLock(dealId)` devuelve `{ locked: boolean, lockedBy?: User }`.
- En Blotter row: badge "Carlos editando" si `locked && lockedBy.id !== currentUserId`.
- En Calculator: si abres un deal con lock activo, modal "Carlos está editando este deal. ¿Continuar de todos modos?" con botones [Cancelar] [Continuar (read-only)] [Forzar edición (audit-logged)].

### Entregables Bloque B

1. Extensión de `usePresenceAwareness` con cursor coords.
2. `components/ui/LiveCursorOverlay.tsx`.
3. `hooks/useDealLock.ts`.
4. Wiring en `Calculator/PricingWorkspace.tsx` y `Blotter/DealBlotter.tsx`.
5. Toggle global en UIContext.
6. Tests: presence broadcast + render + lock acquisition (Vitest + RTL).
7. E2E: 2 contextos Playwright simulando 2 usuarios, verificando cursor y lock modal.

### Riesgos Bloque B

| Riesgo | Mitigación |
|---|---|
| Spam de eventos presence en deals con 10+ usuarios | Throttle 50 ms ya planeado + cap visual a 5 cursores; resto en avatar count |
| Forzar edición causa conflictos de save | El forzado audita y la última escritura gana; el modal lo deja claro |
| Privacy: usuario no quiere ser visto | Toggle global + opt-out por defecto en mobile |

### KPIs Bloque B

| KPI | Baseline | Target |
|---|---|---|
| Conflictos de save en Calculator (mismas 2h) | no medido | < 1 / semana / tenant medio |
| Adopción cursors (% sesiones con > 1 user activo) | 0% | ≥ 60% |

---

## 3. Bloque C — Cmd+K copilot contextual

### Objetivo

Hoy `CommandPalette` solo navega. Extender con modo "Ask" que recibe el **snapshot actual** (input + context + output) y responde con citas regulatorias + sugerencias de trade-off, dejando audit trail en `ai_response_traces`.

### Pre-condiciones

- ✅ `components/ui/CommandPalette.tsx` — palette con search.
- ✅ `components/Intelligence/GenAIChat.tsx` — chat suelto en `/ai`.
- ✅ `utils/aiGrounding.ts` + tests — sistema de citas regulatorias.
- ✅ Tabla `ai_response_traces` con FK a snapshot.
- ✅ `@google/genai` en deps.
- ❌ Falta el "puente": que Cmd+K reciba el snapshot del contexto actual y delegue a la SDK.

### Diseño

**Tabs en CommandPalette:**

- `[Navigate]` (actual) — buscar vistas/deals/clientes.
- `[Ask]` (nuevo) — input multilinea, footer con chip de contexto:
  - Si el usuario está en `/pricing` con un deal cargado → "Contexto: Deal #ABC, RAROC 12.4%, margen 1.45 bps".
  - Si está en `/blotter` → "Contexto: 47 deals pending".
  - Si no hay contexto → "Contexto: ninguno (respuesta general)".

**Flujo:**

1. Usuario abre Cmd+K → tab Ask → escribe pregunta.
2. Frontend construye `payload = { question, context: { snapshotId, dealSummary }, lang }`.
3. Server route `POST /api/copilot/ask` (nuevo):
   - Tenancy-scoped.
   - Carga snapshot completo desde `pricing_snapshots`.
   - Compone prompt con `aiGrounding.ts` (incluye Anejo IX, CRR3, EBA GL refs).
   - Llama a Gemini.
   - Inserta resultado en `ai_response_traces` con `kind='copilot'`.
   - Devuelve `{ answer, citations[], suggestedActions[] }`.
4. UI renderiza respuesta en panel inline + botón "Apply suggestion" para `suggestedActions` accionables.

**Acciones sugeridas (opcionales):**

- "Bajar margen 5 bps" → prefilling en Calculator (no aplica directamente, requiere confirmación).
- "Abrir RAROC Terminal con este deal" → navega.
- "Generar dossier" → invoca flujo existente.

### Entregables Bloque C

1. `components/ui/CommandPalette.tsx` extendido con tab Ask + chip contexto.
2. `server/routes/copilot.ts` con guard tenancy + snapshot fetch + Gemini call + audit insert.
3. `api/copilot.ts` + types `types/copilot.ts`.
4. `utils/copilot/promptBuilder.ts` (compose grounding + context + question).
5. Tests:
   - Server: auth + tenancy + snapshot resolution (mock Gemini).
   - Prompt builder: snapshot → prompt determinista (Vitest).
   - UI: tab switch + envío + render respuesta + Apply suggestion (RTL).
6. E2E: spec `e2e/copilot-cmd-k.spec.ts`.

### Riesgos Bloque C

| Riesgo | Mitigación |
|---|---|
| Costes Gemini si todos los users abusan | Rate limit per-user (5 req/min) en server + counter en UI |
| Hallucinated citations | `aiGrounding.ts` ya valida refs contra catálogo conocido; sólo se renderizan citas validadas |
| Suggested actions cambian el deal sin querer | Apply siempre requiere confirmación explícita + entrada en audit_log |
| Privacy: snapshot tiene PII del cliente | Prompt builder redacta `clientName`/`clientId` antes de enviar a Gemini (configurable per-tenant) |

### KPIs Bloque C

| KPI | Baseline | Target |
|---|---|---|
| Cmd+K opens / sesión | n/a | ≥ 3 |
| % opens que usan tab Ask vs Navigate | 0% | ≥ 25% |
| `ai_response_traces` rows / día | bajo | crecimiento sostenido |
| Apply suggestion → deal repriced | 0 | tracking sin target inicial |

---

## 4. Bloque D — i18n namespaces

### Objetivo

`translations.ts` es un archivo monolítico de **80 KB / 83 K líneas** que entra entero en el bundle. Split por namespace permite code-split por vista y por locale.

### Pre-condiciones

- ✅ Carpeta `translations/` existe con archivos parciales pero `translations.ts` sigue siendo la fuente.
- ✅ `useTranslation` hook usado en toda la UI.
- ❌ No hay loader async; todo se importa síncrono.

### Diseño

**Targets de namespace:**

```
translations/
  common.{en,es}.ts        # Botones, errores genéricos, navegación
  calculator.{en,es}.ts
  blotter.{en,es}.ts
  governance.{en,es}.ts    # Escalations + dossiers + model inventory
  customer360.{en,es}.ts
  reporting.{en,es}.ts
  market-data.{en,es}.ts
```

**API nueva:**

```ts
// hooks/useTranslation.ts
const { t } = useTranslation('calculator');  // namespace prop
t('rateLabel');                               // → "Final client rate"
```

Internamente, `useTranslation(ns)` hace `await import('./translations/' + ns + '.' + locale + '.ts')` con cache + Suspense boundary.

**Migración mecánica:**

1. Script `scripts/split-translations.ts` que parsea `translations.ts` y escribe los namespaces basándose en prefijos de keys.
2. Codemod que reescribe `useTranslation()` → `useTranslation('<inferred>')` por componente.
3. Eliminar `translations.ts` cuando todos los consumidores usen namespace.

### Entregables Bloque D

1. Script `split-translations.ts` (one-shot).
2. Hook `useTranslation` extendido con namespace.
3. Codemod aplicado, monolítico eliminado.
4. Test de regresión: `npm run check:translations` (nuevo) verifica que toda key referenciada existe en su namespace.

### Riesgos Bloque D

| Riesgo | Mitigación |
|---|---|
| Rotura silenciosa de keys huérfanas | Test de regresión + lint custom |
| Suspense boundary no cubre todos los casos | Test E2E que valida todas las vistas no muestran key raw |

### KPIs Bloque D

| KPI | Baseline | Target |
|---|---|---|
| Bundle inicial (`index-*.js`) | 495.85 KB | ≤ 380 KB |
| Tiempo a "Rate label visible" en `/pricing` | TBD | sin regresión |

---

## 5. Bloque E — Onboarding por rol

### Objetivo

Tours guiados específicos para Trader (foco Calculator + Blotter), Risk Officer (Stress Pricing + IRRBB + alertas) y Committee Member (Dossiers + Timeline). Reusa `Walkthrough` existente.

### Pre-condiciones

- ✅ `WalkthroughContext` + `constants/walkthroughTours.ts` ya cableados.
- ❌ Solo hay un tour genérico — no diferencia rol.

### Diseño

- En `walkthroughTours.ts` añadir 3 secuencias: `traderOnboarding`, `riskOfficerOnboarding`, `committeeOnboarding`.
- En primer login post-deploy, leer `req.user.role` y disparar tour correspondiente vía `WalkthroughContext.startTour(name)`.
- Persistir "tour_completed_<role>" en `user_preferences` (tabla nueva o JSONB en `users`).
- Botón "Replay tour" en User Manual.

### Entregables Bloque E

1. 3 nuevos tours en `walkthroughTours.ts`.
2. Disparo automático en `App.tsx` post-login.
3. Persistencia "completed".
4. Test: tour render + advance + persist (RTL).

### KPIs Bloque E

| KPI | Baseline | Target |
|---|---|---|
| Time to first deal repriced (nuevo user) | n/a | < 10 min |
| % users que completan tour | n/a | ≥ 60% |

---

## 6. Cronograma sugerido (8 semanas)

| Semana | Bloque |
|---|---|
| 1 | A.1–A.4 (modelo + route + agregador) |
| 2 | A.5–A.7 (UI + tests + e2e) — **A mergeable** |
| 3 | B.1–B.3 (cursors + lock primitive) |
| 4 | B.4–B.7 (wiring + tests + e2e) — **B mergeable** |
| 5 | C.1–C.3 (route + prompt builder + tab Ask) |
| 6 | C.4–C.6 (suggested actions + tests) — **C mergeable** |
| 7 | D + E en paralelo (refactor + tours) |
| 8 | Polish, KPIs measurement, release notes |

Cada bloque cierra con un PR mergeable a `main`. **A puede empezar antes que termine Ola 6 ops** (flip strict): no hay solapamiento.

---

## 7. Decisiones que necesitan input antes de empezar

1. **¿Eliminar `EscalationsView` y `DossiersView` del sidebar tras Bloque A?** Recomendación: sí, a los 30 días post-merge si métricas confirman migración. Reduce de 16 → 14 vistas (cumple §3 integral review).
2. **¿Cursors siempre on o opt-in por tenant?** Recomendación: feature flag per-tenant `LIVE_CURSORS_ENABLED` default `true` con kill switch documentado.
3. **¿Redactar PII en prompts a Gemini?** Recomendación: sí por defecto, opt-in para inhibir vía `COPILOT_REDACT_CLIENT_PII=false` per tenant.
4. **¿Mantener tab Ask separado o fusionar con `/ai` (GenAIChat)?** Recomendación: separar por intención — `/ai` es para sesión larga; Cmd+K es para "respuesta rápida con contexto del momento". Pueden compartir `ai_response_traces`.

---

## 8. Métricas de éxito (post-Ola 7)

| KPI | Baseline 2026-04-28 | Target post-Ola 7 |
|---|---|---|
| Vistas en sidebar | 16 | ≤ 14 |
| Clicks promedio para ver historia de deal | ~6 | ≤ 2 |
| % sesiones con presencia de 2+ usuarios activa | n/a | ≥ 30% |
| % Cmd+K opens que usan tab Ask | 0% | ≥ 25% |
| Bundle inicial JS | 495.85 KB | ≤ 380 KB |
| Tour completion rate (nuevos users) | n/a | ≥ 60% |

---

## 9. Riesgos cross-bloque

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Bloque B presence amplifica acoplamiento Supabase Realtime | Media | Audit existente ya lo usa; no añade superficie nueva |
| Bloque C aumenta dependencia Gemini | Alta | Rate limit + kill switch `COPILOT_ENABLED=false` per-tenant |
| Bloque A timeline expone info entre roles | Baja | Reusa RLS de cada origen; ningún campo nuevo |
| Bloque D codemod rompe traducciones existentes | Media | Test snapshot de keys + e2e de cada vista en es/en |

---

## 10. Lo que NO está en Ola 7

- Móvil nativo / Capacitor → **Ola 8**.
- Plugin SDK público → **Ola 8**.
- Salesforce / Bloomberg adapters reales → bloqueado por credenciales cliente.
- Scenario optimization AI → **Ola 8**.
- Datalake snapshot stream → **Ola 8**.

---

## 11. Documentación a actualizar al cierre

- [ ] `CLAUDE.md` — añadir Ola 7 como capa post-Ola 6.
- [ ] `docs/architecture.md` — sección "Deal Timeline" + "Live Collaboration" + "Cmd+K Copilot".
- [ ] `docs/api-spec.yaml` — endpoints `/deals/:id/timeline`, `/copilot/ask`.
- [ ] `docs/runbooks/copilot-rate-limit.md` — qué hacer si Gemini cuota se agota.
- [ ] `docs/runbooks/live-cursor-flood.md` — kill switch presence.
- [ ] Release notes consolidadas en `docs/roadmap-execution-summary.md`.
