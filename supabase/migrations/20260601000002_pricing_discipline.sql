-- Migration: Pricing Discipline & Gap Analytics (Ola 2)
--
-- Context: Measures deviation of realized deals vs target grid,
-- detects margin leakage and outliers, provides tolerance bands
-- and pricing exception workflow.
--
-- Tables: tolerance_bands, deal_variance_snapshots, pricing_exceptions

-- ---------------------------------------------------------------------------
-- 1. Tolerance Bands
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tolerance_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT,
  segment TEXT,
  tenor_bucket TEXT,
  currency TEXT,
  entity_id UUID,
  ftp_bps_tolerance NUMERIC(8,2) NOT NULL,
  raroc_pp_tolerance NUMERIC(8,2) NOT NULL,
  margin_bps_tolerance NUMERIC(8,2),
  priority INT DEFAULT 100,
  active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tolerance_bands_lookup
  ON tolerance_bands (product, segment, tenor_bucket, currency, active);
CREATE INDEX IF NOT EXISTS idx_tolerance_bands_entity
  ON tolerance_bands (entity_id) WHERE entity_id IS NOT NULL;

COMMENT ON TABLE tolerance_bands IS
  'Configurable tolerance bands for pricing discipline. Lower priority number wins. Null dimension = wildcard (matches all).';

-- ---------------------------------------------------------------------------
-- 2. Deal Variance Snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_variance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES methodology_snapshots(id),
  cohort JSONB NOT NULL,
  target_ftp NUMERIC(10,6),
  realized_ftp NUMERIC(10,6),
  ftp_variance_bps NUMERIC(8,2),
  target_raroc NUMERIC(10,6),
  realized_raroc NUMERIC(10,6),
  raroc_variance_pp NUMERIC(8,2),
  target_margin NUMERIC(10,6),
  realized_margin NUMERIC(10,6),
  margin_variance_bps NUMERIC(8,2),
  leakage_eur NUMERIC(18,2),
  out_of_band BOOLEAN NOT NULL,
  band_applied_id UUID REFERENCES tolerance_bands(id),
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variance_deal_snapshot
  ON deal_variance_snapshots (deal_id, snapshot_id);
CREATE INDEX IF NOT EXISTS idx_variance_cohort
  ON deal_variance_snapshots USING gin (cohort);
CREATE INDEX IF NOT EXISTS idx_variance_out_of_band
  ON deal_variance_snapshots (out_of_band) WHERE out_of_band = true;
CREATE INDEX IF NOT EXISTS idx_variance_snapshot
  ON deal_variance_snapshots (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_variance_deal
  ON deal_variance_snapshots (deal_id);

COMMENT ON TABLE deal_variance_snapshots IS
  'Per-deal variance against the methodology snapshot active at deal creation time. Variance is frozen at deal creation; re-evaluation only on explicit request.';

-- ---------------------------------------------------------------------------
-- 3. Pricing Exceptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  reason_code TEXT NOT NULL,
  reason_detail TEXT NOT NULL,
  requested_by UUID NOT NULL,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pricing_exceptions' AND constraint_name = 'pricing_exceptions_status_check'
  ) THEN
    ALTER TABLE pricing_exceptions
      ADD CONSTRAINT pricing_exceptions_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'pricing_exceptions' AND constraint_name = 'pricing_exceptions_reason_check'
  ) THEN
    ALTER TABLE pricing_exceptions
      ADD CONSTRAINT pricing_exceptions_reason_check
      CHECK (reason_code IN ('relationship', 'strategic_client', 'market_spread',
                             'competitive_pressure', 'volume_commitment', 'cross_sell', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pricing_exceptions_deal
  ON pricing_exceptions (deal_id);
CREATE INDEX IF NOT EXISTS idx_pricing_exceptions_status
  ON pricing_exceptions (status) WHERE status = 'pending';

COMMENT ON TABLE pricing_exceptions IS
  'Pricing exception workflow: deals priced outside tolerance bands require justification and approval.';

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE tolerance_bands ENABLE ROW LEVEL SECURITY;
  ALTER TABLE deal_variance_snapshots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE pricing_exceptions ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tolerance_bands_read_all') THEN
    CREATE POLICY tolerance_bands_read_all ON tolerance_bands FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tolerance_bands_write_admin') THEN
    CREATE POLICY tolerance_bands_write_admin ON tolerance_bands FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variance_read_all') THEN
    CREATE POLICY variance_read_all ON deal_variance_snapshots FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'variance_write_admin') THEN
    CREATE POLICY variance_write_admin ON deal_variance_snapshots FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'exceptions_read_all') THEN
    CREATE POLICY exceptions_read_all ON pricing_exceptions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'exceptions_write_all') THEN
    CREATE POLICY exceptions_write_all ON pricing_exceptions FOR ALL USING (true);
  END IF;
END $$;
