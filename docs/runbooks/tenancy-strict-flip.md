# Runbook — flip `TENANCY_STRICT` global

**Type:** proactive playbook — executed intentionally when rolling out the multi-tenant hardening end state.
**Counterpart:** [`tenancy-violation.md`](./tenancy-violation.md) is the *reactive* runbook for the alert itself. Read both before starting.
**Related:** [`phase-0-rollout.md`](../phase-0-rollout.md) — canonical rollout guide Phase 0.

---

## When to run this

Only after all the pre-flight items below are green. This flip is **functionally irreversible** in the sense that any code path that was relying on the Default Entity fallback will start returning 500s until you fix it or flip strict back off.

It's safe to rehearse Phase 1-3 in a staging environment repeatedly. Phase 4 (strict) should be rehearsed once in staging before touching production.

---

## Pre-flight checklist

| Check | How to verify |
|---|---|
| All entity-scoped routers consume `req.tenancy` | `grep -rn "router.get\|router.post" server/routes/ \| grep -v "req.tenancy"` should only show routes explicitly documented as unscoped (auth, health, public) |
| Guard `requireTenancy()` mounted on `entityScoped` chain | [`server/index.ts:112-114`](../../server/index.ts#L112) — mounted unconditionally (no-op when `TENANCY_ENFORCE=off`) |
| Integration tests green | `INTEGRATION_DATABASE_URL=… npx vitest run utils/__tests__/integration/legacyRouteTenancy.integration.test.ts` — 7 specs |
| Edge Functions validate tenancy before service-role calls | Check `supabase/functions/pricing/index.ts`, `realize-raroc`, `elasticity-recalibrate` |
| Cron jobs scoped per-tenant | `SELECT jobname, command FROM cron.job WHERE command LIKE '%realize-raroc%' OR command LIKE '%elasticity%';` — every row must include `?entity_id=<uuid>` |
| Alert rules seeded per tenant | **Automatic since PR #44**: migration `20260619000004_tenancy_alerts_seed.sql` seeds all active entities at deploy time, and `scripts/provision-tenant.ts` seeds new tenants at creation. Double-check with `SELECT entity_id, array_agg(name) FROM alert_rules WHERE name IN ('pricing p95 breach','tenancy violation','snapshot write failure') GROUP BY entity_id;` — every active entity must return 3 names. The TS script `fill-tenancy-alert-secrets.ts` fills in `channel_config` secrets (Slack webhook URL, PagerDuty routing key) when env vars are provided. |
| `SLOPanel` widget shows `tenancy_violations_total = 0` | **Shipped in PR #45** — `Admin → System Audit → SLO panel`. The dedicated *Tenancy violations · last 60m* section renders the total + top-10 endpoint breakdown. Empty window → "Safe to hold TENANCY_STRICT flip observation" copy. |
| Hash chain integrity (optional but recommended) | **Writer shipped in PR #47** — new pricing calls populate `prev_output_hash`. Admin can probe with `GET /api/snapshots/verify-chain?from=<ISO>&to=<ISO>` and expect `{valid: true, brokenAt: undefined}`. |

If any row fails, **stop and fix before continuing**.

---

## Phase 1 — Land migrations

Nothing to flip. Deploy the commit containing the latest `supabase/migrations/*` normally. Migrations are additive and idempotent; traffic is unaffected.

**Verify.** `supabase migration list` or `SELECT MAX(name) FROM supabase_migrations.schema_migrations;` — latest applied matches what's in main.

---

## Phase 2 — Warn mode (24-48 h bake)

```bash
# One environment at a time. Start with staging, then prod canary (single region).
vercel env add TENANCY_ENFORCE on production
vercel env pull --yes && vercel --prod
```

What this does: mounts `tenancyMiddleware` on the `entityScoped` chain. Every request without a valid `x-entity-id` is rejected with `403 tenancy_*` and logged to `tenancy_violations`. Data path is untouched.

**Monitor (every 2-4 h for 24 h).**

```sql
SELECT endpoint, claimed_entity, error_code, count(*)
FROM tenancy_violations
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1, 2, 3
ORDER BY count DESC;
```

**Expected.** Zero violations from internal services. Some violations from:
- Old mobile/web clients that haven't been updated — push client release, then re-verify.
- Manual curl / ad-hoc scripts — educate the owner or migrate them to the right header.

**Advance criterion.** 24 consecutive hours with `count(*) = 0` for all `error_code IN ('tenancy_missing_header', 'tenancy_jwt_invalid', 'tenancy_role_missing')` originating from known service IPs.

**Rollback.** `vercel env rm TENANCY_ENFORCE production && vercel --prod`. Middleware unmounts, traffic flows as before Phase 2.

---

## Phase 3 — Lock pricing config (`PRICING_ALLOW_MOCKS=false`)

```bash
vercel env add PRICING_ALLOW_MOCKS false production
vercel --prod
```

What this does: the Edge pricing function stops falling back to mock data when a tenant is missing `rateCards`, `transitionGrid`, `physicalGrid`, `behaviouralModels`, `sdrConfig`, or `lrConfig`. It returns `400 configuration_incomplete` instead.

**Monitor.**

```sql
-- Any tenant hitting incomplete config?
SELECT entity_id, count(*) AS failures, array_agg(DISTINCT dimensions->>'missing_section') AS missing
FROM metrics
WHERE metric_name = 'pricing_config_incomplete_total'
  AND recorded_at >= NOW() - INTERVAL '1 hour'
GROUP BY entity_id;
```

**Expected.** Zero rows. If a tenant appears, check with them:
- Did they skip reference data upload? → point them to Admin → Rules & Config.
- Did a recent reset wipe their config? → restore from `pricing_snapshots.context`.

**Advance criterion.** 24 h with zero `pricing_config_incomplete_total` in production.

**Rollback.** `vercel env add PRICING_ALLOW_MOCKS true production && vercel --prod`. Missing-config requests silently fall back to mocks again. **Use only as emergency.**

---

## Phase 4 — Strict DB (`TENANCY_STRICT=on`) — irreversible-in-spirit

```bash
vercel env add TENANCY_STRICT on production
vercel --prod
```

What this does: `withTenancyTransaction` now also emits `SET LOCAL app.tenancy_strict = 'on'`. The DB function `get_current_entity_id()` raises `tenancy_not_set` instead of returning the Default Entity when no `app.current_entity_id` is set in the session.

**Result.** Any server code path that touches an entity-scoped table **without** going through `withTenancyTransaction` (or a Supabase client that propagates `auth.jwt()`) will now fail with a 500 containing `tenancy_not_set`.

**Monitor for the first 1 h continuously.**

```sql
SELECT recorded_at, dimensions->>'path' AS path, dimensions->>'code' AS code
FROM metrics
WHERE metric_name = 'server_error_total'
  AND dimensions->>'code' = 'tenancy_not_set'
  AND recorded_at >= NOW() - INTERVAL '10 minutes'
ORDER BY recorded_at DESC;
```

**If any row appears within 15 minutes of the flip,** roll back immediately and investigate:

```bash
vercel env add TENANCY_STRICT off production && vercel --prod
```

Then find the offending path, wrap it in `withTenancyTransaction`, add an integration test, redeploy, and attempt Phase 4 again.

**Advance criterion.** 1 h with zero `tenancy_not_set` errors. Continue monitoring at 4 h, 24 h, 7 d intervals for regressions.

---

## Post-flip maintenance

1. **New routers must use `entityScoped` chain.** The `requireTenancy()` guard catches missed wiring with 500 `tenancy_guard_missing` — do not dismiss these as bugs, they're the guard working as designed.
2. **New scheduled jobs must scope `?entity_id=`.** Unscoped crons will error under strict.
3. **Before removing `TENANCY_STRICT=on` ever,** understand why. A flip back to off should only ever be an emergency rollback, not routine.

---

## Rollback matrix

| Phase active | Command to undo |
|---|---|
| 4 — strict | `vercel env add TENANCY_STRICT off production` — fallback to Default Entity resumes |
| 3 — mock lock | `vercel env add PRICING_ALLOW_MOCKS true production` — mocks accepted again |
| 2 — warn | `vercel env rm TENANCY_ENFORCE production` — middleware unmounts |
| 1 — migrations | No rollback needed; migrations are additive. If a table conflicts with downstream consumers, file a migration to drop the new column/table — never edit the applied migration. |

---

## Sign-off checklist (record in the ops log)

- [ ] Pre-flight: all 7 checks green as of `<UTC timestamp>`
- [ ] Phase 2 activated at `<UTC timestamp>` · `tenancy_violations_total` after 24 h: `<value>`
- [ ] Phase 3 activated at `<UTC timestamp>` · `pricing_config_incomplete_total` after 24 h: `<value>`
- [ ] Phase 4 activated at `<UTC timestamp>` · `tenancy_not_set` errors in first 1 h: `<value>`
- [ ] Announcement posted to `#npricing-ops` Slack channel with rollback commands
- [ ] CLAUDE.md updated: "Pitfalls comunes" entry about `req.tenancy` escalated from warning to historical note

---

## Related

- [`phase-0-rollout.md`](../phase-0-rollout.md) — full rollout guide
- [`tenancy-violation.md`](./tenancy-violation.md) — reactive runbook for the alert itself
- [`supabase/migrations/20260619000004_tenancy_alerts_seed.sql`](../../supabase/migrations/20260619000004_tenancy_alerts_seed.sql) — deploy-time seed of the 3 canonical alert rules for all active entities (PR #44)
- [`scripts/provision-tenant.ts`](../../scripts/provision-tenant.ts) — per-tenant provisioning incl. alert-rule seed (PR #49)
- [`scripts/fill-tenancy-alert-secrets.ts`](../../scripts/fill-tenancy-alert-secrets.ts) — idempotent ops-time secrets filler for `channel_config` (Slack / PagerDuty). Rules themselves are migration-seeded (PR #44).
- [`components/Admin/SLOPanel.tsx`](../../components/Admin/SLOPanel.tsx) — canary widget for `tenancy_violations` (PR #45)
- [`server/middleware/tenancy.ts`](../../server/middleware/tenancy.ts) — middleware implementation
- [`server/middleware/requireTenancy.ts`](../../server/middleware/requireTenancy.ts) — anti-regression guard
