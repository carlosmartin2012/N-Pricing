-- Migration: Elasticity models persistence
--
-- Context: pivot §Bloque D. Calibrated log-linear elasticity models are
-- computed from deal outcomes (won_lost captured in deals table) and
-- persisted here for consumption by:
--   - PriceElasticityDashboard (reporting)
--   - CalculatorRecommendationPanel (Bloque E, real-time recommendation)
--
-- Versioning: each recalibration inserts a new row and marks prior rows
-- is_active=false for that segment_key. Enables historical lineage and
-- rollback.

CREATE TABLE IF NOT EXISTS elasticity_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key TEXT NOT NULL,
  elasticity NUMERIC NOT NULL,
  baseline_conversion NUMERIC NOT NULL,
  anchor_rate NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  method TEXT NOT NULL,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  entity_id TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'elasticity_models' AND constraint_name = 'elasticity_models_confidence_check'
  ) THEN
    ALTER TABLE elasticity_models
      ADD CONSTRAINT elasticity_models_confidence_check
      CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'elasticity_models' AND constraint_name = 'elasticity_models_method_check'
  ) THEN
    ALTER TABLE elasticity_models
      ADD CONSTRAINT elasticity_models_method_check
      CHECK (method IN ('FREQUENTIST', 'BAYESIAN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'elasticity_models' AND constraint_name = 'elasticity_models_sample_size_check'
  ) THEN
    ALTER TABLE elasticity_models
      ADD CONSTRAINT elasticity_models_sample_size_check
      CHECK (sample_size >= 0);
  END IF;
END $$;

-- Only one active model per segment_key (per entity when multi-entity).
CREATE UNIQUE INDEX IF NOT EXISTS idx_elasticity_active_unique
  ON elasticity_models (segment_key, COALESCE(entity_id, ''))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_elasticity_calibrated_at
  ON elasticity_models (calibrated_at DESC);

COMMENT ON TABLE elasticity_models IS
  'Log-linear elasticity models calibrated from deal outcomes. Consumed by PriceElasticityDashboard and Calculator recommendation engine. New rows are inserted on each calibration (nocturnal Edge Function); prior rows are marked is_active=false for the same segment_key. See utils/pricing/elasticityCalibration.ts.';
COMMENT ON COLUMN elasticity_models.segment_key IS
  'Composite key productType|clientType|amountBucket|tenorBucket. See utils/pricing/priceElasticity.ts::buildSegmentKey.';
COMMENT ON COLUMN elasticity_models.method IS
  'FREQUENTIST = OLS on >=30 obs. BAYESIAN = shrinkage to expert prior for low-volume segments.';
COMMENT ON COLUMN elasticity_models.confidence IS
  'Proxy for sample size: LOW (<30), MEDIUM (30-99), HIGH (>=100).';
