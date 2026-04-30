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

## Adapter bootstrap fail-loud (Ola 10.3)

`PRICING_ALLOW_MOCKS` también gobierna el comportamiento de
`server/integrations/bootstrap.ts` al arrancar el server Node:

| `NODE_ENV`   | `ADAPTER_*` set a real | Creds presentes | `PRICING_ALLOW_MOCKS` | Comportamiento al boot |
|--------------|-----------------------|-----------------|-----------------------|------------------------|
| `production` | sí                    | no              | unset / `false`       | **THROW** — boot falla con mensaje claro |
| `production` | sí                    | no              | `true`                | `console.warn` + fallback in-memory |
| `production` | sí                    | sí              | (cualquiera)          | Registra adapter real, sin warn |
| `production` | no                    | —               | (cualquiera)          | Registra in-memory por default, sin warn |
| `development`/`staging` | sí           | no              | (cualquiera)          | `console.warn` + fallback in-memory |

### Síntomas en producción

Si después de un deploy aparece en logs:

```
Error: [adapters] ADAPTER_CRM=salesforce but SALESFORCE_INSTANCE_URL/CLIENT_ID/CLIENT_SECRET missing — refusing to fall back to in-memory in production. Either provide the missing credentials or set PRICING_ALLOW_MOCKS=true to acknowledge the mock fallback explicitly.
```

es **intencional**. El operador pidió un adapter real pero faltan
secrets. Opciones:

1. **Inmediata** (preferida): añadir las env vars faltantes en el
   plataforma de hosting y re-desplegar.
2. **Mitigación temporal** (uso emergencia): `PRICING_ALLOW_MOCKS=true`
   permite el fallback explícitamente. Documentar el incidente y crear
   ticket para volver a `false` en cuanto las credenciales estén.
3. **Rollback**: si el adapter real no está listo todavía, quitar la
   env var `ADAPTER_<KIND>=<real>` para que defaultee a in-memory sin
   disparar el guard.

## Related

- Migration: `20260602000004_pricing_snapshots.sql`
- Code: `supabase/functions/pricing/index.ts` (PRICING_ALLOW_MOCKS gate)
- Code: `server/integrations/bootstrap.ts` (`assertMockFallbackAllowed`)
