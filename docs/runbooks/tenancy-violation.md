# Runbook — tenancy violation

**Trigger:** alert rule `tenancy_violations_total > 0` over the last
5 minutes. Severity: `critical` / page.

## What it means

A request reached an entity-scoped endpoint with a JWT that does NOT have
a row in `entity_users` for the claimed `x-entity-id`. The middleware
rejected it (403) and persisted a row to `tenancy_violations`. There has
been **no data leak** — the request never touched DB rows. The alert
exists because a non-zero rate suggests a misconfigured client, an
attempted impersonation, or a regression in entity_users seeding.

## Diagnose

```sql
SELECT occurred_at, user_email, endpoint, claimed_entity, error_code, detail
FROM tenancy_violations
WHERE occurred_at >= NOW() - INTERVAL '15 minutes'
ORDER BY occurred_at DESC
LIMIT 50;
```

Split by `error_code`:

| Code | Most common cause |
|---|---|
| `tenancy_missing_header` | Client lib forgot to set `x-entity-id`. Usually a deploy regression. |
| `tenancy_invalid_uuid` | Hand-crafted request, copy-paste error, or test traffic. |
| `tenancy_denied` | User exists but lacks membership in the claimed entity. Could be benign (recently removed) or hostile. |
| `tenancy_jwt_invalid` | Bearer token failed verification. Usually expired session. |
| `tenancy_role_missing` | `entity_users` row exists but `role` column is null/unknown. Data quality issue. |

## Contain

- **Spike from one user/IP**: revoke the user's session, reach out via
  Slack to confirm intent. If hostile, rotate JWT secret and force
  re-login fleet-wide.
- **Spike from a deploy**: roll back the offending client release. The
  middleware keeps blocking, so there's no rush — you can take the time
  to verify the rollback is the right one.
- **Spike from cron / batch jobs**: check the cron schedule for missing
  `?entity_id=` param (Phase 0 added that to `realize-raroc` and
  `elasticity-recalibrate`).

## Resolve

Alert auto-clears once new violations stop for the rule's
`window_seconds`. You don't need to do anything in `alert_rules`.

## Post-mortem

If the spike was real abuse:

1. Add the offending source to whatever IP-level allowlist your edge has.
2. Note the incident in the audit log via `INSERT INTO audit_log (...)`
   so future reviewers see it surfaced.
3. Consider tightening `cooldown_seconds` on the alert rule — the default
   300 s may have suppressed follow-up bursts.

## Related

- Migration: `20260602000001_tenancy_helpers.sql`
- Code: `server/middleware/tenancy.ts`
- Doc: [phase-0-rollout.md](../phase-0-rollout.md)
