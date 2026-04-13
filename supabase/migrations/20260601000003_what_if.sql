-- Migration: Methodology What-If & Optimization (Ola 3)
--
-- Context: Enables sandbox methodology simulation, elasticity models,
-- backtesting, market benchmarks comparison, and budget consistency.
--
-- Tables: sandbox_methodologies, backtesting_runs, budget_targets

-- ---------------------------------------------------------------------------
-- 1. Sandbox Methodologies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sandbox_methodologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_snapshot_id UUID NOT NULL REFERENCES methodology_snapshots(id),
  status TEXT NOT NULL DEFAULT 'draft',
  diffs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  entity_id UUID
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sandbox_methodologies' AND constraint_name = 'sandbox_status_check'
  ) THEN
    ALTER TABLE sandbox_methodologies
      ADD CONSTRAINT sandbox_status_check
      CHECK (status IN ('draft', 'computing', 'ready', 'published', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sandbox_entity
  ON sandbox_methodologies (entity_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_status
  ON sandbox_methodologies (status);

COMMENT ON TABLE sandbox_methodologies IS
  'Sandbox copies of methodologies for what-if analysis. Diffs store parameter changes vs the base snapshot.';

-- ---------------------------------------------------------------------------
-- 2. Backtesting Runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backtesting_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sandbox_id UUID REFERENCES sandbox_methodologies(id),
  snapshot_id UUID NOT NULL REFERENCES methodology_snapshots(id),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deal_count INT DEFAULT 0,
  filters JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  entity_id UUID,
  created_by_email TEXT NOT NULL,
  result JSONB                               -- full BacktestResult stored as JSON
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'backtesting_runs' AND constraint_name = 'backtest_status_check'
  ) THEN
    ALTER TABLE backtesting_runs
      ADD CONSTRAINT backtest_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_backtesting_entity
  ON backtesting_runs (entity_id);

COMMENT ON TABLE backtesting_runs IS
  'Backtesting run records: applies a methodology snapshot to historical deals and stores the simulated vs actual P&L comparison.';

-- ---------------------------------------------------------------------------
-- 3. Budget Targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  segment TEXT NOT NULL,
  currency TEXT NOT NULL,
  entity_id UUID,
  period TEXT NOT NULL,                      -- e.g. "2026-Q2", "2026"
  target_nii NUMERIC(18,2) NOT NULL,
  target_volume NUMERIC(18,2) NOT NULL,
  target_raroc NUMERIC(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_targets_cohort_period
  ON budget_targets (product, segment, currency, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), period);
CREATE INDEX IF NOT EXISTS idx_budget_targets_lookup
  ON budget_targets (product, segment, currency, period);

COMMENT ON TABLE budget_targets IS
  'Commercial budget objectives by product/segment/currency/period. Used to validate target grid consistency with business plan.';

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE sandbox_methodologies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE backtesting_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE budget_targets ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sandbox_read_all') THEN
    CREATE POLICY sandbox_read_all ON sandbox_methodologies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sandbox_write_admin') THEN
    CREATE POLICY sandbox_write_admin ON sandbox_methodologies FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'backtesting_read_all') THEN
    CREATE POLICY backtesting_read_all ON backtesting_runs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'backtesting_write_admin') THEN
    CREATE POLICY backtesting_write_admin ON backtesting_runs FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_read_all') THEN
    CREATE POLICY budget_read_all ON budget_targets FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_write_admin') THEN
    CREATE POLICY budget_write_admin ON budget_targets FOR ALL USING (true);
  END IF;
END $$;
