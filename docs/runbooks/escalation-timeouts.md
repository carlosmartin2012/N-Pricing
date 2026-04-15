# Runbook — Approval escalation timeouts

Trigger: an approval request sits longer than its configured window and
the sweeper either emits an escalation/expiry event or **fails to**.

## Signals

- Alert `escalation_backlog_high` fires (open escalations past due > 20).
- Dashboard `/governance` shows rows with `dueAt < now` stuck in `open`.
- On-call sees repeated `[escalation-sweep] tick failed` in server logs.
- Manual spot check:
  ```sql
  SELECT level, count(*)
  FROM approval_escalations
  WHERE entity_id = :entity AND status = 'open' AND due_at < now()
  GROUP BY level;
  ```
  Any non-zero count on L1/L2 for > 15 minutes is actionable.

## Triage

1. **Worker alive?**
   ```bash
   curl -s -H "x-entity-id: $ENTITY" -XPOST \
     https://$HOST/api/governance/escalations/sweep
   ```
   If the summary returns `{escalated, notified, expired, untouched}` the
   evaluator itself is healthy — the opt-in loop is disabled or down.
   Check `ESCALATION_SWEEP_INTERVAL_MS` on the server (must be ≥ 1000 to
   activate the background tick).

2. **Misconfigured entity?**
   ```bash
   curl -s -H "x-entity-id: $ENTITY" https://$HOST/api/governance/escalation-configs
   ```
   Missing level configs means the sweeper falls back to 24h at the
   *current* level. If the bank expects a shorter window, push one:
   ```bash
   curl -XPUT -H "x-entity-id: $ENTITY" -H "content-type: application/json" \
     -d '{"timeoutHours":8,"notifyBeforeHours":2,"channelType":"slack"}' \
     https://$HOST/api/governance/escalation-configs/L1
   ```

3. **Chain broken?** If an escalation transitioned to `escalated` but no
   new `open` row landed at the next level, the INSERT half of the
   `/sweep` transaction failed. Grep logs for the escalation id; most
   likely cause: `deal_id` FK violation because the deal was deleted
   between the SELECT and the INSERT. Reopen manually:
   ```sql
   INSERT INTO approval_escalations (entity_id, deal_id, level, due_at, status, escalated_from_id)
   VALUES (:entity, :deal, 'L2', now() + interval '48 hours', 'open', :old_id);
   ```

## Resolution

- **Immediate relief**: hit `/sweep` manually — it is idempotent, safe
  to call repeatedly.
- **Root cause**: restart the server with a non-zero
  `ESCALATION_SWEEP_INTERVAL_MS` (60000 recommended). Alternatively use
  an external scheduler (GitHub Actions, Kubernetes CronJob) to hit
  `/sweep` every minute — this is preferable for multi-replica
  deployments where only one worker should sweep.
- Document the intervention in the shift log and open a Linear issue if
  it was a code bug, not config drift.

## Invariants to uphold

- Sweeper is idempotent — notify stamps `notified_at` without status
  changes; reruns within the notify window must return `none`.
- Escalation always creates a new row, never mutates `level` of the old
  one. The `escalated_from_id` column preserves chain history for the
  regulator.
- Committee is terminal: past-due Committee transitions to `expired`.
  Nothing above Committee. Human intervention required.

## Kill switch

To halt all automatic transitions while preserving the audit trail:

```sql
UPDATE approval_escalation_configs SET is_active = FALSE
WHERE entity_id = :entity;
```

The sweeper treats missing configs as "no notify" and falls back to a
24h timeout on escalate, but with every config deactivated the
on-demand `/sweep` can still be invoked manually and applied with a
temporary patch. Re-enable individual levels as the incident resolves.
