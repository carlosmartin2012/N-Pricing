# CLAUDE.md — N-Pricing

> Contexto esencial para agentes IA que trabajan en este repositorio.

## Qué es N-Pricing

Motor de **Funds Transfer Pricing (FTP)** para instituciones financieras. Calcula tasas de transferencia internas entre unidades de negocio, análisis de rentabilidad (RAROC), costes regulatorios (LCR/NSFR) y ajustes ESG.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 5.8, Tailwind CSS 3 |
| Iconos | Lucide React |
| Build | Vite 6.2 (code-splitting con React.lazy) |
| Estado | React Context API (3 providers: Auth, Data, UI) + localStorage fallback |
| Backend | Supabase (PostgreSQL 15+, Realtime, RLS) |
| Testing | Vitest 4.0 (unit), Playwright (E2E) |
| IA | Google Generative AI (@google/genai — Gemini) |
| Auth | Google OAuth (@react-oauth/google) + demo login |
| Charts | Recharts 3.7 |
| Export | xlsx (SheetJS) |
| CI/CD | GitHub Actions → Vercel |

## Comandos esenciales

```bash
npm install          # Instalar dependencias (usa --legacy-peer-deps via .npmrc)
npm run dev          # Servidor de desarrollo (Vite)
npm run build        # Build de producción
npm run test         # Tests unitarios (vitest run)
npm run lint         # ESLint
npm run format       # Prettier
npm run test:e2e     # Tests E2E (Playwright, requiere dev server)
```

## Estructura del proyecto

```
├── App.tsx                          # Root: routing por ViewState, login gate
├── index.tsx                        # Entry point (React 19 createRoot)
├── types.ts                         # Todas las interfaces del dominio (~345 líneas)
├── constants.ts                     # Mock data + configuración inicial
├── translations.ts                  # i18n (en/es)
│
├── contexts/
│   ├── AuthContext.tsx               # Sesión, Google OAuth, timeout 8h
│   ├── DataContext.tsx               # Estado de dominio (deals, clients, rules, curves...)
│   └── UIContext.tsx                 # Vista activa, idioma, tema, modales
│
├── hooks/
│   ├── useSupabaseSync.ts            # Hydration Supabase-first → mock fallback + realtime
│   ├── useUniversalImport.ts         # Import masivo Excel/CSV
│   ├── useAudit.ts                   # Escritura en audit_log
│   └── useBatchPricing.ts            # Batch pricing con Web Workers
│
├── utils/
│   ├── pricingEngine.ts              # ⭐ Motor FTP principal (~900 líneas, 16 gaps)
│   ├── rarocEngine.ts                # Calculadora RAROC standalone
│   ├── ruleMatchingEngine.ts         # Matching de reglas por scoring
│   ├── portfolioAnalytics.ts         # KPIs agregados de cartera
│   ├── dealWorkflow.ts               # Máquina de estados del deal
│   ├── validation.ts                 # Validación de deals
│   ├── supabaseService.ts            # Capa de servicio Supabase (CRUD + realtime)
│   ├── supabaseClient.ts             # Cliente Supabase singleton
│   ├── storage.ts                    # localStorage helpers
│   ├── excelUtils.ts                 # Export Excel branded
│   ├── pricingConstants.ts           # Tablas regulatorias (LCR outflow, NSFR factors)
│   ├── generateId.ts                 # UUID generator
│   ├── pricingWorker.ts              # Web Worker para batch pricing
│   ├── logger.ts                     # Structured logging (dev: all, prod: warn+error)
│   ├── seedData.ts                   # Fuente única de datos mock/seed
│   ├── pricing/                      # Módulos del motor de pricing (descompuesto)
│   │   ├── curveUtils.ts             # Interpolación de curvas, bootstrap zero coupon
│   │   ├── liquidityEngine.ts        # LP, LCR, NSFR, LR, SDR
│   │   ├── formulaEngine.ts          # Fórmulas por producto, credit cost, behavioural
│   │   └── index.ts                  # Re-exports
│   └── __tests__/
│       ├── pricingEngine.test.ts     # Tests del motor de pricing
│       ├── ruleMatchingEngine.test.ts # Tests del motor de reglas
│       ├── dealWorkflow.test.ts      # Tests de workflow de deals
│       └── validation.test.ts        # Tests de validación
│
├── components/
│   ├── Calculator/                   # DealInputPanel, MethodologyVisualizer, PricingReceipt
│   ├── Blotter/                      # DealBlotter (gestión de operaciones)
│   ├── Config/                       # MethodologyConfig + tabs (RateCards, MasterData, ESG, Rules)
│   ├── MarketData/                   # YieldCurvePanel (curvas + CRUD)
│   ├── Behavioural/                  # Modelos NMD/CPR
│   ├── Accounting/                   # Ledger contable
│   ├── Reporting/                    # ALM: NIISensitivity, MaturityLadder, CurrencyGap, Dashboard
│   ├── Risk/                         # ShocksDashboard (stress testing)
│   ├── RAROC/                        # RAROCCalculator
│   ├── Intelligence/                 # GenAIChat + GeminiAssistant (IA contextual)
│   ├── Admin/                        # UserManagement, AuditLog
│   ├── Docs/                         # UserManual
│   └── ui/                           # Sidebar, Header, Login, Modals, ErrorBoundary
│
├── supabase/
│   ├── schema.sql                    # Schema V1 (legacy)
│   ├── schema_v2.sql                 # Schema V2 (producción): 16 tablas, RLS, triggers
│   ├── migrations/
│   │   ├── 001_rule_versioning.sql   # Versionado de reglas
│   │   └── 002_multi_tenant.sql      # Soporte multi-tenant
│   └── functions/
│       └── pricing/index.ts          # Edge Function scaffold para pricing server-side
│
├── e2e/                              # Tests E2E (Playwright)
│   └── example.spec.ts
├── playwright.config.ts
│
├── docs/
│   ├── pricing-methodology.md        # Documentación funcional de los 16 gaps
│   └── supabase-setup.md             # Guía de setup de Supabase
│
├── public/assets/                    # Logos
├── .github/workflows/ci.yml         # CI: build + test + lint
├── .env.example                      # Variables de entorno requeridas
├── vercel.json                       # Configuración deploy Vercel
└── metadata.json                     # Metadata del proyecto
```

## Arquitectura y flujo de datos

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  AuthContext │     │  DataContext  │     │   UIContext      │
│  (sesión)    │     │  (dominio)   │     │  (vista/idioma)  │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘
       │                   │                      │
       └───────────┬───────┘──────────────────────┘
                   │
            ┌──────▼──────┐
            │   App.tsx   │  ← ViewState routing
            └──────┬──────┘
                   │
     ┌─────────────┼─────────────────┐
     │             │                 │
  Calculator    Blotter         Reporting...
     │
     ├── DealInputPanel   (entrada)
     ├── MethodologyVisualizer (regla matcheada)
     └── PricingReceipt   (resultado FTP)
           │
           ▼
    pricingEngine.calculatePricing()
           │
           ▼
    supabaseService.upsertDeal() → Supabase (realtime → otros usuarios)
```

**Patrón de hidratación**: Supabase-first → si falla, mock data de `constants.ts` → localStorage como cache intermedia.

## Motor de pricing — Los 16 Gaps

El motor FTP (`pricingEngine.ts`) implementa 16 componentes ("gaps"):

| # | Gap | Descripción |
|---|-----|------------|
| 1 | Product Formula | Selección de fórmula por producto/categoría |
| 2 | Liquidity Premium | Curvas duales (secured/unsecured) interpoladas |
| 3 | Liquidity Recharge | Asignación de coste buffer HQLA a BUs |
| 4 | LCR Charge (CLC) | Coste de liquidez por outflow LCR |
| 5 | NSFR Charge | Factor RSF activos + beneficio ASF pasivos |
| 6 | RAROC & Capital Income | Rentabilidad ajustada al riesgo |
| 7 | Zero Coupon Bootstrap | Conversión par yield → zero rates |
| 8 | Secured LP | Ajuste por haircut colateral |
| 9 | Effective Tenors | DTM, RM, BM (behavioral maturity) |
| 10 | Currency Basis | Ajuste cross-currency swap |
| 11 | Incentivisation | Subsidios por producto/segmento |
| 12 | SDR Modulation | Beneficio por ratio depósitos estables |
| 13 | Portfolio Analytics | KPIs agregados por BU |
| 14 | Deposit Stability | Clasificación automática estabilidad |
| 15 | Repricing Maturity | RM distinto de DTM |
| 16 | EAD | Exposure at Default separada del drawn |

## Fórmula FTP principal

```
TechnicalPrice = BaseRate(DTM|BM|RM)
               + LiquidityPremium (± SDR modulation)
               + LiquidityRecharge
               + CLC (LCR charge)
               + NSFR charge
               + CurrencyBasis
               + CreditCost (PD × LGD)
               + OperationalCost
               + CapitalCharge (RW × K% × (ROE - Rf))
               + ESG (transition + physical)
               + StrategicSpread
               ± Incentivisation

FinalClientRate = TechnicalPrice + MarginTarget
RAROC = (Revenue - CoF - ECL - OpCost + CapitalIncome) / RegulatoryCapital
```

## Base de datos (Supabase)

**Schema V2** (`supabase/schema_v2.sql`): 16 tablas con RLS.

Tablas principales: `deals`, `pricing_results`, `clients`, `products`, `business_units`, `rules`, `users`, `behavioural_models`, `yield_curves`, `rate_cards`, `liquidity_curves`, `esg_transition_grid`, `esg_physical_grid`, `incentivisation_rules`, `approval_matrix`, `audit_log`.

**Políticas RLS**:
- Deals no-booked: cualquier usuario autenticado puede modificar
- Deals booked: solo Admin/Risk_Manager
- Audit log: insert-only, inmutable (trigger bloquea UPDATE/DELETE)
- Tablas de referencia: Admin/Risk_Manager escriben, todos leen

## Seguridad

- **Auth**: Google OAuth (dominio @nfq.es) + demo login
- **Sesión**: Timeout 8 horas con tracking de actividad
- **RLS**: Políticas por rol en todas las tablas
- **Secrets**: Variables de entorno via Vite (nunca hardcoded)
- **Audit**: Trail inmutable en audit_log

## Variables de entorno requeridas

```env
VITE_SUPABASE_URL=         # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=    # Anon key (bajo privilegio)
VITE_GOOGLE_CLIENT_ID=     # Google OAuth client ID
VITE_GEMINI_API_KEY=       # API key de Gemini (opcional, para IA)
VITE_DEMO_USER=            # Usuario demo (opcional)
VITE_DEMO_PASS=            # Password demo (opcional)
VITE_DEMO_EMAIL=           # Email demo (opcional)
```

## Convenciones de código

- **TypeScript strict mode** — todas las interfaces en `types.ts`
- **Componentes**: PascalCase, un fichero por componente, export default para lazy loading
- **Utils**: camelCase, funciones puras cuando es posible
- **Tests**: colocados en `__tests__/` junto al módulo
- **Commits**: formato `feat|fix|chore|security: Round N — descripción`
- **i18n**: claves en `translations.ts`, acceso via `ui.t.clave`
- **Estilos**: Tailwind CSS utility-first, tema dark por defecto

## Áreas que necesitan atención

1. **pricingEngine.ts** es monolítico (~900 líneas) — candidato a descomposición
2. **Tests**: Solo cubren pricingEngine; faltan tests para ruleMatchingEngine, dealWorkflow, portfolioAnalytics
3. **Datos mock vs DB**: `constants.ts` duplica seed data del schema SQL — riesgo de divergencia
4. **No hay E2E tests** — ni Playwright ni Cypress configurados
5. **Accesibilidad**: Falta soporte light mode real y ARIA labels
6. **storage.ts vs Supabase**: Potencial conflicto de fuentes de verdad

## Tips para agentes

- Antes de modificar `pricingEngine.ts`, leer y entender los 16 gaps y sus dependencias
- Los tests se ejecutan con `npm run test` — siempre correrlos tras cambios en utils/
- El schema de BD está en `supabase/schema_v2.sql` — si cambias tipos, actualizar también `types.ts`
- El estado global vive en los 3 contextos — no crear nuevos sin justificación
- Las traducciones están en `translations.ts` — cualquier texto visible necesita clave i18n
- El CI (`ci.yml`) ejecuta build + test + lint — asegurar que pasan antes de push
