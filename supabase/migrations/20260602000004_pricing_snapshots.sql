-- Immutable snapshot table guaranteeing pricing reproducibility.
-- Each row stores the full input + context + output used to compute an FTPResult.
-- See docs/phase-0-design.md §B for semantics and retention rules.

CREATE TABLE IF NOT EXISTS pricing_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL REFERENCES entities(id),
  deal_id           UUID        REFERENCES deals(id) ON DELETE SET NULL,
  pricing_result_id UUID,
  -- NOTE: deliberately NOT a FK to pricing_results(id). pricing_results.id is
  -- BIGSERIAL (legacy schema from 20240101000000_initial_schema.sql) and the
  -- types are incompatible. Linking is best-effort at the application layer.
  -- server/migrate.ts inline schema already omits the FK; this migration now
  -- matches.

  request_id        TEXT        NOT NULL,
  engine_version    TEXT        NOT NULL,
  as_of_date        DATE        NOT NULL,
  used_mock_for     TEXT[]      NOT NULL DEFAULT '{}',

  input             JSONB       NOT NULL,
  context           JSONB       NOT NULL,
  output            JSONB       NOT NULL,

  input_hash        TEXT        NOT NULL,
  output_hash       TEXT        NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_input_hash_format  CHECK (input_hash  ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_output_hash_format CHECK (output_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_snap_entity_created
  ON pricing_snapshots (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_deal
  ON pricing_snapshots (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_result
  ON pricing_snapshots (pricing_result_id);
CREATE INDEX IF NOT EXISTS idx_snap_request
  ON pricing_snapshots (request_id);
CREATE INDEX IF NOT EXISTS idx_snap_engine_version
  ON pricing_snapshots (engine_version);

ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_snapshots_read   ON pricing_snapshots;
DROP POLICY IF EXISTS pricing_snapshots_insert ON pricing_snapshots;

CREATE POLICY pricing_snapshots_read ON pricing_snapshots
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY pricing_snapshots_insert ON pricing_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- No UPDATE and no DELETE policies on purpose → immutable by RLS.

CREATE OR REPLACE FUNCTION enforce_snapshot_hashes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.input_hash IS NULL OR NEW.output_hash IS NULL THEN
    RAISE EXCEPTION 'snapshot_missing_hashes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_snapshot_hashes ON pricing_snapshots;
CREATE TRIGGER trg_enforce_snapshot_hashes
  BEFORE INSERT ON pricing_snapshots
  FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_hashes();

COMMENT ON TABLE pricing_snapshots IS
  'Immutable reproducibility snapshots. Full input+context+output for every pricing call.';
COMMENT ON COLUMN pricing_snapshots.used_mock_for IS
  'Config sections that fell back to mock data. Production SLO: empty array.';
