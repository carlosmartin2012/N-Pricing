-- Migration: Deal outcome capture for pricing elasticity calibration
--
-- Context: N-Pricing evolution from "FTP motor + pricing analytics escondidos"
-- toward a full pricing engine requires calibrating elasticity models on real
-- win/loss data. Today Transaction.status includes 'Rejected' but there is no
-- way to distinguish a commercial loss (we proposed a rate, client went
-- elsewhere) from an internal rejection (governance said no). Nor is there a
-- record of competitor rate, proposed rate snapshot, or decision timeline.
--
-- These five fields unlock:
--   - utils/pricing/priceElasticity.ts calibration from HistoricalDemandObservation
--   - Real ExPostRAROCDashboard (today uses Math.random for realized figures)
--   - Future market reference rate benchmarking
--
-- Assumption: pilot client starts clean (no historical backfill). All new
-- deals from pilot go-live capture outcome. Competitor rate is optional
-- and fed manually (per pilot decision — no CRM feed yet).

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS won_lost TEXT,
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS competitor_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS proposed_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS decision_date TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_won_lost_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_won_lost_check
      CHECK (won_lost IS NULL OR won_lost IN ('WON', 'LOST', 'PENDING', 'WITHDRAWN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_loss_reason_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_loss_reason_check
      CHECK (
        loss_reason IS NULL OR loss_reason IN (
          'PRICE', 'COVENANT', 'RELATIONSHIP', 'COMPETITOR',
          'TIMING', 'CLIENT_WITHDREW', 'OTHER'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_competitor_rate_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_competitor_rate_check
      CHECK (competitor_rate IS NULL OR (competitor_rate >= 0 AND competitor_rate <= 50));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deals' AND constraint_name = 'deals_proposed_rate_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_proposed_rate_check
      CHECK (proposed_rate IS NULL OR (proposed_rate >= 0 AND proposed_rate <= 50));
  END IF;
END $$;

COMMENT ON COLUMN deals.won_lost IS
  'Commercial outcome of the deal. WON = client accepted and deal booked. LOST = client chose another counterparty or walked. PENDING = proposal issued, no response yet. WITHDRAWN = bank pulled the proposal. NULL for deals predating capture. Consumed by priceElasticity calibration and ExPostRAROCDashboard.';

COMMENT ON COLUMN deals.loss_reason IS
  'Root cause when won_lost = LOST. Controlled vocabulary to keep elasticity calibration unbiased. PRICE = rate/fee not competitive. COVENANT = non-price terms. RELATIONSHIP = ongoing client relationship influenced decision. COMPETITOR = explicit competitor offer. TIMING = deal delayed or urgency mismatch. CLIENT_WITHDREW = client pulled out for internal reasons. OTHER = free-text fallback (avoid if possible).';

COMMENT ON COLUMN deals.competitor_rate IS
  'Best competitor rate disclosed by client during negotiation, in pct. Optional (often unavailable). When present, feeds market-reference-rate benchmarking and elasticity model as a stronger signal than rate_spread alone.';

COMMENT ON COLUMN deals.proposed_rate IS
  'Snapshot of the initial rate proposed to the client, in pct. Distinct from final rate when deal was renegotiated. Required for elasticity model to observe offered_rate vs. outcome without being confounded by post-hoc adjustments.';

COMMENT ON COLUMN deals.decision_date IS
  'When the won_lost decision was recorded. Used for time-to-decision analytics and cohort calibration windows.';

-- Indexes for the most common elasticity calibration queries.
CREATE INDEX IF NOT EXISTS idx_deals_won_lost_segment
  ON deals (won_lost, client_type, product_type)
  WHERE won_lost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_decision_date
  ON deals (decision_date)
  WHERE decision_date IS NOT NULL;

-- Realtime: outcome fields are low-frequency writes; existing deals publication
-- already covers ALTER TABLE additions transparently. No publication change needed.
