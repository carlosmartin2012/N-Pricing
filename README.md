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
| **Pricing Engine** | Motor FTP con 16 componentes (gaps): base rate, liquidity premium, LCR/NSFR charges, ESG, capital charge, RAROC |
| **RAROC Terminal** | Calculadora RAROC standalone con desglose completo de rentabilidad ajustada al riesgo |
| **Deal Blotter** | Gestion de operaciones con workflow de aprobacion (Draft → Pending → Approved → Booked) |
| **ALM Reporting** | Dashboards de NII Sensitivity, Maturity Ladder, Currency Gap, LCR/NSFR ratios |
| **Market Data** | Curvas de tipos (yield curves) con CRUD, bootstrap zero coupon, liquidity curves |
| **Stress Testing** | Shocks dashboard para analisis de sensibilidad (+100bps, -50bps, etc.) |
| **Behavioural Models** | Modelos NMD (Parametric + Caterpillar) y Prepayment CPR para productos no deterministicos |
| **Methodology Config** | Sistema de reglas flexible: asignacion de metodologia por producto, segmento, BU y tenor |
| **ESG Integration** | Grids de riesgo de transicion y riesgo fisico con ajustes en bps al pricing |
| **AI Assistant** | Asistente Gemini con contexto de cartera y mercado para analisis inteligente |
| **Accounting Ledger** | Asientos contables automaticos por operacion |
| **User Management** | RBAC (Admin, Trader, Risk_Manager, Auditor) con audit trail inmutable |

## Arquitectura

```
React 19 SPA (Vite)
├── 3 Context Providers (Auth, Data, UI)
├── Code-splitting con React.lazy (15 modulos)
├── Supabase Realtime (sync multi-usuario)
├── PostgreSQL con RLS por rol
└── Google OAuth + Session timeout 8h
```

**Flujo de datos**: Supabase-first hydration → mock fallback → localStorage cache → Realtime subscriptions.

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
npm run dev        # Servidor de desarrollo con HMR
npm run build      # Build de produccion optimizado
npm run preview    # Preview del build de produccion
npm run test       # Ejecutar tests unitarios (Vitest)
npm run lint       # Analisis estatico (ESLint)
npm run format     # Formateo automatico (Prettier)
```

## Estructura del proyecto

```
src/
├── components/          # Componentes React organizados por dominio
│   ├── Calculator/      # Pricing: input, visualizer, receipt
│   ├── Blotter/         # Deal management
│   ├── Config/          # Methodology rules, rate cards, ESG grids
│   ├── MarketData/      # Yield curves
│   ├── Reporting/       # ALM dashboards
│   ├── Risk/            # Stress testing
│   ├── RAROC/           # RAROC calculator
│   ├── Behavioural/     # NMD/CPR models
│   ├── Intelligence/    # AI assistant (Gemini)
│   ├── Accounting/      # Ledger
│   ├── Admin/           # User mgmt, audit log
│   └── ui/              # Shared UI (Sidebar, Header, modals)
├── contexts/            # React Context providers (Auth, Data, UI)
├── hooks/               # Custom hooks (Supabase sync, audit, import)
├── utils/               # Business logic pura (pricing engine, RAROC, rules)
├── supabase/            # SQL schemas y migrations
└── public/              # Assets estaticos
```

## Motor de Pricing (FTP)

El motor implementa la formula FTP completa con 16 componentes:

```
FTP = BaseRate + LiquidityPremium + LCR_Charge + NSFR_Charge
    + CurrencyBasis + CreditCost + OperationalCost + CapitalCharge
    + ESG_Adjustment + StrategicSpread ± Incentivisation
```

Soporta 4 metodologias: **Matched Maturity**, **Moving Average**, **Rate Card** y **Zero Discount**.

Ver documentacion detallada en [CLAUDE.md](./CLAUDE.md).

## Testing

```bash
npm run test
```

Tests unitarios con Vitest cubriendo:
- Interpolacion de curvas de tipos
- Resolucion de tenors efectivos (DTM, BM, RM)
- Calculo FTP completo (activos, pasivos, multi-divisa)
- RAROC y EVA
- Tablas regulatorias (LCR outflow, NSFR factors)
- Bootstrap zero coupon

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

- **Frontend**: React 19 + TypeScript 5.8 + Tailwind CSS 3
- **Build**: Vite 6.2 con code-splitting
- **Backend**: Supabase (PostgreSQL 15+, Realtime, RLS)
- **Auth**: Google OAuth + JWT
- **AI**: Google Gemini (@google/genai)
- **Charts**: Recharts 3.7
- **Export**: SheetJS (xlsx)
- **CI/CD**: GitHub Actions + Vercel

## Documentacion adicional

- [CLAUDE.md](./CLAUDE.md) — Contexto tecnico completo para agentes IA
- [agents.md](./agents.md) — Guia de colaboracion para agentes IA
- [APP_INFO.md](./APP_INFO.md) — Resumen ejecutivo del proyecto

## Licencia

Proyecto privado. Todos los derechos reservados.
