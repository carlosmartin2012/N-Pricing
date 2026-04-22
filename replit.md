# N-Pricing — Replit Migration

## Overview
N-Pricing is a Funds Transfer Pricing (FTP) SPA originally built with Vite + React on Vercel/Supabase, migrated to Replit with built-in PostgreSQL. Full-stack: Express backend on port 3001 (dev) or `PORT` env var (prod), served from a single port in production.

## Tech Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind, TanStack Query, Recharts, Gemini AI
- **Backend**: Express + pg (no ORM), port 3001 dev / `PORT` prod
- **DB**: Replit PostgreSQL (migrated from Supabase)
- **Auth**: JWT (8h expiry, stored as `n_pricing_auth_token` in localStorage)

## Important Files
| File | Purpose |
|------|---------|
| `server/migrate.ts` | Schema creation — runs on every server start |
| `server/index.ts` | Express entry point |
| `scripts/seed-demo-dataset.ts` | Seeds demo entity `00000000-0000-0000-0000-000000000010` |
| `hooks/supabaseSync/useInitialHydration.ts` | Fetches data from API on login |
| `contexts/AuthContext.tsx` | Auth state + session validation |
| `utils/apiFetch.ts` | HTTP client — sends Bearer token + `x-entity-id` header |
| `utils/activeEntity.ts` | Resolves which entity ID to use per data mode |
| `server/routes/customer360.ts` | Customer 360 API (uses `client_positions` table) |

## Demo Credentials
- **User**: `demo` (env `VITE_DEMO_USER`)
- **Email**: `demo@nfq.es` (env `VITE_DEMO_EMAIL`)
- **Pass**: env `VITE_DEMO_PASS`
- **Default entity**: `00000000-0000-0000-0000-000000000010` (NFQ Spain)

## Production Data (entity `00000000-0000-0000-0000-000000000010`)
| Table | Rows |
|-------|------|
| clients | 8 |
| deals | 10 |
| client_positions | 72 |
| client_ltv_snapshots | 6 |
| client_nba_recommendations | 53 |
| pricing_campaigns | 3 |
| model_inventory | 4 |

Clients with full Customer 360 profiles: CL-1001 (Acme Corp, 33 pos), CL-1002 (Globex Retail, 22 pos), CL-2001 (John Doe Properties, 11 pos).

## Key Architectural Decisions
- **Table naming**: `client_positions` (not `customer_positions`)
- **UUID constraint**: Only hex chars (0-9, a-f) in UUIDs
- **Data modes**: DEMO (JS mock data) vs LIVE (API → PostgreSQL)
- **Sync status**: `synced` = remote data loaded, `mock` = using JS mock data, `error` = fetch failed
- **Entity scoping**: All queries filtered by `entity_id` via `x-entity-id` request header
- **Valid roles**: Admin, Trader, Risk_Manager, Auditor

## Session / Auth Bug Fixes
- **Stale session detection** (`AuthContext`): On mount, if the JWT token is missing or session expiry has elapsed, the cached user profile is cleared immediately — prevents "ghost login" state where user appears authenticated but all API calls fail with 401, causing permanent FALLBACK mode.
- **401 event handler** (`apiFetch` + `AuthContext`): When any API call receives a 401, `apiFetch` dispatches a `auth:token-expired` window event; `AuthContext` listens and calls `clearSession()` to redirect the user to login instead of leaving the app stuck in FALLBACK.

## Common Gotchas
- `ON CONFLICT DO NOTHING` returns 0 rows on re-runs (not an error — data already exists)
- `api/entities.ts` uses double path segments: `/entities/entities`, `/entities/entity-users`
- In DEMO mode, `resolveActiveEntityId()` always returns `DEFAULT_ENTITY_ID`
- "Trader Trainee" role falls back to "Trader" in `liteTenancyMiddleware`
- Google SSO requires `VITE_GOOGLE_CLIENT_ID` env var
