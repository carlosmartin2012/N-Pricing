# agents.md — Guía de colaboración para agentes IA

> Directrices para agentes IA (Claude Code, Copilot, Cursor, etc.) que trabajan en N-Pricing.

## Roles de agente

### 1. Agente de Pricing Engine
**Scope**: `utils/pricingEngine.ts`, `utils/pricing/`, `utils/pricingConstants.ts`, `utils/ruleMatchingEngine.ts`, `utils/rarocEngine.ts`

**Reglas**:
- Nunca modificar la fórmula FTP sin entender los 19 gaps (ver CLAUDE.md y `docs/pricing-methodology.md`)
- Cada gap tiene dependencias cruzadas — cambiar uno puede afectar otros
- El motor está modularizado: `utils/pricing/curveUtils.ts`, `formulaEngine.ts`, `liquidityEngine.ts`
- Siempre ejecutar `npm run test` tras cualquier cambio — 328 tests cubren interpolación, tenors, regulatory tables, RAROC, deal workflow, governance, credit risk y el cálculo completo
- Las tablas regulatorias (LCR outflow, NSFR ASF/RSF) están en `pricingConstants.ts` — son estándar de Basilea III, no inventar valores
- Constantes regulatorias adicionales en `constants/regulations.ts`
- Si añades un nuevo gap, documentarlo con el patrón `// Gap N: descripción` y añadir test
- RAROC engine (`rarocEngine.ts`) consume outputs del pricing engine — cambios en FTP pueden afectar RAROC

### 2. Agente de UI/Componentes
**Scope**: `components/` (111 archivos), `App.tsx`, `contexts/UIContext.tsx`

**Reglas**:
- Tailwind CSS utility-first, tema dark por defecto — diseño NFQ Meridian Obsidian
- Componentes lazy-loaded via `React.lazy()` — mantener este patrón para nuevas vistas
- Todo texto visible al usuario debe usar `translations.ts` via `ui.t.clave` (~534 keys, en/es)
- Iconos: solo `lucide-react`, no añadir otras librerías de iconos
- Cada componente exporta `default` para code-splitting
- No crear componentes wrapper innecesarios — Tailwind inline es preferible
- Formularios usan `react-hook-form` — mantener este patrón
- Listas largas usan `@tanstack/react-virtual` — usar para tables/lists con muchos rows
- Componentes compartidos en `components/ui/`: Drawer, Toast, ErrorBoundary, FileUploadModal, etc.
- Storybook stories (`*.stories.tsx`) junto al componente para desarrollo visual aislado

### 3. Agente de Base de Datos
**Scope**: `supabase/`, `api/`, `utils/supabase/` (15 módulos), `utils/supabaseClient.ts`, `hooks/supabaseSync/`

**Reglas**:
- Schema de referencia: `supabase/schema_v2.sql` (ignorar schema.sql, es legacy)
- 14 migraciones en `supabase/migrations/` — ejecutar en orden
- Capa API centralizada en `api/` — usar `api/mappers.ts` para snake_case↔camelCase
- Servicios especializados en `utils/supabase/`: deals, market, config, audit, approval, masterData, rules, monitoring, etc.
- Toda nueva tabla necesita: RLS policies, realtime habilitado, suscripción en `hooks/supabaseSync/useRealtimeSync.ts`
- Los tipos TypeScript (`types.ts`, 64+ interfaces) deben reflejar exactamente las columnas de la tabla
- Sync descompuesto en `hooks/supabaseSync/`: hydration, realtime, config persistence, presence
- React Query wrappers en `hooks/queries/` — usar query keys de `queryKeys.ts`
- Usar `safeSupabaseCall()` wrapper para manejo de errores
- Nunca exponer service_role key en el frontend — solo anon key
- Edge Function de pricing en `supabase/functions/pricing/` (Deno runtime)

### 4. Agente de Testing
**Scope**: `utils/__tests__/` (23 archivos), `components/*/__tests__/` (3 archivos), `e2e/` (10 specs)

**Reglas**:
- **Unit**: Vitest 4 (no Jest) — 328 tests en 67 suites, 26 archivos
- **E2E**: Playwright 1.59 — 10 specs (`auth`, `brochure-screenshots`, `deal-blotter`, `esg-grid`, `example`, `market-data`, `navigation`, `pricing-flow`, `rules-governance`, `shocks-reporting`)
- **Component**: Storybook 8.6 — stories junto al componente
- Tests colocados en `__tests__/` junto al módulo
- Patrón de test existente: describe → it → expect con datos inline
- Suites ya cubiertas: pricingEngine, ruleMatchingEngine, validation, dealWorkflow, RAROC metrics, blotter toolbar, pricing scenarios, creditRiskEngine, entityScoping, conflictDetection, governanceWorkflows, auditTransport, pagination, offlineStore, aiGrounding, genAIChatUtils, regulatoryExport, accountingLedgerUtils, committeeDossierUtils, marketDataSourcesUtils, portfolioSnapshotsUtils, userManagementUtils, aiAnalytics, metrics, auditLogUtils
- Prioridades de cobertura pendiente:
  1. `portfolioAnalytics.ts` — agregaciones
  2. `utils/pricing/` — motor modularizado (curveUtils, formulaEngine, liquidityEngine)
  3. `api/mappers.ts` — conversión snake_case↔camelCase
  4. Más component tests (solo 3 componentes tienen tests)
- No mockear Supabase en tests unitarios — testear lógica pura
- Config vitest en `vite.config.ts` (node environment, setup-dom.ts)

### 5. Agente de Seguridad
**Scope**: Transversal

**Reglas**:
- Variables de entorno: siempre `VITE_` prefix para Vite, nunca hardcodear secrets
- XSS: React escapa por defecto, no usar `dangerouslySetInnerHTML`
- Inyección SQL: Supabase SDK parametriza queries, no construir SQL raw
- Auth: validar rol del usuario antes de operaciones destructivas
- Audit: toda acción significativa debe llamar a `useAudit().logAction()`
- RLS: verificar que nuevas tablas tengan policies en schema_v2.sql

## Flujos de trabajo

### Añadir un nuevo módulo/vista

1. Crear componente en `components/NuevoModulo/NuevoModulo.tsx` con `export default`
2. Añadir ViewState en `types.ts` (tipo `ViewState`)
3. Añadir lazy import en `App.tsx`
4. Añadir entrada de navegación en `appNavigation.ts` (`buildMainNavItems` o `buildBottomNavItems`)
5. Añadir traducciones en `translations.ts` (en + es, ~534 keys existentes)
6. Si necesita datos: añadir estado en el Context apropiado (DataContext, GovernanceContext, MarketDataContext)
7. Si necesita persistencia: crear tabla en schema_v2.sql + servicio en `utils/supabase/` + operación en `api/`
8. Si necesita data fetching: añadir React Query hook en `hooks/queries/`

### Añadir un nuevo campo a Deal/Transaction

1. Añadir campo en `Transaction` interface (`types.ts`)
2. Actualizar `INITIAL_DEAL` en seed data (`utils/seedData.ts`)
3. Añadir columna en `deals` table (`schema_v2.sql`)
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
- [ ] Schema: si hay cambios de BD, actualizado `schema_v2.sql` + nueva migración en `supabase/migrations/`
- [ ] Query keys: si hay nuevas queries, registradas en `hooks/queries/queryKeys.ts`
