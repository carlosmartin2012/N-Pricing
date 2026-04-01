# agents.md — Guía de colaboración para agentes IA

> Directrices para agentes IA (Claude Code, Copilot, Cursor, etc.) que trabajan en N-Pricing.

## Roles de agente

### 1. Agente de Pricing Engine
**Scope**: `utils/pricingEngine.ts`, `utils/pricingConstants.ts`, `utils/ruleMatchingEngine.ts`

**Reglas**:
- Nunca modificar la fórmula FTP sin entender los 16 gaps (ver CLAUDE.md)
- Cada gap tiene dependencias cruzadas — cambiar uno puede afectar otros
- Siempre ejecutar `npm run test` tras cualquier cambio — los tests cubren interpolación, tenors, regulatory tables y el cálculo completo
- Las tablas regulatorias (LCR outflow, NSFR ASF/RSF) están en `pricingConstants.ts` — son estándar de Basilea III, no inventar valores
- Si añades un nuevo gap, documentarlo con el patrón `// Gap N: descripción` y añadir test

### 2. Agente de UI/Componentes
**Scope**: `components/`, `App.tsx`, `contexts/UIContext.tsx`

**Reglas**:
- Tailwind CSS utility-first, tema dark por defecto (`dark:` prefix)
- Componentes lazy-loaded via `React.lazy()` — mantener este patrón para nuevas vistas
- Todo texto visible al usuario debe usar `translations.ts` via `ui.t.clave`
- Iconos: solo `lucide-react`, no añadir otras librerías de iconos
- Cada componente exporta `default` para code-splitting
- No crear componentes wrapper innecesarios — Tailwind inline es preferible

### 3. Agente de Base de Datos
**Scope**: `supabase/`, `utils/supabaseService.ts`, `utils/supabaseClient.ts`, `hooks/useSupabaseSync.ts`

**Reglas**:
- Schema de referencia: `supabase/schema_v2.sql` (ignorar schema.sql, es legacy)
- Toda nueva tabla necesita: RLS policies, realtime habilitado, suscripción en `useSupabaseSync.ts`
- Los tipos TypeScript (`types.ts`) deben reflejar exactamente las columnas de la tabla
- Patrón de servicio: añadir métodos a `supabaseService` (no crear servicios nuevos)
- Usar `safeSupabaseCall()` wrapper para manejo de errores
- Nunca exponer service_role key en el frontend — solo anon key

### 4. Agente de Testing
**Scope**: `utils/__tests__/`, `vitest`

**Reglas**:
- Framework: Vitest (no Jest)
- Tests colocados en `__tests__/` junto al módulo
- Patrón de test existente: describe → it → expect con datos inline
- Prioridades de cobertura pendiente:
  1. `ruleMatchingEngine.ts` — scoring y fallback
  2. `dealWorkflow.ts` — transiciones de estado
  3. `portfolioAnalytics.ts` — agregaciones
  4. `validation.ts` — edge cases
- No mockear Supabase en tests unitarios — testear lógica pura

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
4. Añadir entrada de navegación en `mainNavItems` o `bottomNavItems` (App.tsx)
5. Añadir traducciones en `translations.ts` (en + es)
6. Si necesita datos: añadir estado en `DataContext.tsx`
7. Si necesita persistencia: crear tabla en schema_v2.sql + método en supabaseService

### Añadir un nuevo campo a Deal/Transaction

1. Añadir campo en `Transaction` interface (`types.ts`)
2. Actualizar `INITIAL_DEAL` en `constants.ts`
3. Añadir columna en `deals` table (`schema_v2.sql`)
4. Actualizar mapeo en `supabaseService.ts` (fetch + save)
5. Añadir input en `DealInputPanel.tsx` si es editable
6. Si afecta pricing: integrar en `pricingEngine.ts` + añadir test
7. Actualizar `PricingReceipt.tsx` si debe mostrarse en el resultado

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

- [ ] `npm run build` — sin errores
- [ ] `npm run test` — todos pasan
- [ ] `npm run lint` — sin warnings críticos
- [ ] Tipos: `types.ts` refleja cualquier cambio de schema
- [ ] Traducciones: textos nuevos en ambos idiomas (en/es)
- [ ] Schema: si hay cambios de BD, actualizado `schema_v2.sql`
