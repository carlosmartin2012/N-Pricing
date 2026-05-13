# N-Pricing platform restructure

> Status: Phase 1 package boundary implementation in place; migration of core
> pricing/evidence/commercial/governance consumers validated. `packages/*`
> are now npm workspaces with private package manifests.

## Target shape

N-Pricing is being restructured around stable package boundaries while the
existing app keeps running from the historical folders.

The implementation rule is simple: new product logic should depend on package
facades first, not on deep `utils/*`, `server/*`, or `components/*` paths. The
facades can re-export legacy internals during migration, then the internals can
move without changing callers.

## Package boundaries

| Package                  | Responsibility                                                                                | Current backing implementation                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@npricing/pricing-core` | FTP/RAROC pricing entrypoint, batch repricing, pricing feature flags                          | `utils/pricingEngine.ts`                                                                                     |
| `@npricing/domain`       | Shared banking domain types                                                                   | `types.ts`, `types/*`                                                                                        |
| `@npricing/evidence`     | Canonical JSON, snapshot hashes, hash-chain verification, signed dossiers, snapshot read DTOs | `utils/canonicalJson.ts`, `utils/snapshotHash.ts`, `utils/governance/dossierSigning.ts`, injected DB readers |
| `@npricing/governance`   | Methodology change, approvals, dossiers, escalation evaluation                                | `utils/governance/*`                                                                                         |
| `@npricing/commercial`   | Customer pricing, CLV/NBA, campaigns, channel pricing, target grid                            | `utils/customer360/*`, `utils/clv/*`, `utils/channels/*`, `utils/targetGrid/*`                               |
| `@npricing/data-access`  | Query/transaction/tenancy repository contracts                                                | Local structural contracts, not coupled to `server/db.ts`                                                    |
| `@npricing/platform`     | Aggregated namespace for platform consumers                                                   | Package facades                                                                                              |

## First implemented seam

`@npricing/pricing-core` wraps the existing `calculatePricing` motor with a
stable request/result contract:

- `calculatePricingOutput(request)` returns the legacy `FTPResult`.
- `calculatePricingCore(request)` returns `{ output, metadata }`.
- `batchRepriceCore(request)` preserves current batch behavior.
- `calculatePricing(...)` and `batchReprice(...)` provide compatibility
  adapters for existing callers while still crossing the package boundary.

The legacy motor still lives in `utils/pricingEngine.ts`, but callers can now
choose the package boundary. The first behavior extraction also moves curve
shock mode from an environment-only decision to an explicit request/context
feature flag:

```ts
calculatePricingOutput({
  deal,
  approvalMatrix,
  context,
  shocks,
  featureFlags: { applyCurveShift: true },
});
```

If the flag is omitted, the legacy `VITE_PRICING_APPLY_CURVE_SHIFT` behavior
is preserved.

Current migrated consumers:

- Pricing motor calls in calculator/reporting/stress/blotter/accounting UI
  surfaces, target-grid compute, backtesting, inverse optimizer, snapshot
  replay, demo workspace and governance portfolio snapshots now enter through
  `@npricing/pricing-core`.
- Snapshot list/detail/verify-chain routes and replay hashing now enter through
  `@npricing/evidence`.
- Governance routes consume dossier and escalation helpers through
  `@npricing/governance`.
- Channel pricing, Customer 360 route, CLV route, CLV snapshot worker,
  target-grid compute, sandbox impact and auth/channel rate-limit helpers now
  enter through `@npricing/commercial`.
- `@npricing/data-access` owns structural query/transaction/tenant contracts so
  package code can receive DB capabilities by injection instead of importing
  server runtime modules.
- `App.tsx` is reduced to the authenticated shell, session/layout state and
  global modals; the lazy route table lives in `appRoutes.tsx`.
- `utils/__tests__/packageBoundaryImports.test.ts` guards runtime consumers
  against new deep imports when a package facade exists.
- Root `package.json` declares `workspaces: ["packages/*"]`; each package has
  a private `package.json` exporting `src/index.ts`.
- Market benchmarks are exposed through the commercial package facade
  (`findBenchmark`, `compareToMarket`, CSV parser) and administered through
  `/market-benchmarks`.

## Migration rules

1. Do not move calculation logic and change formulas in the same change.
2. Keep legacy routes and UI imports working until their package consumer is
   covered by tests.
3. New code must import from `@npricing/*` when a package facade exists.
4. Domain packages may re-export legacy implementation during migration, but
   they must not import React components.
5. DB-facing code should receive tenancy/session context explicitly; avoid
   module-level DB imports in package contracts.

## Closed and deferred implementation waves

1. Runtime consumers are guarded by package-boundary tests. Low-level engine
   regression tests may still import legacy internals while they assert numeric
   parity against the historical motor.
2. Physical movement of calculation files under `packages/*` remains explicitly
   deferred until a mechanical move can be done without formula changes.
3. Package-level private manifests and root npm workspaces are in place; TS/Vite
   aliases remain the runtime resolution path for the current SPA/server build.
