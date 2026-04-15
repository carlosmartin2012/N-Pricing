# Runbook — pricing latency breach

**Trigger:** `pricing_single_latency_ms` p95 > 300 ms over 1 hour for any
entity. Severity: `warning`.

## What it means

The p95 of single-deal pricing calls is above SLO. Either:

- The pricing context (curves, rules, rate cards) loaded for the tenant
  is significantly larger than baseline.
- A specific deal pattern is causing engine slowness.
- Postgres is degraded (slow `entity_users` lookup → tenancy middleware
  bottleneck).
- Edge Function cold-start spike.

## Diagnose

```sql
-- Top 20 slowest pricing calls in the breach window
SELECT recorded_at,
       metric_value AS latency_ms,
       dimensions->>'request_id' AS request_id,
       dimensions->>'endpoint'   AS endpoint
FROM metrics
WHERE entity_id   = '<uuid>'
  AND metric_name = 'pricing_single_latency_ms'
  AND recorded_at >= NOW() - INTERVAL '15 minutes'
ORDER BY metric_value DESC
LIMIT 20;
```

For each slow request, find its snapshot to inspect the context size:

```sql
SELECT id, octet_length(context::text) AS context_bytes,
       used_mock_for, jsonb_array_length(context->'rules') AS rule_count
FROM pricing_snapshots
WHERE request_id = '<request_id>'
LIMIT 1;
```

Common patterns:
- `context_bytes > 500_000` → context bloat. Check whether the tenant
  uploaded an unusually large rules / rate cards file recently.
- `rule_count > 200` → rule matching engine is the bottleneck. Phase 1
  Sprint 3 is when we'd add an LRU there.
- `used_mock_for` non-empty → tenant config is incomplete; pricing is
  using mock fallbacks which are sometimes more expensive.

## Contain

- **Context bloat from a recent upload**: ask the tenant Admin to roll
  back the latest rules / rate card upload, or temporarily flag the file
  as inactive in `rules.is_active = false`.
- **Cold-start spike**: check Supabase Edge Function logs for "boot"
  messages clustered together.
- **Postgres degradation**: pull `pg_stat_activity`, look for blocked
  queries on `entity_users`. Vacuum if needed.

## Mitigate the alert

If the breach is transient and you've confirmed root cause is fixed,
ratchet the threshold up *temporarily* (NOT permanently):

```sql
UPDATE alert_rules SET threshold = 600
WHERE entity_id = '<uuid>'
  AND metric_name = 'pricing_single_latency_ms'
  AND severity = 'warning';
```

Reset to 300 once steady-state confirmed.

## Resolve

Alert auto-clears once p95 returns below threshold for the
`window_seconds` window. Document the incident in the audit log if it
required action.

## Related

- Migration: `20260602000005_slo_metrics.sql`
- Code: `server/routes/observability.ts` (slo-summary endpoint)
- Doc: [phase-0-rollout.md](../phase-0-rollout.md)
