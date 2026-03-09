# CLAUDE.md — N-Pricing

## Project Overview

N-Pricing is a **Funds Transfer Pricing (FTP) engine** for banking institutions. It calculates internal transfer rates between business units for profitability analysis and ALM risk assessment.

**Stack**: React 19 + TypeScript (strict) + Vite + Tailwind CSS + Recharts + Supabase

## Architecture

```
App.tsx              → Main dashboard & routing (SPA)
components/          → Feature modules (Calculator, Blotter, Config, Risk, RAROC, etc.)
components/ui/       → Shared UI components (Login, Sidebar, ErrorBoundary)
utils/               → Core engines (pricingEngine, rarocEngine, ruleMatchingEngine)
contexts/            → React contexts (Auth, Data, UI)
hooks/               → Custom hooks (useAudit, useSupabaseSync, useUniversalImport)
constants.ts         → Mock data & initial configurations
constants/           → Domain constants (regulations.ts)
types.ts             → All TypeScript interfaces for the domain model
supabase/            → Database schemas (schema.sql, schema_v2.sql)
```

## Code Conventions

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig)
- Use `type` imports for interfaces: `import type { Transaction } from '../types'`
- Unused vars with `_` prefix are allowed: `argsIgnorePattern: '^_'`
- `@typescript-eslint/no-explicit-any` is OFF — but avoid `any` when a proper type exists
- Interfaces go in `types.ts` — do NOT scatter type definitions across component files
- Use union string literals for enums: `'Asset' | 'Liability' | 'Off-Balance'`, not TypeScript `enum`

### React
- Functional components only — no class components
- React hooks rules enforced (`react-hooks/rules-of-hooks: error`)
- Exhaustive deps warning enabled (`react-hooks/exhaustive-deps: warn`)
- State management via React Context (`contexts/`) — no Redux, no Zustand
- Custom hooks prefixed with `use` in `hooks/` directory

### Styling
- Tailwind CSS utility classes — no CSS modules, no styled-components
- Responsive design with Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- Color palette follows banking/fintech conventions (slate, emerald for positive, rose for negative)

### File Organization
- One component per file — filename matches component name
- Components grouped by feature domain in `components/` subdirectories
- Shared utilities in `utils/`, shared UI in `components/ui/`

## Financial Domain Rules

### Critical: Calculation Integrity
- **NEVER hardcode financial values** — always derive from formulas or curve interpolation
- All rates in basis points (bps) internally, convert to % only for display
- Yield curve interpolation must be linear between known tenors
- Zero-rate bootstrapping must preserve no-arbitrage conditions
- RAROC calculations must include ALL cost components (capital, operational, liquidity, credit)

### FTP Methodologies
- **Matched Maturity**: Primary method — interpolate funding curve at deal's effective tenor
- **Rate Card**: Lookup-based pricing from approved rate card grids
- **Moving Average**: For non-maturing deposits — weighted average of historical rates
- **Zero Discount**: For long-dated deals — bootstrap zero curve from par curve

### Regulatory Compliance
- LCR outflow rates from `constants/regulations.ts` — match Basel III/CRR2 tables
- NSFR ASF/RSF factors must be regulatory-compliant
- Risk weights must align with standardized approach (SA-CR)
- Any regulatory parameter change requires a comment citing the regulation article

## Testing

- Framework: **Vitest**
- Tests in `utils/__tests__/` — colocated with source
- Run: `npm test` or `npx vitest run`
- Test naming: `describe('functionName')` → `it('describes expected behavior')`
- Financial calculations MUST have tests with known-good values
- Use `toBeCloseTo()` for floating-point comparisons, not `toBe()`

## Git Conventions

- Commit format: `type: description` (e.g., `feat: Add RAROC waterfall chart`)
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Branch naming: `feature/description`, `fix/description`
- PRs should describe WHAT changed and WHY

## Security

- API keys in `.env` — NEVER commit secrets
- Supabase RLS policies must be in place for all tables
- Google OAuth tokens handled via `@react-oauth/google` — no manual token storage
- `.env` is in `.gitignore`

## Common Pitfalls

- `constants.ts` has mock data — don't confuse with production data from Supabase
- `App.tsx` is large (~12K lines) — consider refactoring if adding new top-level features
- `recharts` v3 has React 19 compatibility warnings — these are known and non-blocking
- Vite path aliases use `@/*` mapping — configure in both `vite.config.ts` and `tsconfig.json`
