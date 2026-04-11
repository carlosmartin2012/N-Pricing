<div align="center">
<img width="1200" height="475" alt="N-Pricing Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# N-Pricing

**Motor de Funds Transfer Pricing (FTP) de alto rendimiento**

Calcula tasas de transferencia internas, RAROC, costes regulatorios y ajustes ESG para instituciones financieras.

[![CI](https://github.com/carlosmartin2012/n-pricing/actions/workflows/ci.yml/badge.svg)](https://github.com/carlosmartin2012/n-pricing/actions)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev)

</div>

---

## Funcionalidades principales

| Modulo | Descripcion |
|--------|-------------|
| **Pricing Engine** | Motor FTP con 19 componentes (gaps): base rate, liquidity premium, LCR/NSFR charges, ESG, capital charge, RAROC |
| **RAROC Terminal** | Calculadora RAROC standalone con desglose completo de rentabilidad ajustada al riesgo |
| **Deal Blotter** | Gestion de operaciones con workflow de aprobacion (Draft → Pending → Approved → Booked) y committee dossier |
| **ALM Reporting** | 10 dashboards: Overview, Executive, NII Sensitivity, Maturity Ladder, Currency Gap, PnL Attribution, Pricing Analytics, Funding Curves, Portfolio Snapshots, Behaviour Focus |
| **Market Data** | Curvas de tipos (yield curves) con CRUD, bootstrap zero coupon, liquidity curves, market data sources |
| **Stress Testing** | Shocks dashboard para analisis de sensibilidad con panel de control y visualizacion de impacto |
| **Behavioural Models** | Modelos NMD (Parametric + Caterpillar) y Prepayment CPR para productos no deterministicos |
| **Methodology Config** | Sistema de reglas, rate cards, ESG grids, master data, governance de cambios metodologicos |
| **ESG Integration** | Grids de riesgo de transicion, riesgo fisico, Greenium/Movilización, DNSH capital discount, ISF Pillar I overlay |
| **AI Assistant** | Asistente Gemini con grounding de contexto de cartera, mercado y chat con historial |
| **Accounting Ledger** | Asientos contables automaticos por operacion con detalle y summary cards |
| **User Management** | RBAC (Admin, Trader, Risk_Manager, Auditor) con audit trail inmutable y audit log con drawer de detalle |
| **User Manual** | Documentacion integrada para usuarios finales |

## Arquitectura

```
React 19 SPA (Vite + PWA)
├── 7 Context Providers (Auth, Data, UI, Governance, MarketData, Entity, Walkthrough)
├── Code-splitting con React.lazy (13 modulos lazy + Calculator eager)
├── React Query para data fetching con cache
├── Capa API centralizada (api/) con mappers
├── Supabase Realtime (sync multi-usuario)
├── PostgreSQL con RLS por rol
├── 14 migraciones secuenciales
└── Google OAuth + Session timeout 8h
```

**Flujo de datos**: API layer → Supabase-first hydration → mock fallback → React Query cache → Realtime subscriptions.

## Quick Start

### Prerrequisitos

- Node.js >= 18
- Cuenta Supabase (o modo offline con datos mock)

### Instalacion

```bash
# 1. Clonar el repositorio
git clone https://github.com/carlosmartin2012/n-pricing.git
cd n-pricing

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales (ver seccion Variables de Entorno)

# 4. Iniciar servidor de desarrollo
npm run dev
```

### Variables de entorno

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | Si | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Si | Anon key de Supabase |
| `VITE_GOOGLE_CLIENT_ID` | Si | Client ID de Google OAuth |
| `VITE_GEMINI_API_KEY` | No | API key de Gemini para el asistente IA |
| `VITE_DEMO_USER` | No | Usuario para login demo |
| `VITE_DEMO_PASS` | No | Password para login demo |
| `VITE_DEMO_EMAIL` | No | Email para login demo |

### Setup de Supabase

1. Crear un nuevo proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/schema_v2.sql` en el SQL Editor del proyecto
3. Habilitar Realtime en las tablas principales (deals, rules, clients, etc.)
4. Copiar la URL y anon key al `.env.local`

> **Modo offline**: La app funciona sin Supabase usando datos mock de `constants.ts`. Ideal para desarrollo y demos.

## Scripts disponibles

```bash
npm run dev            # Servidor de desarrollo con HMR
npm run build          # Build de produccion optimizado (PWA incluido)
npm run preview        # Preview del build de produccion
npm run test           # Tests unitarios (Vitest — 328 tests)
npm run test:e2e       # Tests E2E (Playwright — 14 specs)
npm run typecheck      # Verificacion de tipos TypeScript
npm run lint           # Analisis estatico (ESLint)
npm run format         # Formateo automatico (Prettier)
npm run verify:full    # Pipeline completo: lint + typecheck + test + build + e2e
npm run check:sync     # Validar sync seed↔schema
npm run check:data-quality # Validar integridad relacional y calidad del seed/config
npm run check:security # Scan de dependencias prod con excepciones gobernadas
npm run check:bundle   # Validar tamaños de bundle
npm run storybook      # Storybook dev en :6006
```

## Estructura del proyecto

```
├── api/                 # Capa API centralizada (CRUD Supabase + mappers)
├── components/          # Componentes React organizados por dominio (111 archivos)
│   ├── Calculator/      # Pricing: input, levers, receipt, scenarios, comparacion
│   ├── Blotter/         # Deal management, committee dossier
│   ├── Config/          # Rules, rate cards, ESG grids, master data, governance
│   ├── MarketData/      # Yield curves, market sources
│   ├── Reporting/       # 10 dashboards ALM
│   ├── Risk/            # Stress testing (shocks)
│   ├── RAROC/           # RAROC calculator, breakdown, metrics
│   ├── Behavioural/     # NMD/CPR models
│   ├── Intelligence/    # AI chat (Gemini) con historial
│   ├── Accounting/      # Ledger, entries, summary
│   ├── Admin/           # User mgmt, audit log con drawer
│   ├── Docs/            # User manual
│   └── ui/              # Shared: Sidebar, Header, Drawer, Toast, ErrorBoundary
├── constants/           # Constantes regulatorias
├── contexts/            # 7 Context providers (Auth, Data, UI, Governance, MarketData, Entity, Walkthrough)
├── hooks/               # Custom hooks + queries/ (React Query) + supabaseSync/
├── utils/               # Business logic: pricing engine, RAROC, rules, validation
│   ├── pricing/         # Motor modularizado (curves, formula, liquidity)
│   ├── supabase/        # 15 servicios Supabase especializados
│   └── __tests__/       # 26 archivos, 67 suites, 328 tests
├── supabase/            # SQL schemas, 14 migraciones, Edge Functions (Deno)
├── e2e/                 # 14 specs Playwright
├── scripts/             # Validacion: bundle sizes, seed↔schema sync, security audit, data quality
├── docs/                # API spec, pricing methodology, Supabase setup
└── public/              # Assets estaticos + PWA manifest
```

## Motor de Pricing (FTP)

El motor implementa la formula FTP completa con 19 componentes:

```
FTP = BaseRate + LiquidityPremium + LCR_Charge + NSFR_Charge
    + CurrencyBasis + CreditCost + OperationalCost + CapitalCharge
    + ESG_Adjustment + Greenium + StrategicSpread ± Incentivisation
    - DNSH_Capital_Discount - ISF_Pillar1_Overlay
```

Soporta 4 metodologias: **Matched Maturity**, **Moving Average**, **Rate Card** y **Zero Discount**.

Ver documentacion detallada en [CLAUDE.md](./CLAUDE.md).

## Testing

```bash
npm run test           # Unit tests (Vitest)
npm run test:e2e       # E2E tests (Playwright)
npm run storybook      # Component stories (Storybook)
```

**Unit tests** (328 tests en 26 archivos, 67 suites) cubriendo:
- Motor FTP completo (activos, pasivos, multi-divisa)
- Interpolacion de curvas de tipos
- Resolucion de tenors efectivos (DTM, BM, RM)
- RAROC, EVA y economic profit
- Tablas regulatorias (LCR outflow, NSFR factors)
- Bootstrap zero coupon
- Rule matching engine (scoring y fallback)
- Deal workflow (transiciones de estado)
- Governance workflows
- Validacion de inputs
- Audit transport y logging
- Portfolio snapshots y market data sources

**E2E tests** (14 specs): auth, navigation, pricing flow, deal blotter, governance, shocks, market data, ESG, multi-entity, AI assistant, offline queue y RBAC.

**Storybook**: component stories para desarrollo visual aislado.

## Deploy

### Vercel (recomendado)

1. Conectar el repositorio a Vercel
2. Configurar las variables de entorno en el dashboard de Vercel
3. Deploy automatico en cada push a `main`

```json
// vercel.json ya configurado con:
{
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build"
}
```

## Roles y permisos

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso total: configuracion, usuarios, aprobacion de deals |
| **Trader** | Crear/editar deals, ver reporting |
| **Risk_Manager** | Aprobar deals, modificar deals booked, configurar reglas |
| **Auditor** | Solo lectura + acceso a audit log |

## Tech Stack

- **Frontend**: React 19.2 + TypeScript 5.8 + Tailwind CSS 3
- **Build**: Vite 6.2 + vite-plugin-pwa (PWA con soporte offline)
- **Data fetching**: @tanstack/react-query 5 (cache, invalidacion, query keys)
- **Formularios**: react-hook-form 7
- **Virtualizacion**: @tanstack/react-virtual 3 (listas grandes)
- **Backend**: Supabase (PostgreSQL 15+, Realtime, RLS, Edge Functions)
- **Auth**: Google OAuth (@react-oauth/google) + JWT
- **AI**: Google Generative AI (@google/genai)
- **Charts**: Recharts 3.7
- **Export**: SheetJS (xlsx) + PDF
- **Testing**: Vitest 4 + Playwright 1.59 + Storybook 8.6
- **CI/CD**: GitHub Actions + Vercel

## Documentacion adicional

- [CLAUDE.md](./CLAUDE.md) — Contexto tecnico completo para agentes IA
- [agents.md](./agents.md) — Guia de colaboracion para agentes IA
- [APP_INFO.md](./APP_INFO.md) — Resumen ejecutivo del proyecto
- [docs/pricing-methodology.md](./docs/pricing-methodology.md) — Metodologia FTP (19 gaps)
- [docs/supabase-setup.md](./docs/supabase-setup.md) — Guia de setup Supabase
- [docs/security-baseline-2026-04.md](./docs/security-baseline-2026-04.md) — Baseline de seguridad, scan de dependencias y excepciones gobernadas
- [docs/api-spec.yaml](./docs/api-spec.yaml) — Especificacion API

## Licencia

Proyecto privado. Todos los derechos reservados.
