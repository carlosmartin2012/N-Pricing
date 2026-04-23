-- Ola 6 Bloque C — Snapshot hash chain (tamper evidence).
--
-- Adds `prev_output_hash` so each snapshot references the output_hash of the
-- previous snapshot *for the same tenant*. An actor with DB access who mutates
-- a historical snapshot will break the chain for every subsequent row, which
-- the `verify_chain` endpoint can detect.
--
-- The first snapshot per tenant has `prev_output_hash = NULL` (genesis).
-- Historical snapshots (pre-migration) also carry NULL — only forward-looking
-- snapshots participate in the chain. A backfill script is opt-in and out of
-- scope for this migration.
--
-- Concurrency: two simultaneous pricing calls for the same tenant might both
-- read the same "last output_hash" and try to insert as its successor. The
-- partial unique index catches that as a constraint violation, which the
-- writer must retry. Without the unique index, the chain would fork silently.

ALTER TABLE pricing_snapshots
  ADD COLUMN IF NOT EXISTS prev_output_hash TEXT;

-- Format check: 64 hex chars OR NULL (genesis / pre-migration).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prev_output_hash_format'
      AND conrelid = 'pricing_snapshots'::regclass
  ) THEN
    ALTER TABLE pricing_snapshots
      ADD CONSTRAINT chk_prev_output_hash_format
        CHECK (prev_output_hash IS NULL OR prev_output_hash ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

-- Fork prevention: within a tenant each non-null prev_output_hash can only be
-- referenced once. Partial so multiple genesis rows (NULL) stay legal —
-- historical snapshots + the first snapshot of every new tenant are genesis.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pricing_snapshots_prev_hash
  ON pricing_snapshots (entity_id, prev_output_hash)
  WHERE prev_output_hash IS NOT NULL;

COMMENT ON COLUMN pricing_snapshots.prev_output_hash IS
  'Tamper-evidence chain link. Matches the output_hash of the previous snapshot for the same entity_id, or NULL for the tenant genesis / pre-chain history.';
