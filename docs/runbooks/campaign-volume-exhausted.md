# Runbook — campaign volume exhausted

**Trigger:** channel quotes start coming back without a campaign attached
even though one should match. Often surfaced via tenant complaint, not
auto-alert (no SLO yet for "campaign hit ratio").

## What it means

A `pricing_campaigns` row reached its `max_volume_eur` and is no longer
returned by `findApplicableCampaigns`. The channel API silently falls
back to base pricing, so end users see a higher rate than expected.

## Diagnose

```sql
SELECT id, code, max_volume_eur, consumed_volume_eur, status
FROM pricing_campaigns
WHERE entity_id = '<uuid>'
  AND status IN ('approved','active','exhausted')
ORDER BY (consumed_volume_eur::numeric / NULLIF(max_volume_eur, 0)) DESC NULLS LAST
LIMIT 20;
```

Look for rows with `consumed_volume_eur >= max_volume_eur`. If
`status` is still `active` (not `exhausted`), the consumer/runner that
should mark them hasn't run — possibly the alert evaluator is off.

## Resolve options

1. **Mark the campaign as exhausted** (transparent retirement):
   ```sql
   UPDATE pricing_campaigns SET status = 'exhausted', updated_at = NOW()
   WHERE id = '<uuid>';
   ```

2. **Top up the volume** (commercial extension):
   ```sql
   UPDATE pricing_campaigns
   SET max_volume_eur = max_volume_eur + <new_eur>, updated_at = NOW()
   WHERE id = '<uuid>';
   ```
   Requires Admin or Risk_Manager (RLS).

3. **Issue a successor campaign** (versioning, recommended):
   - Create a new campaign with same `code` but `version + 1`.
   - Set `parent_version_id` to the exhausted row.
   - Cancel the old one when the new one goes active.

## Related

- Migration: `20260604000001_channels_and_campaigns.sql`
- Code: `utils/channels/campaignMatcher.ts`, `server/routes/campaigns.ts`
