# Runbook — feature flag kill switch

**Trigger:** manual. Used when a tenant is running away (cost spike,
suspected abuse, regulatory hold) and you need to halt all writes
immediately without taking the whole product down.

## Apply the kill switch

```sql
INSERT INTO tenant_feature_flags (entity_id, flag, enabled, set_by, notes)
VALUES ('<uuid>', 'kill_switch', true, '<your-email>', '<reason>')
ON CONFLICT (entity_id, flag) DO UPDATE
SET enabled = EXCLUDED.enabled,
    set_by  = EXCLUDED.set_by,
    set_at  = NOW(),
    notes   = EXCLUDED.notes;
```

This flag is read by the application server on each request — turn-on is
near-instantaneous (no restart needed once the upcoming feature-flag
middleware ships in Phase 5 Sprint 2).

Until that middleware exists, you can disable the entity at the DB level
to achieve the same effect:

```sql
UPDATE entities SET is_active = false WHERE id = '<uuid>';
```

This causes `entity_users` lookups to keep working (so users can still
log in and read), but new writes to entity-scoped tables will fail
because `entities` is referenced as FK.

## Lift the kill switch

```sql
UPDATE tenant_feature_flags
SET enabled = false, set_by = '<your-email>', set_at = NOW(),
    notes = COALESCE(notes, '') || ' | lifted'
WHERE entity_id = '<uuid>' AND flag = 'kill_switch';

UPDATE entities SET is_active = true WHERE id = '<uuid>';
```

## Audit trail

Every kill-switch flip writes to `tenant_feature_flags.set_by` and
`set_at`. To find the history:

```sql
SELECT entity_id, enabled, set_by, set_at, notes
FROM tenant_feature_flags
WHERE flag = 'kill_switch'
ORDER BY set_at DESC;
```

For a full audit trail (who-did-what-when), also drop a row in
`audit_log`:

```sql
INSERT INTO audit_log (user_email, user_name, action, module, description)
VALUES ('<your-email>', '<your-name>', 'KILL_SWITCH_TOGGLE', 'SYSTEM',
        'kill_switch=<true|false> for entity <uuid>; reason: <text>');
```

## Related

- Migration: `20260606000001_metering_phase_5.sql`
- Provisioning script default: `kill_switch = false`
- Doc: [phase-0-rollout.md](../phase-0-rollout.md)
