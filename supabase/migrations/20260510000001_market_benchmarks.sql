-- Migration: Market reference benchmarks
--
-- Context: pivot §Bloque H. Holds external benchmark rates (BBG / Refinitiv /
-- published EBA / BdE surveys) so the Calculator can display
-- "your rate vs. market" at the time of proposal.
--
-- Schema supports both point-in-time lookup (latest rate per
-- product × tenor × segment) and historical backtesting.

CREATE TABLE IF NOT EXISTS market_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  tenor_bucket TEXT NOT NULL,
  client_type TEXT NOT NULL,
  currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT NOT NULL,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'market_benchmarks' AND constraint_name = 'market_benchmarks_tenor_check'
  ) THEN
    ALTER TABLE market_benchmarks
      ADD CONSTRAINT market_benchmarks_tenor_check
      CHECK (tenor_bucket IN ('ST', 'MT', 'LT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'market_benchmarks' AND constraint_name = 'market_benchmarks_rate_check'
  ) THEN
    ALTER TABLE market_benchmarks
      ADD CONSTRAINT market_benchmarks_rate_check
      CHECK (rate >= 0 AND rate <= 50);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_benchmarks_latest
  ON market_benchmarks (product_type, tenor_bucket, client_type, currency, as_of_date);

CREATE INDEX IF NOT EXISTS idx_market_benchmarks_lookup
  ON market_benchmarks (product_type, client_type, currency, as_of_date DESC);

COMMENT ON TABLE market_benchmarks IS
  'External market reference rates. Fed manually (CSV import) in MVP; future Edge Function can scrape or API-fetch sources. Consumed by Calculator "market context" chip and negotiation cockpit.';
COMMENT ON COLUMN market_benchmarks.source IS
  'Free text — e.g., BBG, Refinitiv, EBA publication, internal survey. Audit trail.';
