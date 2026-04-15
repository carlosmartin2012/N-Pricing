# Runbook — mock fallback rate

**Trigger:** `mock_fallback_rate` > 5 % over 1 hour for any entity.
Severity: `warning`.

## What it means

More than 5 % of pricing calls in the last hour fell back to mock data
because the tenant's config is incomplete. With `PRICING_ALLOW_MOCKS=false`
in production this won't happen (calls return 400 instead) — so this
alert mostly fires in staging or for tenants on the legacy permissive flag.

## Diagnose

Find which sections fall back:

```sql
SELECT used_mock_for, COUNT(*) AS n
FROM pricing_snapshots
WHERE entity_id = '<uuid>'
  AND created_at >= NOW() - INTERVAL '1 hour'
  AND used_mock_for <> '{}'
GROUP BY used_mock_for
ORDER BY n DESC;
```

Common missing sections: `rateCards`, `transitionGrid`, `physicalGrid`,
`behaviouralModels`, `sdrConfig`, `lrConfig`. Each maps to a Config view
in the SPA.

## Resolve

Reach out to the tenant Admin to upload the missing reference data. The
alert auto-clears once usage of mocks drops below 5 %.

If the tenant is in staging and accepts mocks intentionally, lower the
threshold for that entity:

```sql
UPDATE alert_rules SET threshold = 0.5
WHERE entity_id = '<uuid>'
  AND metric_name = 'mock_fallback_rate';
```

## Related

- Migration: `20260602000004_pricing_snapshots.sql`
- Code: `supabase/functions/pricing/index.ts` (PRICING_ALLOW_MOCKS gate)
