# N Pricing Application Information

## Project Overview
**N Pricing** is a high-performance Pricing Engine for **Funds Transfer Pricing (FTP)**. It is designed to help financial institutions calculate internal transfer rates between different business units, allowing for accurate profitability analysis and risk assessment. Available as a PWA with offline support.

## Key Features
- **Pricing Engine**: Core FTP motor with 19 components (gaps) — base rate, liquidity premium, LCR/NSFR charges, ESG adjustments, capital charge, and full RAROC calculation.
- **RAROC Terminal**: Standalone RAROC calculator with full risk-adjusted return breakdown and economic profit.
- **Deal Blotter**: Comprehensive deal management with approval workflow (Draft → Pending → Approved → Booked) and committee dossier generation.
- **ALM Reporting**: 10 specialized dashboards — Overview, Executive, NII Sensitivity, Maturity Ladder, Currency Gap, PnL Attribution, Pricing Analytics, Funding Curves, Portfolio Snapshots, and Behaviour Focus.
- **Market Data**: Yield curve workspace with CRUD, bootstrap zero coupon, liquidity curves, and market data sources panel.
- **Stress Testing**: Shock control panel and impact visualization for interest rate sensitivity analysis.
- **Behavioural Models**: NMD replication (Parametric + Caterpillar) and Prepayment CPR models for non-deterministic products.
- **Methodology Configuration**: Rule-based system with general rules, rate cards, ESG grids, master data management, and governance tab for methodology change workflows.
- **ESG Integration**: Transition risk and physical risk grids with basis point adjustments to pricing.
- **AI Assistant**: Gemini-powered chat with portfolio and market context grounding, chat history, and intelligent analysis.
- **Accounting Ledger**: Automatic journal entries per deal with entry detail view and summary cards.
- **User Management**: RBAC (Admin, Trader, Risk_Manager, Auditor) with immutable audit trail, audit log with detail drawer.
- **User Manual**: Integrated documentation for end users.

## Technology Stack
- **Frontend**: React 19.2, TypeScript 5.8, Tailwind CSS 3
- **Build**: Vite 6.2 + vite-plugin-pwa
- **Data Fetching**: @tanstack/react-query 5
- **Forms**: react-hook-form 7
- **Virtualization**: @tanstack/react-virtual 3
- **Icons**: Lucide React
- **Charts**: Recharts 3.7
- **Export**: SheetJS (xlsx) + PDF
- **AI Integration**: Google Generative AI (@google/genai)
- **Backend**: Supabase (PostgreSQL, Realtime, RLS, Edge Functions)
- **Auth**: Google OAuth (@react-oauth/google) + JWT
- **Testing**: Vitest 4 (328 tests, 67 suites) + Playwright 1.59 (4 E2E specs) + Storybook 8.6
- **CI/CD**: GitHub Actions + Vercel

## System Architecture
The application is structured as a Progressive Web App (PWA) with a modular component architecture:
- `App.tsx`: Main shell with lazy loading (13 lazy + 1 eager) and view routing.
- `api/`: Centralized API layer for all Supabase CRUD operations with snake_case/camelCase mappers.
- `contexts/`: 7 React Context providers — Auth, Data, UI, Governance, MarketData, Entity, Walkthrough.
- `hooks/`: Custom hooks including React Query wrappers (`queries/`) and decomposed Supabase sync (`supabaseSync/`).
- `components/`: 111 component files across 13 domain directories.
- `utils/`: Business logic — pricing engine (modularized in `pricing/`), RAROC engine, rule matching, validation.
- `utils/supabase/`: 15 specialized service modules for database operations.
- `constants/`: Regulatory constants.
- `types.ts`: 64+ TypeScript interfaces for the entire domain model.
- `translations.ts`: Full i18n support (English/Spanish, ~534 keys).

## Statistics
| Metric | Count |
|--------|-------|
| TypeScript/TSX files | 229 |
| Component files | 111 |
| Hook files | 17 |
| Utility files | 45 |
| Context providers | 7 |
| API modules | 9 |
| Unit tests | 328 (67 suites, 26 archivos) |
| E2E specs | 4 |
| Views/Modules | 14 |
| Exported types | 64+ |
| Translation keys | ~534 |
| Supabase migrations | 14 |
