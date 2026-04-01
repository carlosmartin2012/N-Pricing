-- ESG Grid Versioning
-- Track changes to transition and physical risk grids over time.

-- Add versioning columns to esg_transition_grid
ALTER TABLE esg_transition_grid ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE esg_transition_grid ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE;
ALTER TABLE esg_transition_grid ADD COLUMN IF NOT EXISTS effective_to DATE;
ALTER TABLE esg_transition_grid ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- Add versioning columns to esg_physical_grid
ALTER TABLE esg_physical_grid ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE esg_physical_grid ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE;
ALTER TABLE esg_physical_grid ADD COLUMN IF NOT EXISTS effective_to DATE;
ALTER TABLE esg_physical_grid ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- Immutable history tables
CREATE TABLE IF NOT EXISTS esg_transition_versions (
  id SERIAL PRIMARY KEY,
  grid_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  classification TEXT NOT NULL,
  sector TEXT,
  adjustment_bps NUMERIC DEFAULT 0,
  description TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grid_id, version)
);

CREATE TABLE IF NOT EXISTS esg_physical_versions (
  id SERIAL PRIMARY KEY,
  grid_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  location_type TEXT,
  adjustment_bps NUMERIC DEFAULT 0,
  description TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grid_id, version)
);

-- RLS
ALTER TABLE esg_transition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_physical_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esg_versions_read" ON esg_transition_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_versions_insert" ON esg_transition_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE email = auth.jwt()->>'email' AND role IN ('Admin', 'Risk_Manager')));
CREATE POLICY "esg_versions_no_update" ON esg_transition_versions FOR UPDATE USING (false);
CREATE POLICY "esg_versions_no_delete" ON esg_transition_versions FOR DELETE USING (false);

CREATE POLICY "esg_phys_versions_read" ON esg_physical_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg_phys_versions_insert" ON esg_physical_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE email = auth.jwt()->>'email' AND role IN ('Admin', 'Risk_Manager')));
CREATE POLICY "esg_phys_versions_no_update" ON esg_physical_versions FOR UPDATE USING (false);
CREATE POLICY "esg_phys_versions_no_delete" ON esg_physical_versions FOR DELETE USING (false);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_esg_trans_ver_grid ON esg_transition_versions(grid_id);
CREATE INDEX IF NOT EXISTS idx_esg_phys_ver_grid ON esg_physical_versions(grid_id);
