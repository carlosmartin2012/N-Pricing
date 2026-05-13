# N-Pricing packages

This directory is the stable package boundary for the N-Pricing platform
restructure.

The current app still runs from the historical `api/`, `components/`,
`server/`, `types/`, and `utils/` folders. New code should enter through
these package facades first, then the internal implementation can move behind
them without changing product surfaces.

Initial package map:

- `pricing-core`: deterministic FTP/RAROC pricing entrypoint.
- `domain`: shared banking domain types.
- `evidence`: snapshots, canonical JSON, replay hashing, hash-chain helpers.
- `governance`: methodology, approvals, dossiers, escalation helpers.
- `commercial`: customer pricing, channel pricing, target grid, discipline.
- `data-access`: tenancy/session contracts for DB-facing code.
