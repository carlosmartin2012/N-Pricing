-- Rule Versioning: track historical changes to pricing rules
-- Each rule change creates a new version; queries default to the latest active version.

-- Add versioning columns to existing rules table
ALTER TABLE rules ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS effective_to DATE DEFAULT NULL;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS superseded_by INTEGER;

-- Rule versions history table (immutable log)
CREATE TABLE IF NOT EXISTS rule_versions (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  business_unit TEXT,
  product TEXT,
  segment TEXT,
  tenor TEXT,
  base_method TEXT,
  base_reference TEXT,
  spread_method TEXT,
  liquidity_reference TEXT,
  strategic_spread NUMERIC DEFAULT 0,
  formula_spec JSONB,
  effective_from DATE NOT NULL,
  effective_to DATE,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, version)
);

-- Enable RLS
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;

-- Policies: all authenticated can read, only Admin/Risk_Manager can insert
CREATE POLICY "rule_versions_read" ON rule_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rule_versions_insert" ON rule_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE email = auth.jwt()->>'email'
      AND role IN ('Admin', 'Risk_Manager')
    )
  );

-- Immutable: no updates or deletes on version history
CREATE POLICY "rule_versions_no_update" ON rule_versions
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "rule_versions_no_delete" ON rule_versions
  FOR DELETE TO authenticated USING (false);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rule_versions;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rule_versions_rule_id ON rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_active ON rule_versions(rule_id, effective_to) WHERE effective_to IS NULL;

-- View: latest active version of each rule
CREATE OR REPLACE VIEW rules_current AS
SELECT rv.*
FROM rule_versions rv
INNER JOIN (
  SELECT rule_id, MAX(version) as max_version
  FROM rule_versions
  WHERE effective_to IS NULL
  GROUP BY rule_id
) latest ON rv.rule_id = latest.rule_id AND rv.version = latest.max_version;
