# agents.md — Guía de colaboración para agentes IA

> Directrices para agentes IA (Claude Code, Copilot, Cursor, etc.) que trabajan en N-Pricing.

## Roles de agente

### 1. Agente de Pricing Engine
**Scope**: `utils/pricingEngine.ts`, `utils/pricing/`, `utils/pricingConstants.ts`, `utils/ruleMatchingEngine.ts`, `utils/rarocEngine.ts`

**Reglas**:
- Nunca modificar la fórmula FTP sin entender los 19 gaps (ver CLAUDE.md y `docs/pricing-methodology.md`)
- Cada gap tiene dependencias cruzadas — cambiar uno puede afectar otros
- El motor está modularizado: `utils/pricing/curveUtils.ts`, `formulaEngine.ts`, `liquidityEngine.ts`
- Siempre ejecutar `npm run test` tras cualquier cambio — ~1.0k tests cubren interpolación, tenors, regulatory tables, RAROC, deal workflow, governance, credit risk, snapshots, drift, CLV y el cálculo completo
- Las tablas regulatorias (LCR outflow, NSFR ASF/RSF) están en `pricingConstants.ts` — son estándar de Basilea III, no inventar valores
- Constantes regulatorias adicionales en `constants/regulations.ts`
- Si añades un nuevo gap, documentarlo con el patrón `// Gap N: descripción` y añadir test
- RAROC engine (`rarocEngine.ts`) consume outputs del pricing engine — cambios en FTP pueden afectar RAROC
- Toda ejecución del motor que toque producción debe emitir `pricing_snapshots` — revisar `supabase/functions/pricing/index.ts` como referencia

### 2. Agente de UI/Componentes
**Scope**: `components/` (227 archivos), `App.tsx`, `contexts/UIContext.tsx`

**Reglas**:
- Tailwind CSS utility-first, tema dark por defecto — diseño NFQ Meridian Obsidian
- Componentes lazy-loaded via `React.lazy()` — mantener este patrón para nuevas vistas
- Todo texto visible al usuario debe usar `translations.ts` via `ui.t.clave`
- Iconos: solo `lucide-react`, no añadir otras librerías de iconos
- Cada componente exporta `default` para code-splitting
- No crear componentes wrapper innecesarios — Tailwind inline es preferible
- Formularios usan `react-hook-form` — mantener este patrón
- Listas largas usan `@tanstack/react-virtual` — usar para tables/lists con muchos rows
- Componentes compartidos en `components/ui/`: Drawer, Toast, ErrorBoundary, FileUploadModal, etc.
- Storybook stories (`*.stories.tsx`) junto al componente para desarrollo visual aislado

### 3. Agente de Base de Datos
**Scope**: `supabase/`, `api/`, `utils/supabase/`, `server/db.ts`, `server/migrate.ts`, `hooks/supabaseSync/`

**Reglas**:
- **Fuente de verdad Supabase**: `supabase/migrations/*.sql` (38 migrations en orden cronológico). Última: `20260608000001_clv_360.sql`.
- **Server inline schema**: `server/migrate.ts` es un subconjunto para el arranque Node-only (dev + Replit). Si tocas una tabla que el server necesita al boot, actualiza ambos.
- `supabase/schema_v2.sql` es snapshot parcial de referencia (leído por `check-seed-schema-sync.ts` como fallback). `supabase/schema.sql` está marcado `LEGACY — DO NOT EXECUTE` y ningún tooling lo lee.
- Siempre añadir la siguiente migration con prefijo `YYYYMMDDHHMMSS_`
- Capa API centralizada en `api/` (21 módulos) — usar `api/mappers.ts` para snake_case↔camelCase
- Servicios especializados en `utils/supabase/`: deals, market, config, audit, approval, masterData, rules, monitoring, etc.
- Toda nueva tabla entity-scoped necesita: columna `entity_id UUID REFERENCES entities(id)`, RLS policies (read accesible / insert current / delete Admin), realtime si la UI la consume, suscripción en `hooks/supabaseSync/useRealtimeSync.ts`
- Los tipos TypeScript deben reflejar exactamente las columnas (`types.ts` + re-exports en `types/*.ts`)
- Sync descompuesto en `hooks/supabaseSync/`: hydration, realtime, config persistence, presence
- React Query wrappers en `hooks/queries/` — usar query keys de `queryKeys.ts`
- Usar `safeSupabaseCall()` wrapper para manejo de errores
- Nunca exponer service_role key en el frontend — solo anon key
- 3 Edge Functions Deno en `supabase/functions/` (pricing, realize-raroc, elasticity-recalibrate)
- Server routes entity-scoped: usar `entityScopedClause(req, N)` para reads y `tenancyScope(req)` para writes/deletes (ver `server/middleware/requireTenancy.ts`)

### 4. Agente de Testing
**Scope**: `utils/__tests__/` (80 archivos), `components/*/__tests__/`, `e2e/` (20 specs)

**Reglas**:
- **Unit**: Vitest 4 (no Jest) — ~1.0k tests en ~80 archivos
- **Integration (opt-in)**: `utils/__tests__/integration/` — corre sólo con `INTEGRATION_DATABASE_URL` set. RLS + tenancy + fuzz
- **E2E**: Playwright 1.59 — 20 specs (auth, pricing-flow, deal-blotter, esg-grid, market-data, multi-entity, navigation, rules-governance, shocks-reporting, ai-assistant, offline-pwa, rbac, reconciliation, pipeline, clv, brochure-screenshots, ...)
- **Component**: Storybook 8.6 — stories junto al componente
- Tests colocados en `__tests__/` junto al módulo
- Patrón de test existente: describe → it → expect con datos inline
- Para cálculos financieros: `toBeCloseTo` con tolerancia explícita
- No mockear Supabase en tests unitarios — testear lógica pura
- Config vitest en `vite.config.ts` (node environment, setup-dom.ts)
- Antes de push: `npm run verify:full`

### 5. Agente de Seguridad
**Scope**: Transversal

**Reglas**:
- Variables de entorno: siempre `VITE_` prefix para Vite, nunca hardcodear secrets
- XSS: React escapa por defecto, no usar `dangerouslySetInnerHTML`
- Inyección SQL: Supabase SDK parametriza queries, no construir SQL raw
- Auth: validar rol del usuario antes de operaciones destructivas
- Audit: toda acción significativa debe llamar a `useAudit().logAction()`
- RLS: toda tabla nueva necesita policies en una migration propia (read entity-scoped, insert con `get_current_entity_id()`, delete Admin-only). Ver patrón en `20260406000001_multi_entity.sql` y `20260602000002_rls_delete_policies.sql`.
- Append-only: omitir UPDATE/DELETE policies en tablas audit / snapshots.
- Integrations (`integrations/`): jamás `throw` — devolver `AdapterResult<T>` discriminado.

## Flujos de trabajo

### Añadir un nuevo módulo/vista

1. Crear componente en `components/NuevoModulo/NuevoModulo.tsx` con `export default`
2. Añadir ViewState en `types.ts` (tipo `ViewState`)
3. Añadir lazy import en `App.tsx`
4. Añadir entrada de navegación en `appNavigation.ts` (`buildMainNavItems` o `buildBottomNavItems`)
5. Añadir traducciones en `translations.ts` (en + es, ~534 keys existentes)
6. Si necesita datos: añadir estado en el Context apropiado (DataContext, GovernanceContext, MarketDataContext)
7. Si necesita persistencia: crear **nueva migration** en `supabase/migrations/YYYYMMDDHHMMSS_*.sql` (no editar `schema_v2.sql`) + servicio en `utils/supabase/` + operación en `api/`
8. Si necesita data fetching: añadir React Query hook en `hooks/queries/`

### Añadir un nuevo campo a Deal/Transaction

1. Añadir campo en `Transaction` interface (`types.ts`)
2. Actualizar `INITIAL_DEAL` en seed data (`utils/seedData.ts`)
3. Añadir columna en `deals` via nueva migration `supabase/migrations/YYYYMMDDHHMMSS_add_<col>.sql` con `ALTER TABLE deals ADD COLUMN IF NOT EXISTS <col> ...`
4. Actualizar mapeo en `api/mappers.ts` (snake_case↔camelCase) y el flujo CRUD en `api/deals.ts`
5. Añadir input en `DealInputPanel.tsx` o `DealConfigurationPanel.tsx` si es editable
6. Si afecta pricing: integrar en `pricingEngine.ts` (o `utils/pricing/`) + añadir test
7. Actualizar `PricingReceipt.tsx` si debe mostrarse en el resultado
8. Verificar sync: `npm run check:sync`

### Corregir un bug en el motor de pricing

1. Reproducir con test: añadir caso en `pricingEngine.test.ts`
2. Identificar el gap afectado (1-16)
3. Aplicar fix en `pricingEngine.ts`
4. Verificar que no rompe otros gaps (ejecutar suite completa)
5. Si afecta a la BD: verificar que `pricing_results` se guarda correctamente

## Coordinación entre agentes

- **No duplicar trabajo**: antes de crear un fichero, verificar que no existe
- **Un contexto a la vez**: evitar modificar DataContext, UIContext y AuthContext en el mismo PR
- **Tests primero**: si el cambio afecta lógica de negocio, escribir el test antes del fix
- **Commits atómicos**: un commit por gap/feature, mensaje con formato `feat|fix: Round N — descripción`
- **Conflictos**: si dos agentes tocan `pricingEngine.ts`, el segundo debe hacer rebase antes de push

## Checklist pre-push

- [ ] `npm run verify:full` — lint + typecheck + test + build + e2e
- [ ] `npm run check:sync` — seed↔schema sync válido
- [ ] `npm run check:bundle` — bundle sizes dentro de budget
- [ ] Tipos: `types.ts` refleja cualquier cambio de schema
- [ ] Mappers: `api/mappers.ts` actualizado si hay nuevos campos
- [ ] Traducciones: textos nuevos en ambos idiomas (en/es) en `translations.ts`
- [ ] Schema: si hay cambios de BD, **nueva migración** en `supabase/migrations/` (no editar `schema_v2.sql`)
- [ ] Query keys: si hay nuevas queries, registradas en `hooks/queries/queryKeys.ts`
