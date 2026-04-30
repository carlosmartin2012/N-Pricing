# Runbook templates

Per-tenant operational runbooks for the on-call team. Each file is a
**template** — copy it into the bank's wiki / Notion / Confluence and fill
the bracketed sections (`[on-call rota]`, `[escalation contact]`, etc.)
once you know the team that operates the deployment.

## Index

| File | Trigger |
|---|---|
| [tenancy-violation.md](./tenancy-violation.md) | `tenancy_violations_total > 0` over 5 min |
| [pricing-latency.md](./pricing-latency.md) | `pricing_single_latency_ms` p95 > 300 ms |
| [snapshot-write-failure.md](./snapshot-write-failure.md) | Any row in metrics with `snapshot_write_failures_total` in last 5 min |
| [mock-fallback.md](./mock-fallback.md) | `mock_fallback_rate` > 5% over 1 h |
| [campaign-volume-exhausted.md](./campaign-volume-exhausted.md) | Channel quote rejected because campaign hit `max_volume_eur` |
| [adapter-down.md](./adapter-down.md) | `adapterRegistry.healthAll()` returns ok=false for a registered integration |
| [backtest-drift.md](./backtest-drift.md) | `detectDrift().severity === 'breached'` after a backtesting run |
| [clv-ops.md](./clv-ops.md) | LTV worker stalled · stale snapshots · NBA bias · preview-ltv-impact latency |
| [feature-flag-kill-switch.md](./feature-flag-kill-switch.md) | Need to halt all writes for a tenant immediately |
| [escalation-timeouts.md](./escalation-timeouts.md) | Approval escalations stuck past SLA |
| [attribution-drift-systematic.md](./attribution-drift-systematic.md) | `attribution_drift_signals_total > 0` over 24h (Ola 8 Bloque C) |
| [web-push-troubleshooting.md](./web-push-troubleshooting.md) | Push notifications no llegan / 503 no_vapid_config (Ola 10 Bloque C) |

## Proactive playbooks

Not triggered by alerts — executed intentionally during rollouts / demos.

| File | Purpose |
|---|---|
| [tenancy-strict-flip.md](./tenancy-strict-flip.md) | Flip `TENANCY_ENFORCE=on` → `TENANCY_STRICT=on` across the 4 Phase 0 rollout steps |
| [seed-demo.md](./seed-demo.md) | Re-seed `DEFAULT_ENTITY_ID` with the demo catalogue |
| [replit-demo.md](./replit-demo.md) | End-to-end Replit demo flow + troubleshooting |

## Common header to fill in each runbook

```yaml
on_call:        '[Slack: #ops-npricing] · [PagerDuty: NPRICING_ONCALL]'
escalation_l1:  '[name + phone]'
escalation_l2:  '[name + phone]'
last_reviewed:  '2026-04-15'
owner:          '[team]'
```

The runbooks reference SQL queries you can paste into Supabase Studio /
psql. They assume you have read access to the relevant tables (Auditor
role is enough for diagnose; Admin needed for kill-switch).
