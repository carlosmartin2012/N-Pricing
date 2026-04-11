-- Migration: Add credit risk input fields to deals table
-- Context: These fields already exist on the Transaction type (types.ts) and
-- are consumed by pricingEngine, creditRiskEngine, delegationEngine, and the
-- IFRS9StagePanel UI. They were NOT persisted, so values entered by users were
-- silently dropped on save. This migration closes that gap.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS client_rating TEXT,
  ADD COLUMN IF NOT EXISTS ltv_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS ifrs9_stage INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_ifrs9_stage_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_ifrs9_stage_check
      CHECK (ifrs9_stage IS NULL OR ifrs9_stage IN (1, 2, 3));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_ltv_pct_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_ltv_pct_check
      CHECK (ltv_pct IS NULL OR (ltv_pct >= 0 AND ltv_pct <= 500));
  END IF;
END $$;

COMMENT ON COLUMN deals.client_rating IS 'Internal or external credit rating (AAA/AA/A/BBB/BB/B/CCC/D). Consumed by creditRiskEngine and delegationEngine.';
COMMENT ON COLUMN deals.ltv_pct IS 'Loan-to-Value percentage. Used by delegationEngine matrix and creditRiskEngine LGD derivation.';
COMMENT ON COLUMN deals.ifrs9_stage IS 'Explicit IFRS9 stage override (1/2/3). NULL means derive via SICR in pricingEngine.';
