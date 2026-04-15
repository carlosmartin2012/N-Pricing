# Integration tests — opt-in

The unit suite (`npm test` → vitest) runs every test in `utils/__tests__/`
**except** the ones under `utils/__tests__/integration/`, which require a
real Postgres database.

## Running locally

1. Spin up a Postgres reachable from your machine. Three options:
   - `supabase start` (local Supabase stack — applies the migration tree
     automatically).
   - `docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=pw postgres:16` and
     then apply `supabase/migrations/*.sql` in order.
   - Point at a throwaway Supabase project from the dashboard.

2. Export the connection string and run vitest scoped to the integration
   folder:

   ```bash
   export INTEGRATION_DATABASE_URL="postgres://postgres:pw@localhost:5432/postgres"
   npx vitest run utils/__tests__/integration
   ```

   Without `INTEGRATION_DATABASE_URL` the spec self-skips, so this never
   breaks the default `npm test` flow.

## What is covered

- `get_current_entity_id()` legacy fallback to Default Entity (`tenancy_strict='off'`)
- `get_current_entity_id()` raises `tenancy_not_set` when `tenancy_strict='on'`
- `SET LOCAL` does not leak across pooled connections — pivotal for
  Express + pg.Pool deployments
- Append-only invariant on `tenancy_violations`
- Fuzz: 50 concurrent operations alternating entity A/B, expecting zero
  cross-reads (skipped softly when the seeded entity UUIDs aren't present)

## CI integration (when ready)

Add a job that:

```yaml
services:
  postgres:
    image: postgres:16
    ports: ['5432:5432']
    env:
      POSTGRES_PASSWORD: pw
    options: >-
      --health-cmd="pg_isready -U postgres"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=5
steps:
  - run: psql $INTEGRATION_DATABASE_URL -f supabase/migrations/*.sql
  - run: npx vitest run utils/__tests__/integration
    env:
      INTEGRATION_DATABASE_URL: postgres://postgres:pw@localhost:5432/postgres
```

The pre-step that applies migrations needs a glob expansion that respects
file order — easiest with `for f in $(ls supabase/migrations/*.sql | sort); do psql -f $f; done`.

## Why not testcontainers-node?

Adds ~50 MB of dependencies and requires Docker available in CI. The
opt-in env var pattern keeps the default suite fast, gives flexibility on
which Postgres to point at (local, Supabase, ephemeral container), and
matches what most production teams already do for their integration tier.
