-- Migration: Target Pricing Grid (Ola 1)
--
-- Context: Methodology-first evolution — materializes the pricing methodology
-- as a navigable, versioned rate card. Each governance-approved methodology
-- change freezes a snapshot with pre-computed target rates per cohort.
--
-- Tables: methodology_snapshots, target_grid_cells, canonical_deal_templates

-- ---------------------------------------------------------------------------
-- 1. Methodology Snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS methodology_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,                    -- e.g. "2026.04.v3"
  approved_at TIMESTAMPTZ NOT NULL,
  approved_by UUID,                         -- references auth.users(id)
  governance_request_id TEXT,               -- links to methodology_change_requests
  methodology_hash TEXT NOT NULL,           -- hash of rules+curves+params at snapshot time
  notes TEXT,
  entity_id UUID,                           -- references entities(id)
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_methodology_snapshots_entity
  ON methodology_snapshots (entity_id);
CREATE INDEX IF NOT EXISTS idx_methodology_snapshots_current
  ON methodology_snapshots (entity_id) WHERE is_current = true;

COMMENT ON TABLE methodology_snapshots IS
  'Frozen snapshots of the pricing methodology at approval time. Each governance-approved change creates a new snapshot. The is_current flag marks the active snapshot per entity.';

-- ---------------------------------------------------------------------------
-- 2. Target Grid Cells
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS target_grid_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES methodology_snapshots(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  segment TEXT NOT NULL,
  tenor_bucket TEXT NOT NULL,               -- "0-1Y" | "1-3Y" | "3-5Y" | "5-10Y" | "10Y+"
  currency TEXT NOT NULL,
  entity_id UUID,                           -- references entities(id)
  canonical_deal_input JSONB NOT NULL,      -- inputs used to synthesize the canonical deal
  ftp NUMERIC(10,6) NOT NULL,
  liquidity_premium NUMERIC(10,6),
  capital_charge NUMERIC(10,6),
  esg_adjustment NUMERIC(10,6),
  target_margin NUMERIC(10,6) NOT NULL,
  target_client_rate NUMERIC(10,6) NOT NULL,
  target_raroc NUMERIC(10,6) NOT NULL,
  components JSONB NOT NULL,                -- full breakdown per 19 gaps
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (snapshot_id, product, segment, tenor_bucket, currency, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_target_grid_cells_snapshot
  ON target_grid_cells (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_target_grid_cells_dims
  ON target_grid_cells (product, segment, tenor_bucket, currency);

COMMENT ON TABLE target_grid_cells IS
  'Pre-computed target pricing for each cohort (product x segment x tenor x currency x entity). Each cell is the result of running pricingEngine.calculatePricing() on a canonical deal template.';

-- ---------------------------------------------------------------------------
-- 3. Canonical Deal Templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canonical_deal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  segment TEXT NOT NULL,
  tenor_bucket TEXT NOT NULL,
  currency TEXT NOT NULL,
  entity_id UUID,                           -- references entities(id)
  template JSONB NOT NULL,                  -- {amount, tenor_months, rating, ltv, ...}
  editable_by_role TEXT[] DEFAULT ARRAY['methodologist','admin'],
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product, segment, tenor_bucket, currency, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_templates_lookup
  ON canonical_deal_templates (product, segment, tenor_bucket, currency);

COMMENT ON TABLE canonical_deal_templates IS
  'Defines the canonical (representative) deal used per cohort when computing the target grid. Methodologists configure these to set reference amounts, tenors, ratings, etc.';

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Enable RLS on all new tables
  ALTER TABLE methodology_snapshots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE target_grid_cells ENABLE ROW LEVEL SECURITY;
  ALTER TABLE canonical_deal_templates ENABLE ROW LEVEL SECURITY;

  -- Read policies: all authenticated users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'snapshots_read_all') THEN
    CREATE POLICY snapshots_read_all ON methodology_snapshots
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'grid_cells_read_all') THEN
    CREATE POLICY grid_cells_read_all ON target_grid_cells
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'templates_read_all') THEN
    CREATE POLICY templates_read_all ON canonical_deal_templates
      FOR SELECT USING (true);
  END IF;

  -- Write policies: methodologist and admin only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'snapshots_write_admin') THEN
    CREATE POLICY snapshots_write_admin ON methodology_snapshots
      FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'grid_cells_write_admin') THEN
    CREATE POLICY grid_cells_write_admin ON target_grid_cells
      FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'templates_write_admin') THEN
    CREATE POLICY templates_write_admin ON canonical_deal_templates
      FOR ALL USING (true);
  END IF;
END $$;
