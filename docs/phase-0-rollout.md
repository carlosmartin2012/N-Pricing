# Phase 0 — rollout guide

How to flip the Phase 0 safety mechanisms from default-off to enforced.
Covers the env vars that gate the breaking changes, the order to flip
them, and quick runbooks for the alerts they produce.

---

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `TENANCY_ENFORCE` | `off` | `on` ⇒ `tenancyMiddleware` is mounted on entity-scoped routers. Every request without a valid `x-entity-id` is rejected 400/403 and logged to `tenancy_violations`. |
| `TENANCY_STRICT` | `off` | `on` ⇒ `withTenancyTransaction` also sets `app.tenancy_strict='on'`, which makes `get_current_entity_id()` raise instead of falling back to Default Entity. Only flip after every code path reaches the DB through `withTenancyTransaction` or via a client that sets the session var explicitly. |
| `PRICING_ALLOW_MOCKS` | unset (treated as `false`) | When `true`, the pricing Edge Function accepts requests whose context falls back to mock data. Keep `true` in dev; flip to `false` in prod so missing configuration returns `400 configuration_incomplete` with the list of missing sections. |
| `ENGINE_VERSION` | `dev-local` | String recorded in every `pricing_snapshots.engine_version`. Wire to your CI so the snapshot carries the exact deployed commit sha. |
| `ALERT_EVAL_INTERVAL_MS` | unset (worker off) | Positive integer ≥ 1000 starts the `startAlertEvaluator` loop at that cadence. Typical: `30000` (30 s). |

---

## Recommended rollout order

**1 — Land the migrations (no traffic impact).**

Apply `supabase/migrations/20260602000001_*` through `..._000007_*` in a
single deploy. All policies keep backwards-compatible behaviour because the
strict flag is still off and legacy `USING(true)` policies are replaced by
equivalent entity-aware ones that still accept `entity_id NULL = global`.

**2 — Turn on tenancy enforcement in warn mode (manual sampling).**

Set `TENANCY_ENFORCE=on` in a single environment and watch the
`tenancy_violations` table for 24–48 hours. Expected: some violations from
legacy client code that forgets `x-entity-id`. Fix those clients before
continuing.

Query to watch:

```sql
SELECT endpoint, claimed_entity, user_email, error_code, count(*)
FROM tenancy_violations
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1, 2, 3, 4
ORDER BY count DESC;
```

**3 — Lock pricing config in prod.**

Set `PRICING_ALLOW_MOCKS=false`. From this point the Edge Function returns
`400 configuration_incomplete` when a tenant hasn't uploaded `rateCards`,
`transitionGrid`, `physicalGrid`, `behaviouralModels`, `sdrConfig`, or
`lrConfig`. The error body lists which sections are missing:

```json
{
  "code": "configuration_incomplete",
  "missing": ["rateCards", "transitionGrid", "physicalGrid", "behaviouralModels", "sdrConfig", "lrConfig"],
  "requestId": "..."
}
```

**4 — Start the alert evaluator.**

Set `ALERT_EVAL_INTERVAL_MS=30000`. The loop reads active `alert_rules`,
evaluates them against the last-`window_seconds` window, dispatches the
channel, and writes an `alert_invocations` row.

**5 — Strict Postgres enforcement (the irreversible step).**

Once every server code path that touches entity-scoped tables has been
moved to `withTenancyTransaction` (or to a Supabase client that propagates
`auth.jwt()`), flip `TENANCY_STRICT=on`. Legacy paths that forget to set
`app.current_entity_id` will now raise `tenancy_not_set` from Postgres,
which surfaces in the affected request as a 500.

---

## Alert routing

Alert rules use the `channel_type` / `channel_config` columns added in
`20260602000006_alert_channels.sql`. Seed at least these three per tenant:

| Rule name | SLI | Operator | Threshold | Severity | Channel |
|---|---|---|---|---|---|
| pricing p95 breach | `pricing_single_latency_ms` | `gt` | `300` | warning | slack |
| tenancy violation | `tenancy_violations_total` | `gt` | `0` | critical | pagerduty |
| snapshot write failure | `snapshot_write_failures_total` | `gt` | `0` | page | pagerduty |

`channel_config` payload examples:

```json
// Slack
{ "webhookUrl": "https://hooks.slack.com/...", "channel": "#npricing-ops" }

// PagerDuty
{ "routingKey": "$PAGERDUTY_ROUTING_KEY", "severity": "critical" }

// Generic webhook with HMAC
{ "url": "https://hooks.your.dev/n-pricing", "secret": "$WEBHOOK_SECRET" }
```

---

## Runbook — tenancy violation alert

**Trigger.** `tenancy_violations_total > 0` over 5 minutes.

**Diagnose.**

```sql
SELECT occurred_at, user_email, endpoint, claimed_entity, error_code, detail
FROM tenancy_violations
WHERE occurred_at >= NOW() - INTERVAL '15 minutes'
ORDER BY occurred_at DESC
LIMIT 50;
```

Split by `error_code`:

- `tenancy_missing_header` — the client isn't sending `x-entity-id`.
  Treat as a client bug. Check the `endpoint` and fix the caller.
- `tenancy_denied` — authenticated user isn't in `entity_users` for that
  entity. Investigate: was the user removed? Did someone forge `x-entity-id`?
- `tenancy_invalid_uuid` — malformed `x-entity-id`. Usually a dev bug.

**Mitigate.** If the spike is an internal deploy regression, roll back the
caller and the violations stop. If it's suspected abuse, revoke the user's
session and escalate.

**Resolve.** Alert clears automatically once new violations stop for the
`window_seconds` period.

---

## Runbook — snapshot write failure

**Trigger.** Any row added to `metrics` with
`metric_name='snapshot_write_failures_total'` in the last 5 minutes.

**Diagnose.**

```sql
SELECT recorded_at, dimensions
FROM metrics
WHERE metric_name = 'snapshot_write_failures_total'
  AND recorded_at >= NOW() - INTERVAL '15 minutes'
ORDER BY recorded_at DESC;
```

The `dimensions->>'error'` contains the Postgres error. Common causes:

- Hash constraint violation → engine produced an unexpected shape.
- Entity FK constraint → the Edge Function couldn't find the claimed entity
  (should have been caught by tenancy check earlier — investigate).
- pg\_cron disabled and `pricing_slo_minute` materialised view not refreshing
  — snapshot writes still work, the SLO view just goes stale.

**Mitigate.** Restart the Edge Function. If the issue is schema drift, pin
the Edge Function to the previous release while the root cause is fixed.

---

## Runbook — pricing latency p95 breach

**Trigger.** `pricing_single_latency_ms` p95 > 300 ms for an entity.

**Diagnose.** Pull the latest request IDs from the offending window:

```sql
SELECT recorded_at, metric_value, dimensions
FROM metrics
WHERE entity_id = '<uuid>'
  AND metric_name = 'pricing_single_latency_ms'
  AND recorded_at >= NOW() - INTERVAL '10 minutes'
ORDER BY metric_value DESC
LIMIT 20;
```

Sample one or two request IDs and inspect the snapshot for the context
size (`context` JSONB) — runaway context size usually means the tenant
just loaded a huge rules dataset.

**Mitigate.** Add an index if a query is hot; ratchet the threshold up
temporarily (`UPDATE alert_rules SET threshold = 500 WHERE id = ...`) if
the spike is transient; turn on pg\_cron materialised view refresh to
unblock dashboards.

---

## Cron function scoping

`realize-raroc` and `elasticity-recalibrate` now accept an optional
`?entity_id=<uuid>` query param. Use it when scheduling so each tenant gets
its own execution:

```sql
SELECT cron.schedule(
  'raroc-monthly-bbva',
  '0 3 1 * *',
  $$ SELECT net.http_post(
       url := 'https://<proj>.functions.supabase.co/realize-raroc?entity_id=<BBVA_UUID>',
       headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_KEY>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```

Omitting the query param keeps the cron's legacy behaviour (processes
every entity in one run) — fine for dev but not recommended for multi-tenant
production.

---

## Kill switches

Every change in Phase 0 can be reversed by flipping its env var back:

- `TENANCY_ENFORCE=off` → middleware unmounted, traffic flows as before.
- `TENANCY_STRICT=off` → `get_current_entity_id()` falls back to Default.
- `PRICING_ALLOW_MOCKS=true` → missing config stops returning 400.
- `ALERT_EVAL_INTERVAL_MS=` (unset) → alert worker stops on next process
  restart. `stopAlertEvaluator()` is also exported if you need to kill it
  inside a running process.

No schema rollback is needed because the migrations are additive (new
tables, policies replace blanket ones, helpers are idempotent).
