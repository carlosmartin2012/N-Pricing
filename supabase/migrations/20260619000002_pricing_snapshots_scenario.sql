-- Migration: extend pricing_snapshots with stress-scenario tagging (Ola 6 B.6).
--
-- Adds two optional columns so each snapshot remembers which EBA GL 2018/02
-- scenario (or custom shock) produced it. NULL = base scenario (no curve
-- shift applied) — preserves the contract of all historical snapshots
-- inserted before this migration landed.
--
-- Use cases unlocked:
--   1. Stress Pricing view queries `WHERE scenario_id = 'parallel_up_200'`
--      to render the row for that preset without re-running the motor.
--   2. SLO dashboard can group p95 latency by scenario to detect
--      regressions in the curve-shift code path.
--   3. Audit trail: reviewers see exactly which preset a given replay used.
--
-- Additive and fully backwards compatible. No UPDATE / DELETE policies are
-- touched — pricing_snapshots is immutable by RLS.

ALTER TABLE pricing_snapshots
  ADD COLUMN IF NOT EXISTS scenario_id      TEXT,
  ADD COLUMN IF NOT EXISTS scenario_source  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pricing_snapshots'
      AND constraint_name = 'pricing_snapshots_scenario_source_check'
  ) THEN
    ALTER TABLE pricing_snapshots
      ADD CONSTRAINT pricing_snapshots_scenario_source_check
      CHECK (scenario_source IS NULL OR scenario_source IN (
        'preset_eba_2018_02', 'market_adapter', 'user_custom'
      ));
  END IF;
END $$;

-- Partial index: only populated for rows with a non-null scenario_id, so
-- the default base-scenario path (vast majority) does not bloat the index.
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_scenario
  ON pricing_snapshots (entity_id, scenario_id, created_at DESC)
  WHERE scenario_id IS NOT NULL;

COMMENT ON COLUMN pricing_snapshots.scenario_id IS
  'Shock scenario identifier (e.g. parallel_up_200, steepener). NULL = base.';
COMMENT ON COLUMN pricing_snapshots.scenario_source IS
  'Provenance: preset_eba_2018_02 | market_adapter | user_custom. NULL when scenario_id is NULL.';
