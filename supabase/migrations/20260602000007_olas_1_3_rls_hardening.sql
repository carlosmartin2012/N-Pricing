-- RLS hardening for Olas 1-3 tables (target_grid, pricing_discipline, what_if).
-- Original migrations shipped with open USING (true) policies — any authenticated
-- user in any entity could SELECT or write every row.
--
-- Semantics preserved:
--   * NULL entity_id keeps its meaning of "shared across all tenants"
--     (canonical templates, wildcard tolerance bands, etc.)
--   * Writes are limited to the caller's current entity or to global scope
--     when the caller has the Admin / Risk_Manager / methodologist role.
--
-- Tables covered (9):
--   methodology_snapshots, target_grid_cells, canonical_deal_templates,
--   tolerance_bands, deal_variance_snapshots, pricing_exceptions,
--   sandbox_methodologies, backtesting_runs, budget_targets
--
-- Derived entity_id helper for tables that reference deals by deal_id.

-- ---------- Helper: is the caller allowed to author methodology? ----------
CREATE OR REPLACE FUNCTION is_methodology_author()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN get_current_user_role() IN ('Admin', 'Risk_Manager');
END;
$$;

-- ---------- 1) methodology_snapshots ----------

DROP POLICY IF EXISTS snapshots_read_all        ON methodology_snapshots;
DROP POLICY IF EXISTS snapshots_write_admin     ON methodology_snapshots;
DROP POLICY IF EXISTS methodology_snapshots_read   ON methodology_snapshots;
DROP POLICY IF EXISTS methodology_snapshots_insert ON methodology_snapshots;
DROP POLICY IF EXISTS methodology_snapshots_update ON methodology_snapshots;
DROP POLICY IF EXISTS methodology_snapshots_delete ON methodology_snapshots;

CREATE POLICY methodology_snapshots_read ON methodology_snapshots
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY methodology_snapshots_insert ON methodology_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY methodology_snapshots_update ON methodology_snapshots
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

-- Methodology snapshots are append-only after approval. No DELETE policy → blocked.

-- ---------- 2) target_grid_cells ----------

DROP POLICY IF EXISTS grid_cells_read_all    ON target_grid_cells;
DROP POLICY IF EXISTS grid_cells_write_admin ON target_grid_cells;
DROP POLICY IF EXISTS target_grid_cells_read   ON target_grid_cells;
DROP POLICY IF EXISTS target_grid_cells_insert ON target_grid_cells;
DROP POLICY IF EXISTS target_grid_cells_update ON target_grid_cells;
DROP POLICY IF EXISTS target_grid_cells_delete ON target_grid_cells;

CREATE POLICY target_grid_cells_read ON target_grid_cells
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY target_grid_cells_insert ON target_grid_cells
  FOR INSERT TO authenticated
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY target_grid_cells_update ON target_grid_cells
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY target_grid_cells_delete ON target_grid_cells
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'Admin'
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

-- ---------- 3) canonical_deal_templates ----------

DROP POLICY IF EXISTS templates_read_all    ON canonical_deal_templates;
DROP POLICY IF EXISTS templates_write_admin ON canonical_deal_templates;
DROP POLICY IF EXISTS canonical_deal_templates_read   ON canonical_deal_templates;
DROP POLICY IF EXISTS canonical_deal_templates_insert ON canonical_deal_templates;
DROP POLICY IF EXISTS canonical_deal_templates_update ON canonical_deal_templates;
DROP POLICY IF EXISTS canonical_deal_templates_delete ON canonical_deal_templates;

CREATE POLICY canonical_deal_templates_read ON canonical_deal_templates
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY canonical_deal_templates_insert ON canonical_deal_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY canonical_deal_templates_update ON canonical_deal_templates
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY canonical_deal_templates_delete ON canonical_deal_templates
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'Admin'
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

-- ---------- 4) tolerance_bands ----------

DROP POLICY IF EXISTS tolerance_bands_read_all    ON tolerance_bands;
DROP POLICY IF EXISTS tolerance_bands_write_admin ON tolerance_bands;
DROP POLICY IF EXISTS tolerance_bands_read   ON tolerance_bands;
DROP POLICY IF EXISTS tolerance_bands_insert ON tolerance_bands;
DROP POLICY IF EXISTS tolerance_bands_update ON tolerance_bands;
DROP POLICY IF EXISTS tolerance_bands_delete ON tolerance_bands;

CREATE POLICY tolerance_bands_read ON tolerance_bands
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY tolerance_bands_insert ON tolerance_bands
  FOR INSERT TO authenticated
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY tolerance_bands_update ON tolerance_bands
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY tolerance_bands_delete ON tolerance_bands
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'Admin'
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

-- ---------- 5) deal_variance_snapshots ----------
-- Inherits entity via deals.entity_id. Lookup joins on deal_id.

DROP POLICY IF EXISTS variance_read_all    ON deal_variance_snapshots;
DROP POLICY IF EXISTS variance_write_admin ON deal_variance_snapshots;
DROP POLICY IF EXISTS deal_variance_snapshots_read   ON deal_variance_snapshots;
DROP POLICY IF EXISTS deal_variance_snapshots_insert ON deal_variance_snapshots;

CREATE POLICY deal_variance_snapshots_read ON deal_variance_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_variance_snapshots.deal_id
        AND d.entity_id = ANY(get_accessible_entity_ids())
    )
  );

CREATE POLICY deal_variance_snapshots_insert ON deal_variance_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_variance_snapshots.deal_id
        AND d.entity_id = get_current_entity_id()
    )
  );

-- Variance snapshots are append-only; no UPDATE / DELETE policy.

-- ---------- 6) pricing_exceptions ----------
-- Inherits entity via deals.entity_id.

DROP POLICY IF EXISTS exceptions_read_all  ON pricing_exceptions;
DROP POLICY IF EXISTS exceptions_write_all ON pricing_exceptions;
DROP POLICY IF EXISTS pricing_exceptions_read   ON pricing_exceptions;
DROP POLICY IF EXISTS pricing_exceptions_insert ON pricing_exceptions;
DROP POLICY IF EXISTS pricing_exceptions_update ON pricing_exceptions;

CREATE POLICY pricing_exceptions_read ON pricing_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = pricing_exceptions.deal_id
        AND d.entity_id = ANY(get_accessible_entity_ids())
    )
  );

CREATE POLICY pricing_exceptions_insert ON pricing_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = pricing_exceptions.deal_id
        AND d.entity_id = get_current_entity_id()
    )
  );

-- Approvals update the exception row. Restricted to authoriser roles.
CREATE POLICY pricing_exceptions_update ON pricing_exceptions
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('Admin', 'Risk_Manager')
    AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = pricing_exceptions.deal_id
        AND d.entity_id = get_current_entity_id()
    )
  );

-- ---------- 7) sandbox_methodologies ----------

DROP POLICY IF EXISTS sandbox_read_all    ON sandbox_methodologies;
DROP POLICY IF EXISTS sandbox_write_admin ON sandbox_methodologies;
DROP POLICY IF EXISTS sandbox_methodologies_read   ON sandbox_methodologies;
DROP POLICY IF EXISTS sandbox_methodologies_insert ON sandbox_methodologies;
DROP POLICY IF EXISTS sandbox_methodologies_update ON sandbox_methodologies;
DROP POLICY IF EXISTS sandbox_methodologies_delete ON sandbox_methodologies;

CREATE POLICY sandbox_methodologies_read ON sandbox_methodologies
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY sandbox_methodologies_insert ON sandbox_methodologies
  FOR INSERT TO authenticated
  WITH CHECK (entity_id IS NULL OR entity_id = get_current_entity_id());

CREATE POLICY sandbox_methodologies_update ON sandbox_methodologies
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (entity_id IS NULL OR entity_id = get_current_entity_id());

CREATE POLICY sandbox_methodologies_delete ON sandbox_methodologies
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() IN ('Admin', 'Risk_Manager')
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

-- ---------- 8) backtesting_runs ----------

DROP POLICY IF EXISTS backtesting_read_all    ON backtesting_runs;
DROP POLICY IF EXISTS backtesting_write_admin ON backtesting_runs;
DROP POLICY IF EXISTS backtesting_runs_read   ON backtesting_runs;
DROP POLICY IF EXISTS backtesting_runs_insert ON backtesting_runs;
DROP POLICY IF EXISTS backtesting_runs_update ON backtesting_runs;

CREATE POLICY backtesting_runs_read ON backtesting_runs
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY backtesting_runs_insert ON backtesting_runs
  FOR INSERT TO authenticated
  WITH CHECK (entity_id IS NULL OR entity_id = get_current_entity_id());

CREATE POLICY backtesting_runs_update ON backtesting_runs
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (entity_id IS NULL OR entity_id = get_current_entity_id());

-- Backtesting runs are historical. No DELETE policy.

-- ---------- 9) budget_targets ----------

DROP POLICY IF EXISTS budget_read_all    ON budget_targets;
DROP POLICY IF EXISTS budget_write_admin ON budget_targets;
DROP POLICY IF EXISTS budget_targets_read   ON budget_targets;
DROP POLICY IF EXISTS budget_targets_insert ON budget_targets;
DROP POLICY IF EXISTS budget_targets_update ON budget_targets;
DROP POLICY IF EXISTS budget_targets_delete ON budget_targets;

CREATE POLICY budget_targets_read ON budget_targets
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY budget_targets_insert ON budget_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY budget_targets_update ON budget_targets
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    is_methodology_author()
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY budget_targets_delete ON budget_targets
  FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'Admin'
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );
