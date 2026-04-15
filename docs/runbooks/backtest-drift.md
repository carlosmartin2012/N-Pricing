# Runbook — backtesting drift breached

**Trigger:** `detectDrift(BacktestResult)` returns `severity: 'breached'`
after a backtesting run completes (`backtesting_runs.status = 'completed'`).

## What it means

Re-running the methodology over historical deals produced PnL or RAROC
materially different from what the bank actually booked. Could be:

- A new methodology version deviating from baseline (intentional during
  a what-if exercise — investigate but not panic).
- A bug introduced in the engine since the last backtest (check
  `engine_version` between this run and the prior).
- Data quality drift in the historical deals table (deal_outcomes
  realized values inconsistent with origination).

## Diagnose

```sql
SELECT id, name, sandbox_id, snapshot_id, date_from, date_to,
       result->>'pnlDeltaPct'  AS pnl_drift,
       result->>'rarocDeltaPp' AS raroc_drift,
       result->'cohortBreakdown' AS cohorts
FROM backtesting_runs
WHERE id = '<uuid>';
```

For per-cohort breakdown, parse `result.cohortBreakdown[]` and look for
the segment × product combos with the largest delta. Often a single
cohort drives the overall breach.

## Contain

- If the run was a **what-if sandbox**: report findings to the
  methodology change committee. No production action needed.
- If the run was against the **active methodology**: pause the next
  methodology promotion until root-caused. Consider freezing the active
  snapshot via:
  ```sql
  UPDATE methodology_snapshots SET is_current = false
  WHERE id = '<active_snapshot_id>';
  ```
  (then re-promote the prior snapshot).

## Validate

A drift over 10 % PnL or 2 pp RAROC requires sign-off by the model
validation team before re-activating any methodology.

## Related

- Code: `utils/backtesting/runner.ts`, `utils/backtesting/driftDetector.ts`
- Migration: `20260601000003_what_if.sql`
