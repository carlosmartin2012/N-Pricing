# CLAUDE.md — N-Pricing

> Contexto esencial para agentes IA que trabajan en este repositorio.

## Qué es N-Pricing

Motor de **Funds Transfer Pricing (FTP)** para instituciones financieras. Calcula tasas de transferencia internas entre unidades de negocio, análisis de rentabilidad (RAROC), costes regulatorios (LCR/NSFR) y ajustes ESG. PWA con soporte offline.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19.2, TypeScript 5.8, Tailwind CSS 3 |
| Iconos | Lucide React |
| Build | Vite 6.2 + vite-plugin-pwa |
| Estado | React Context API (Auth, Data, UI, Governance, MarketData, Entity, Walkthrough) |
| Data fetching | @tanstack/react-query 5 |
| Formularios | react-hook-form 7 |
| Virtualización | @tanstack/react-virtual 3 |
| Backend | Supabase (PostgreSQL, Realtime, RLS) |
| Testing | Vitest 4 + Playwright 1.59 |
| Storybook | Storybook 8.6 (React Vite) |
| IA | Google Generative AI (@google/genai) |
| Charts | Recharts 3.7 |
| Export | xlsx + PDF |
| CI/CD | GitHub Actions + Vercel |

## Comandos esenciales

```bash
npm install
npm run dev          # Servidor desarrollo (Vite HMR)
npm run build        # Build producción (PWA incluido)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (671 tests, 45 archivos)
npm run test:e2e     # Playwright (5 specs, 79 tests)
npm run verify:full  # lint + typecheck + test + build + e2e
npm run check:sync   # Validar seed↔schema sync
npm run check:bundle # Validar tamaños de bundle
npm run storybook    # Storybook dev en :6006
npm run build-storybook # Build estático de Storybook
npm run format       # Prettier
```

## Estructura del proyecto

```text
App.tsx                    # Shell principal, lazy loading, routing
appNavigation.ts           # Definición de navegación (14 vistas)
appSummaries.ts            # Resúmenes por módulo
types.ts                   # 64+ tipos/interfaces de dominio
translations.ts            # i18n (en/es, ~534 keys)
index.tsx                  # Entry point React
index.css                  # Estilos globales + Tailwind

api/                       # Capa API centralizada (Supabase CRUD)
  index.ts                 # Re-exports: deals, marketData, config, audit, entities, reportSchedules, observability
  deals.ts                 # Operaciones CRUD de deals
  marketData.ts            # Curvas y datos de mercado
  config.ts                # Configuración
  audit.ts                 # Audit logging
  entities.ts              # Gestión de entidades
  reportSchedules.ts       # Programación de reportes
  observability.ts         # Observabilidad y métricas
  mappers.ts               # snake_case ↔ camelCase

constants/
  regulations.ts           # Constantes regulatorias

contexts/
  AuthContext.tsx           # Sesión, login demo/OAuth
  DataContext.tsx           # Datos de negocio (deals, curves, rules, ESG)
  UIContext.tsx             # Vista activa, idioma, tema, modales
  GovernanceContext.tsx     # Workflow de aprobación y governance
  MarketDataContext.tsx     # Estado de datos de mercado
  EntityContext.tsx         # Gestión multi-entidad
  WalkthroughContext.tsx    # Guía interactiva / onboarding

hooks/
  useAudit.ts              # Hook de auditoría
  useBatchPricing.ts       # Pricing en lote
  useNotifications.ts      # Sistema de notificaciones
  useOfflineStatus.ts      # Detección offline
  usePricingContext.ts      # Contexto de pricing
  useSupabaseSync.ts       # Hydration + fallback offline
  useUniversalImport.ts    # Importación universal
  queries/                 # React Query hooks
    queryKeys.ts
    useConfigQueries.ts
    useDealsQuery.ts
    useMarketDataQueries.ts
  supabaseSync/            # Módulos de sync descompuestos
    syncUtils.ts
    useConfigPersistence.ts
    useInitialHydration.ts
    usePresenceAndSessionAudit.ts
    useRealtimeSync.ts

components/
  Calculator/              # Pricing: input, levers, receipt, scenarios
  Blotter/                 # Deal management, committee dossier
  Config/                  # Rules, rate cards, ESG grids, master data, governance
  MarketData/              # Yield curves, market sources
  Behavioural/             # Modelos NMD, CPR
  Accounting/              # Ledger, entries, summary
  Reporting/               # 10 dashboards (overview, executive, PnL, NII, etc.)
  Risk/                    # Stress testing / shocks
  RAROC/                   # RAROC calculator, breakdown, metrics
  Intelligence/            # AI chat (Gemini)
  Admin/                   # User mgmt, audit log
  Docs/                    # User manual
  ui/                      # Shared: Sidebar, Header, Drawer, Toast, ErrorBoundary, etc.

utils/
  pricingEngine.ts         # Motor FTP principal (19 gaps)
  rarocEngine.ts           # Motor RAROC
  ruleMatchingEngine.ts    # Matching deals → reglas por scoring
  pricingContext.ts         # Contexto de pricing
  pricingConstants.ts      # Tablas regulatorias (LCR, NSFR, Basel III)
  seedData.ts              # Datos mock para modo offline
  validation.ts            # Validación de inputs
  dealWorkflow.ts          # Transiciones de estado de deals
  governanceWorkflows.ts   # Flujos de governance
  errorTracking.ts         # Tracking de errores
  logger.ts                # Logger centralizado
  localCache.ts            # Cache local
  configExport.ts          # Export de configuración
  excelUtils.ts            # Utilidades Excel
  pdfExport.ts             # Generación PDF
  mlEngine.ts              # Motor ML
  portfolioAnalytics.ts    # Analytics de cartera
  regulatoryReporting.ts   # Reporting regulatorio
  aiGrounding.ts           # Grounding para IA
  dealFormResolver.ts      # Resolución de formularios
  generateId.ts            # Generación de IDs
  storage.ts               # Abstracción storage
  pricingWorker.ts         # Web Worker para pricing
  supabaseClient.ts        # Cliente Supabase
  pricing/                 # Motor de pricing modularizado
    curveUtils.ts
    formulaEngine.ts
    liquidityEngine.ts
    index.ts
  supabase/                # Servicios especializados / infraestructura
    approvalService.ts, audit.ts, auditTransport.ts, mappers.ts,
    marketDataIngestionService.ts, masterData.ts, methodologyService.ts, monitoring.ts,
    portfolioReportingService.ts, rules.ts, shared.ts, systemConfig.ts
  __tests__/               # 26 archivos, 67 suites, 328 tests

supabase/
  schema.sql               # Schema v1 (legacy)
  schema_v2.sql            # Schema principal de referencia
  fix_rls_realtime.sql     # Fixes de RLS
  migrations/              # 14 migraciones secuenciales
  functions/pricing/       # Edge Function (Deno)

e2e/                       # 5 specs Playwright (+ mock API compartida)
  auth.spec.ts
  deal-blotter.spec.ts
  example.spec.ts
  mockApi.ts
  navigation.spec.ts
  pricing-flow.spec.ts

scripts/
  check-bundle-size.ts     # Validación de bundle sizes
  check-seed-schema-sync.ts # Sync seed↔schema

docs/
  api-spec.yaml            # Especificación API
  pricing-methodology.md   # Metodología FTP (19 gaps)
  supabase-setup.md        # Guía de setup Supabase
```

## Arquitectura y flujo de datos

- `App.tsx` actúa como shell principal y delega la composición de vistas a workspaces/componentes de dominio. Calculator, vistas secundarias y modales pesados ya cargan vía `React.lazy()`.
- `AuthContext` gestiona sesión y login demo/OAuth con Google.
- `DataContext` mantiene los datos de negocio: deals, curves, rules, users, ESG grids, approval matrix.
- `UIContext` controla vista activa, idioma, tema y modales.
- `GovernanceContext` gestiona flujos de aprobación y governance de cambios metodológicos.
- `MarketDataContext` centraliza el estado de curvas y datos de mercado.
- `api/` proporciona la capa CRUD pública y centralizada (9 módulos: deals, marketData, config, audit, entities, reportSchedules, notifications, observability, mappers) sobre Supabase con mappers snake_case↔camelCase.
- `utils/supabase/` queda para servicios especializados no-CRUD (`approvalService`, `monitoring`, `marketDataIngestionService`, `methodologyService`, etc.) e infraestructura compartida.
- `hooks/queries/` usa React Query para data fetching con cache, invalidación y query keys centralizadas.
- `hooks/supabaseSync/` descompone la hidratación en: initial hydration, realtime sync, config persistence y presence.
- `useSupabaseSync` hidrata desde Supabase y hace fallback a seed/mock data cuando no hay conexión.
- `pricingEngine.calculatePricing()` es el núcleo del cálculo FTP, consumido por calculator, blotter, reporting, shocks y accounting.
- `utils/pricing/` contiene el motor modularizado: curveUtils, formulaEngine, liquidityEngine.

## Convenciones de código

### TypeScript

- `strict` activado.
- Preferir `import type`.
- Evitar `any` si existe un tipo razonable.
- Interfaces y tipos de dominio en `types.ts` cuando son compartidos.
- Usar unions string literal, no `enum`, para estados y categorías.

### React

- Solo componentes funcionales.
- Respetar `react-hooks/rules-of-hooks`.
- `react-hooks/exhaustive-deps` está activo como warning: corregir dependencias reales, no silenciarlas porque sí.
- Estado global vía Context; no introducir Redux/Zustand sin una razón fuerte.
- Extraer helpers y subcomponentes cuando un archivo mezcla demasiada lógica derivada y render.

### Estilo y UI

- Tailwind utility-first.
- Mantener el lenguaje visual NFQ ya implantado.
- Reutilizar `components/ui/` y tokens existentes antes de crear variantes nuevas.
- Soportar desktop y mobile; no asumir layouts solo para widescreen.

### Organización

- Un componente por fichero cuando la pieza tenga responsabilidad propia.
- Utilidades puras en `utils/` o `featureUtils.ts`.
- Tests de utilidades en `utils/__tests__/` o cerca del módulo cuando convenga.

## Reglas de dominio financiero

- No hardcodear valores financieros si pueden derivarse de curvas, reglas o parámetros.
- Diferenciar claramente tasas internas, margen comercial y output mostrado.
- Tratar shocks como alteraciones del contexto de pricing, no como atajos visuales.
- Mantener coherencia entre FTP, `finalClientRate`, margen y RAROC.
- No mezclar divisas en agregados “consolidados” sin dejar explícito que son breakdowns por currency o convertir previamente.

## Motor de pricing

El motor cubre, entre otros, estos bloques:

- Fórmulas por producto.
- Liquidity premium y curvas duales.
- CLC / LCR charge.
- NSFR charge.
- Liquidity recharge.
- Capital charge y capital income.
- Effective tenors: DTM, RM, BM.
- Currency basis.
- Incentivisation.
- SDR modulation.
- ESG transition y physical.
- Greenium / Movilización (descuento por formato green).
- DNSH Capital Discount (reducción capital por cumplimiento DNSH).
- ESG Pillar I / ISF (Infrastructure Supporting Factor, Art. 501a CRR2).
- RAROC y economic profit.

## Vistas y navegación

14 vistas organizadas en 2 grupos (definidas en `appNavigation.ts`):

**Principales (10):**
| Vista | ID | Sección |
|-------|----|---------|
| Pricing Engine | CALCULATOR | Pricing |
| RAROC Terminal | RAROC | Pricing |
| Stress Testing | SHOCKS | Pricing |
| Deal Blotter | BLOTTER | Portfolio |
| Accounting Ledger | ACCOUNTING | Portfolio |
| ALM Reporting | REPORTING | ALM & Risk |
| Yield Curves | MARKET_DATA | ALM & Risk |
| Rules & Config | METHODOLOGY | Configuration |
| Behavioural Models | BEHAVIOURAL | Configuration |
| AI Assistant | AI_LAB | Intelligence |

**Bottom nav (4):**
User Configuration, User Management, System Audit, User Manual.

## Testing

- **Unit**: Vitest 4 — 26 archivos, 67 suites, 328 tests. Colocados en `utils/__tests__/` y `components/*/__tests__/`.
- **E2E**: Playwright 1.59 — 5 specs (auth, deal-blotter, navigation, pricing flow, example).
- **Component**: Storybook 8.6 — stories en `*.stories.tsx` junto al componente.
- Para cálculos financieros usar `toBeCloseTo`.
- Cualquier cambio en `pricingEngine`, `ruleMatchingEngine`, accounting derivation o helpers críticos debería venir con test nuevo o ajuste explícito.
- Antes de push: `npm run verify:full`.
- Scripts de validación: `npm run check:sync` (seed↔schema), `npm run check:bundle` (bundle sizes).

## Base de datos y Supabase

- `supabase/schema_v2.sql` es la referencia principal de schema.
- 14 migraciones secuenciales en `supabase/migrations/`.
- `api/` es la capa CRUD centralizada — usar `api/mappers.ts` para conversión snake_case↔camelCase.
- `utils/supabase/` queda para adapters legacy residuales y servicios especializados (approval, audit, monitoring, methodology, reporting, etc.).
- Si cambias contratos de datos, revisar: `types.ts`, `api/mappers.ts` y los adapters/servicios que aún cuelgan de `utils/supabase/`.
- Mantener RLS y realtime en tablas nuevas cuando corresponda.
- En modo offline, degradar funcionalidad realtime de forma segura; no romper la app por ausencia de credenciales.
- Edge Function de pricing en `supabase/functions/pricing/` (Deno runtime).

## Git y cambios

- Commits con prefijos claros: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `security`.
- Al tocar ramas antiguas, revisar si ya están absorbidas por `main` antes de intentar remezclarlas.
- No meter artefactos como `playwright-report/` o `test-results/`.
- CI: GitHub Actions (`ci.yml`), deploy automático a Vercel.

## Áreas sensibles

- `pricingEngine.ts` + `utils/pricing/`: cualquier cambio puede impactar calculator, reporting, shocks, accounting y tests.
- `types.ts`: 64+ tipos exportados, cambios pequeños pueden tener mucho alcance.
- `useSupabaseSync.ts` + `hooks/supabaseSync/`: tocar con cuidado para no romper fallback offline.
- `api/mappers.ts`: errores en mapeo afectan toda la persistencia.
- `GovernanceContext.tsx`: flujos de aprobación dependen de este contexto.
- Módulos de reporting y config: suelen mezclar bastante lógica derivada y merecen refactors incrementales.

## Pitfalls comunes

- `seedData.ts` y Supabase pueden divergir si se cambia uno sin revisar el otro. Usar `npm run check:sync` para verificar.
- Las ramas antiguas pueden traer documentación útil pero también supuestos desactualizados.
- Recharts y ciertos módulos lazy pueden introducir warnings no bloqueantes; distinguirlos de errores reales.
- Un “fix visual” en calculator o shocks puede esconder un bug de negocio si cambia outputs y no solo layout.
- React Query cache puede enmascarar datos stale si no se invalida correctamente.

## Tips para agentes

- Antes de modificar pricing, entender qué consumidor usa ese output.
- Antes de tocar una pantalla grande, localizar primero qué parte es lógica derivada y cuál es solo render.
- Si un cambio afecta persistencia, revisar `api/`, `utils/supabase/` y auditoría.
- Usar `hooks/queries/queryKeys.ts` para invalidar cache de React Query correctamente.
- Si aparece conflicto en documentación, preferir una versión fusionada y actualizada al estado real del repo.
- Component stories en Storybook pueden usarse para desarrollo visual aislado (`npm run storybook`).
