-- Migration: Deal realizations — ex-post RAROC persistence
--
-- Context: pivot §Bloque F. ExPostRAROCDashboard today uses Math.random()
-- to fabricate realized figures. This schema lets us persist real
-- recomputations (SPOT_CURVE method) or ingested core-banking P&L
-- (CORE_FEED method, post-MVP).
--
-- Primary use case: monthly snapshot of each booked deal, recomputed with
-- current curves + any ECL updates vs. origination assumptions.

CREATE TABLE IF NOT EXISTS deal_realizations (
  deal_id TEXT NOT NULL,  -- matches deals.id TEXT
  snapshot_date DATE NOT NULL,
  realized_ftp_rate NUMERIC,
  realized_margin NUMERIC,
  realized_ecl NUMERIC,
  realized_raroc NUMERIC,
  recompute_method TEXT NOT NULL,
  PRIMARY KEY (deal_id, snapshot_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deal_realizations' AND constraint_name = 'deal_realizations_method_check'
  ) THEN
    ALTER TABLE deal_realizations
      ADD CONSTRAINT deal_realizations_method_check
      CHECK (recompute_method IN ('SPOT_CURVE', 'CORE_FEED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_realizations_deal_fk'
  ) THEN
    ALTER TABLE deal_realizations
      ADD CONSTRAINT deal_realizations_deal_fk
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deal_realizations_date
  ON deal_realizations (snapshot_date DESC);

COMMENT ON TABLE deal_realizations IS
  'Ex-post RAROC snapshots. Populated monthly by realize-raroc Edge Function. Consumed by ExPostRAROCDashboard and Backtesting. See utils/pricing/rarocRealization.ts.';
COMMENT ON COLUMN deal_realizations.recompute_method IS
  'SPOT_CURVE = recomputed with current yield curves vs. origination curves (MVP). CORE_FEED = ingested from bank core P&L ledger (post-MVP).';
