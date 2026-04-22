# Runbook — Seed unified demo dataset

> **Purpose:** populate Postgres with a coherent demo dataset under the
> `DEFAULT_ENTITY_ID` so the UI's "Demo" mode can be switched to read from
> the real DB (same path as "Live" mode) without diverging from the in-memory
> JS mocks (`MOCK_CLIENTS`, `MOCK_PRODUCT_DEFS`, `MOCK_BUSINESS_UNITS`).
>
> This is **PR A** of a 2-PR plan. PR B will refactor `DataContext` to send
> `x-entity-id = DEFAULT_ENTITY_ID` in Demo mode, dropping the
> `enabled: dataMode === 'live'` guard on hooks. Until PR B lands, this seed
> is visible only to tooling/tests that query the DB directly.

## TL;DR

```bash
DATABASE_URL=postgres://... npm run seed:demo           # idempotent
DATABASE_URL=postgres://... npm run seed:demo -- --reset   # wipe + reseed Phase 6 rows
DATABASE_URL=postgres://... npm run seed:demo -- --dry-run # print plan, exit
```

Exit code 0 on success. Safe to run against the same DB repeatedly — every
INSERT uses `ON CONFLICT DO NOTHING` (or `DO UPDATE` on the LTV snapshot
unique key).

## What it seeds

| Table | Rows | Notes |
|---|---|---|
| `clients` | `MOCK_CLIENTS.length` (5) | CL-1001 … CL-4099. IDs match the JS catalogue. |
| `products` | `MOCK_PRODUCT_DEFS.length` (7) | LOAN_COMM, LOAN_MORT, DEP_CHECK, … |
| `business_units` | `MOCK_BUSINESS_UNITS.length` (5) | CORP, RETAIL, SME, PRIVBANK, TREAS |
| `client_positions` | ~6 | Three rich profiles: CL-1001 (Acme), CL-1002 (Globex ESG), CL-2001 (churn risk) |
| `client_metrics_snapshots` | 12 | 4 quarters × 3 clients (2025-Q3 … 2026-Q2) |
| `client_events` | 14 | Onboarding, deals, contact, churn signals, crosssell attempts |
| `client_ltv_snapshots` | 3 | Computed via real `computeLtv` with `defaultAssumptions`; hash-stable |
| `client_nba_recommendations` | 4 | Engine-sourced, open status (no `consumed_at`) |

**Deliberately out of scope:**

- `pricing_snapshots` — these are produced by running the pricing engine,
  not seeded directly. To populate the Reconciliation view (BU↔Treasury
  pairs), run the engine against the seeded deals after this script.
- `deals` — the JS catalogue (`MOCK_DEALS`) already exists and covers the
  Blotter today. A follow-up PR can seed them if/when Blotter moves to DB.
- Alert rules, reports, dossiers, etc. — orthogonal; seed separately when
  needed.

## Contract with PR B (DataContext refactor)

PR B will rely on these invariants:

1. The demo entity is **always** `DEFAULT_ENTITY_ID`
   (`00000000-0000-0000-0000-000000000010`). No other entity is used for
   demo data.
2. Client IDs in the DB are **identical** to those in `MOCK_CLIENTS`
   (CL-1001, CL-1002, …). This means Storybook stories and E2E specs keep
   working against either source interchangeably.
3. Every seeded client has coherent cross-table data — positions **and**
   metrics **and** events **and** an LTV snapshot **and** at least one NBA.
   No fragmented clients.
4. Re-running the seed is idempotent. PR B's CI smoke can run it safely.

## When to re-run

- After a schema migration that adds a new column with a default (seed
  won't refresh existing rows — use `--reset` if you need fresh data).
- After a `computeLtv` change — the LTV snapshot row uses
  `ON CONFLICT DO UPDATE` so re-running refreshes `clv_point_eur`,
  `breakdown`, `assumptions_hash`, etc.
- When onboarding a fresh environment / reviewer laptop.

## Reset semantics

`--reset` deletes **only Phase 6 per-client rows** for the seeded client
IDs (`client_nba_recommendations`, `client_ltv_snapshots`, `client_events`,
`client_metrics_snapshots`, `client_positions`). It leaves:

- `clients`, `products`, `business_units` — conceptually entity-owned; a
  real operator wouldn't wipe these.
- Data for other clients — only `CL-1001`, `CL-1002`, `CL-2001` are
  targeted.

If you need a scorched-earth reset, issue `DELETE FROM clients WHERE entity_id = ...`
manually and re-run without `--reset`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `DATABASE_URL env var required` | Env var missing | Export `DATABASE_URL` before running |
| `relation "client_positions" does not exist` | Migrations not applied | Run `npm run migrate` (or Supabase migrations) first |
| Rows show `entity_id=default` but UI doesn't see them | `TENANCY_ENFORCE=on` and your user isn't in `entity_users` for `DEFAULT_ENTITY_ID` | Run `scripts/provision-tenant.ts` or use `demo@nfq.es` |
| LTV snapshot hash changed unexpectedly | `computeLtv` or `defaultAssumptions` changed | Intentional if your PR altered the engine; otherwise investigate |

## Reference

- Source: [`scripts/seed-demo-dataset.ts`](../../scripts/seed-demo-dataset.ts)
- Entity constant: [`utils/seedData.entities.ts`](../../utils/seedData.entities.ts)
- Mock catalogue: [`utils/seedData.ts`](../../utils/seedData.ts)
- LTV engine: [`utils/clv/ltvEngine.ts`](../../utils/clv/ltvEngine.ts)
- Relationship aggregator: [`utils/customer360/relationshipAggregator.ts`](../../utils/customer360/relationshipAggregator.ts)
