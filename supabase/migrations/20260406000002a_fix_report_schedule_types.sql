-- Cleanup: if report_schedules / report_runs were created by the old inline
-- schema with entity_id TEXT (instead of UUID), drop them so that
-- 20260406000003_report_schedules.sql can recreate them with the correct type.
--
-- Safe to run in any environment:
--   • Tables don't exist yet (production, fresh CI) → DROP IF EXISTS is a no-op.
--   • entity_id is already UUID (future envs) → IF block is FALSE → no-op.
--   • entity_id is TEXT (dev with old inline-schema tables) → tables dropped,
--     next migration recreates them cleanly with UUID.
--
-- Idempotent: IF EXISTS throughout; safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'report_schedules'
      AND  column_name  = 'entity_id'
      AND  data_type    = 'text'
  ) THEN
    DROP TABLE IF EXISTS report_runs      CASCADE;
    DROP TABLE IF EXISTS report_schedules CASCADE;
  END IF;
END
$$;
