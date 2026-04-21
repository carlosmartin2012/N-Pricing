# Runbook — CLV + 360º operations

**Coverage:** CLV snapshot worker stalled, stale snapshots, NBA bias alert,
`preview-ltv-impact` latency.

## 1. LTV snapshot worker stalled

**Trigger:** No new rows in `client_ltv_snapshots` for >24h on an entity
with active positions, OR `[ltv-snapshot]` log line has `errors.length > 0`
for more than 3 consecutive ticks.

### Diagnose

```sql
-- Staleness per entity
SELECT entity_id,
       COUNT(*) AS clients,
       MAX(computed_at) AS last_computed,
       NOW() - MAX(computed_at) AS staleness
FROM client_ltv_snapshots
GROUP BY entity_id
ORDER BY staleness DESC;

-- Clients with positions but no snapshot today
SELECT p.entity_id, p.client_id
FROM (SELECT DISTINCT entity_id, client_id FROM client_positions WHERE status = 'Active') p
LEFT JOIN client_ltv_snapshots s
  ON s.entity_id = p.entity_id AND s.client_id = p.client_id
 AND s.as_of_date = CURRENT_DATE
WHERE s.id IS NULL;
```

### Contain

1. Check `LTV_SNAPSHOT_INTERVAL_MS` is set on the running server
   (`ps aux | grep node`, then inspect env).
2. Run a one-shot tick manually from a REPL:
   ```ts
   import { runLtvSnapshotTick } from 'server/workers/ltvSnapshotWorker';
   console.log(await runLtvSnapshotTick());
   ```
3. If errors are per-client (e.g. `assumptions_hash` write failed), check
   RLS: the worker runs with service role in production — if it migrated
   to a tenant-scoped connection, the INSERT will silently fail.

### Validate

`SELECT COUNT(*) FROM client_ltv_snapshots WHERE computed_at > NOW() - INTERVAL '1 hour'`
returns > 0 after a tick.

---

## 2. Stale CLV snapshots on demo clients

**Trigger:** UI shows CLV numbers older than a week AND positions changed
(new deal booked) but no new snapshot exists.

### Root cause

The worker is idempotent per (entity, client, as_of_date) — a same-day
booking does NOT invalidate today's snapshot unless `assumptions_hash`
changed (it won't; positions don't feed into hash by design).

### Fix

- Ask the RM to hit **Recompute** in the LTV tab (triggers
  `POST /api/clv/clients/:id/ltv/recompute` which always rewrites today's
  snapshot).
- For bulk refresh after a large seed: call the worker with an explicit
  `asOfDate` param that is NOT today's date:
  ```ts
  await runLtvSnapshotTick('2026-04-22');
  ```
  then wait for the next scheduled tick on the real `as_of_date`.

---

## 3. NBA bias alert — top recommendation always same product

**Trigger:** `client_nba_recommendations` aggregated over last 7 days:
one `recommended_product` appears in > 80 % of rows.

### Why this matters

A biased NBA engine means either:
- `REFERENCE_CATALOGUE` has a dominating entry (high-ticket × high margin
  drowns out other candidates).
- The `marginalLtvImpact` decomposition has a term that always dominates
  for the entity's portfolio (e.g. churn_reduction term >> capital_opp
  because churn hazard is calibrated too high).

### Diagnose

```sql
SELECT recommended_product, COUNT(*) AS n
FROM client_nba_recommendations
WHERE generated_at > NOW() - INTERVAL '7 days'
GROUP BY recommended_product
ORDER BY n DESC;
```

If one product is > 80 %, drill down:

```sql
SELECT reason_codes, COUNT(*) FROM client_nba_recommendations
WHERE recommended_product = '<dominant>'
  AND generated_at > NOW() - INTERVAL '7 days'
GROUP BY reason_codes;
```

### Contain

1. **Short term:** cap the catalogue to exclude the dominating product for
   a specific entity (add tenant-level catalogue override — Phase 7 work).
2. **Mid term:** re-calibrate `assumptions.churnHazardAnnual` per entity.
   The default 8 % is a placeholder; real banks often sit at 3–5 % for
   corporate and 10–15 % for retail. A miscalibrated default will make
   `churnReductionEur` dominate every ΔCLV.

### Validate

After recalibration, re-run generate for a sample of 20 clients and
confirm product distribution spreads across ≥ 3 products.

---

## 4. `preview-ltv-impact` latency spike

**Trigger:** Slack alert on `pricing_latency_p95` AND
`/api/clv/preview-ltv-impact` is the top endpoint in the last hour
(visible in `observability_metrics`).

### Why this happens

The endpoint hydrates a full `ClientRelationship` on every call (positions
+ metrics + targets). For a client with many positions (> 50), the
round-trip is dominated by the 3 SQL queries, not by the pure engine.

### Diagnose

```sql
-- Latency per path
SELECT path, percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
       COUNT(*) AS calls
FROM observability_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND path LIKE '/api/clv/%'
GROUP BY path
ORDER BY p95_ms DESC;
```

### Contain

1. Verify React Query client-side cache is enabled: the panel debounces at
   400 ms AND caches by fingerprint for 5 s. If those aren't hitting, a
   slider drag can fire ~10 calls per second.
2. If the problem is server-side SQL: check
   `idx_client_positions_client` is present:
   ```sql
   \d client_positions
   ```
   If it got dropped during a migration rollback, recreate via migration
   `20260603000001_customer_360.sql` idempotent re-run.

### Validate

`p95` for `/api/clv/preview-ltv-impact` should sit under 200 ms for a
client with ≤ 10 positions.

---

## Related

- Code: [`utils/clv/`](../../utils/clv/), [`server/workers/ltvSnapshotWorker.ts`](../../server/workers/ltvSnapshotWorker.ts), [`server/routes/clv.ts`](../../server/routes/clv.ts)
- Migration: [`supabase/migrations/20260608000001_clv_360.sql`](../../supabase/migrations/20260608000001_clv_360.sql)
- Seeding: `npm run seed:clv-demo`
- API: see `docs/api-spec.yaml` section CLV
