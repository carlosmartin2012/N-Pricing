# Runbook — integration adapter down

**Trigger:** `adapterRegistry.healthAll()` reports `ok: false` for a
registered adapter (core banking, CRM, market data) for more than
5 minutes.

## What it means

A downstream connector is unreachable. Pricing keeps working as long as
the missing data has a fallback (cached curves, in-memory adapter for
CRM lookups). The alert exists so SRE knows before it bites a feature.

## Diagnose

Hit the health endpoint via the SPA's Health view, or directly:

```bash
curl https://app.example/api/observability/integrations
```

The response body lists `kind`, `name`, `health.ok`, `health.message`.

For each down adapter, check the underlying service:

| Kind | Likely cause | Verify |
|---|---|---|
| `core_banking` | bank's T24/FIS/FlexCube down or slow | bank IT status page |
| `crm` (Salesforce) | OAuth token expired, instance maintenance | salesforce.com/trust |
| `market_data` (Bloomberg) | BLPAPI session dropped | restart `bbcomm` on the gateway |

## Contain

- The reference `InMemoryCoreBanking/Crm/MarketData` adapters can be
  registered as **fallbacks** in dev/staging, never in production. If a
  prod adapter is down for > 1 hour, decide whether to:
  - Fail loudly (return 503 to the caller) — preferred for core banking
    when freshness matters more than continuity.
  - Serve stale data with a banner (acceptable for market data when the
    last snapshot is < 24 h old).

## Resolve

When the upstream comes back, the next health probe will mark the
adapter `ok: true` automatically. No manual intervention needed unless
you swapped to a fallback during the outage — in that case re-register
the real adapter via the deployment config and restart the API server.

## Related

- Code: `integrations/registry.ts`, `integrations/types.ts`
- Stubs: `integrations/crm/salesforce.ts`, `integrations/marketData/bloomberg.ts`
