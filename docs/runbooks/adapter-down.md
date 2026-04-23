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

## Stress Pricing path (Ola 6 B)

The `/stress-pricing` view calls `MarketDataAdapter.fetchShockedCurve`
per scenario. If the market-data adapter is down, symptoms are:

- The 6-row EBA preset table still renders, but populated from the
  in-memory curve shifted by the hardcoded `curveShiftBps` — no call
  to the real feed happened.
- The header chip reads `CURVE SHIFT · ON` (if flag is set) but the
  curve underneath is the reference curve, not the bank's feed.
- No observable error in the UI; the adapter failure is silent from
  the user's perspective. Only the integrations/health endpoint
  exposes the state.

**Contain**:

1. Verify which path was taken: check `pricing_snapshots.scenario_source`
   for the last hour. `preset_eba_2018_02` + in-memory = fallback path.
   `market_adapter` entries = real feed was reached.

   ```sql
   SELECT scenario_id, scenario_source, count(*)
   FROM pricing_snapshots
   WHERE entity_id = $1
     AND created_at >= NOW() - INTERVAL '1 hour'
     AND scenario_id IS NOT NULL
   GROUP BY scenario_id, scenario_source
   ORDER BY count DESC;
   ```

2. While the adapter is down, `/stress-pricing` is still useful as a
   **qualitative** what-if (the EBA closed-form scenarios don't need
   the bank's feed). Do **not** surface stress-pricing results as
   regulatory figures during an adapter outage.

3. The IRRBB disclaimer footer in the view already states explicitly
   that this is price-testing, not regulatory ΔEVE/SOT. No extra user
   messaging is required.

**Resolve**: when the adapter comes back, scenarios with `source =
'market_adapter'` start flowing again. No manual intervention.

## Hash chain path (Ola 6 C)

Adapter outages do not affect the hash chain — snapshots continue to
be written and chained regardless of which curve source was used. The
`scenario_source` column records which path the deal took, so audit can
distinguish later.

If you see `snapshot_write_failures_total > 0` during an adapter outage,
the root cause is almost never the adapter — check DB contention first
(see [`snapshot-write-failure.md`](./snapshot-write-failure.md)).

## Related

- Code: `integrations/registry.ts`, `integrations/types.ts`
- Stubs: `integrations/crm/salesforce.ts`, `integrations/marketData/bloomberg.ts`
- Stress pricing: `components/StressPricing/StressPricingView.tsx`,
  `utils/pricing/shockPresets.ts`, `supabase/functions/pricing/index.ts`
  (Edge writer with chain + scenario metadata)
- Related runbooks: `snapshot-write-failure.md`, `pricing-latency.md`
