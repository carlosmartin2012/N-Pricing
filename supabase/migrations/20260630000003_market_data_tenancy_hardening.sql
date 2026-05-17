-- Market data tenancy hardening.
--
-- `yield_curves`, `liquidity_curves`, and `behavioural_models` already gained
-- entity_id in 20260406000001_multi_entity.sql. `yield_curve_history` was added
-- later and missed that sweep, so route-level scoping could not be enforced
-- consistently for historical curves.

ALTER TABLE yield_curve_history
  ADD COLUMN IF NOT EXISTS entity_id UUID
    REFERENCES entities(id)
    DEFAULT '00000000-0000-0000-0000-000000000010';

UPDATE yield_curve_history
SET entity_id = '00000000-0000-0000-0000-000000000010'
WHERE entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_yield_curve_history_entity
  ON yield_curve_history(entity_id);

ALTER TABLE yield_curve_history
  DROP CONSTRAINT IF EXISTS yield_curve_history_curve_id_snapshot_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_yield_curve_history_entity_curve_date
  ON yield_curve_history(entity_id, curve_id, snapshot_date);

DROP POLICY IF EXISTS ych_read ON yield_curve_history;
DROP POLICY IF EXISTS ych_insert ON yield_curve_history;
DROP POLICY IF EXISTS yield_curve_history_entity_read ON yield_curve_history;
DROP POLICY IF EXISTS yield_curve_history_entity_insert ON yield_curve_history;
DROP POLICY IF EXISTS yield_curve_history_entity_update ON yield_curve_history;

ALTER TABLE yield_curve_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY yield_curve_history_entity_read ON yield_curve_history
  FOR SELECT
  TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY yield_curve_history_entity_insert ON yield_curve_history
  FOR INSERT
  TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

CREATE POLICY yield_curve_history_entity_update ON yield_curve_history
  FOR UPDATE
  TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

-- Prevent concurrent brand-new tenants from creating two genesis links in the
-- pricing snapshot chain. Historical pre-chain rows can still have NULL because
-- they predate 20260619000003; forward-looking genesis rows cannot fork.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pricing_snapshots_forward_genesis
  ON pricing_snapshots(entity_id)
  WHERE prev_output_hash IS NULL
    AND created_at >= TIMESTAMPTZ '2026-06-19 00:00:03+00';
