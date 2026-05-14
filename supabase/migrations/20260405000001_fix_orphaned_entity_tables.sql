-- Cleanup: if entities/groups/entity_users were created with TEXT ids
-- (artifact of a partially-rolled-back run of 20260406000001_multi_entity.sql),
-- drop them so the main migration can recreate them with the correct UUID type.
--
-- Safe to run in any environment:
--   • If entities.id is already UUID (dev, CI) → the IF block is FALSE → no-op.
--   • If entities.id is TEXT (production orphan) → tables are dropped with CASCADE
--     so 20260406000001_multi_entity.sql recreates them cleanly with UUID PKs.
--
-- Idempotent: IF NOT EXISTS / IF EXISTS throughout; safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'entities'
      AND  column_name  = 'id'
      AND  data_type    = 'text'
  ) THEN
    -- Drop in FK-safe order (child → parent).
    DROP TABLE IF EXISTS entity_users CASCADE;
    DROP TABLE IF EXISTS entities     CASCADE;
    DROP TABLE IF EXISTS groups       CASCADE;
  END IF;
END
$$;
