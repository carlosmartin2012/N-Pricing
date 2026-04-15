# Runbook — pricing snapshot write failure

**Trigger:** any row in `metrics` with
`metric_name = 'snapshot_write_failures_total'` in the last 5 minutes.
Severity: `page`.

## What it means

A pricing call succeeded but persisting its `pricing_snapshots` row
failed. The user got a price; the system **lost the audit trail**. This
is regulatory critical — the bank cannot reproduce the calculation later.

## Diagnose

```sql
SELECT recorded_at,
       dimensions->>'request_id' AS request_id,
       dimensions->>'endpoint'   AS endpoint,
       dimensions->>'error'      AS error
FROM metrics
WHERE entity_id   = '<uuid>'
  AND metric_name = 'snapshot_write_failures_total'
  AND recorded_at >= NOW() - INTERVAL '15 minutes'
ORDER BY recorded_at DESC;
```

Common error strings:

| Substring | Cause |
|---|---|
| `chk_input_hash_format` / `chk_output_hash_format` | Edge Function emitted a malformed hash. Code regression. |
| `pricing_snapshots_entity_id_fkey` | The claimed entity_id doesn't exist. Tenancy check should have caught this earlier. |
| `pricing_snapshots_pkey` | UUID collision (extremely rare). Retry the request. |
| `permission denied` | RLS policy mismatch. Check whether `app.current_entity_id` was set inside a transaction. |

## Contain

If the cause is a code regression in the Edge Function:
- Pin the Edge Function to the previous deployment slot.
- Open a P1 against the platform team.

If the cause is a per-tenant issue (FK constraint), surface it via
`audit_log` so the tenant Admin can investigate. The pricing endpoint
keeps returning prices — there's no user-visible degradation, only the
silent loss of reproducibility.

## Backfill

For the affected request_ids, the call's input is recoverable from
`audit_log` (logged at the same time). To rebuild a snapshot
post-mortem:

```sql
SELECT description, details
FROM audit_log
WHERE action = 'BATCH_PRICE_SERVER'
  AND created_at BETWEEN '<from>' AND '<to>';
```

Then re-run the engine offline with that input + the historic curves
from `yield_curve_history` for the as_of_date, and INSERT the snapshot
manually with `source = 'backfill'` in the `detail` JSONB.

## Resolve

Alert auto-clears 5 min after the last failed write. Backfilled
snapshots should be tagged in `detail` so auditors can distinguish them
from real-time captures.

## Related

- Migration: `20260602000004_pricing_snapshots.sql`
- Code: `supabase/functions/pricing/index.ts`
- Doc: [phase-0-rollout.md](../phase-0-rollout.md)
