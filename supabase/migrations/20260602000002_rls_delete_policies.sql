-- Fills the DELETE policy gap left by 20260406000001_multi_entity.sql.
-- Only Admin role (set by tenancy middleware via app.current_user_role) may
-- delete, and only within the current entity.
--
-- Tables deliberately excluded (append-only):
--   audit_log, *_versions, pricing_snapshots

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients','products','business_units','deals','rules','users',
    'behavioural_models','yield_curves','rate_cards','liquidity_curves',
    'esg_transition_grid','esg_physical_grid','pricing_results'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_entity_delete', tbl
    );
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR DELETE TO authenticated
        USING (
          entity_id = get_current_entity_id()
          AND get_current_user_role() = 'Admin'
        )
    $f$, tbl || '_entity_delete', tbl);
  END LOOP;
END $$;
