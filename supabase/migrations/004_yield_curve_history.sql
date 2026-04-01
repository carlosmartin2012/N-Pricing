-- Yield Curve History for Moving Average FTP calculation
-- Stores daily snapshots of yield curves for historical lookback.

CREATE TABLE IF NOT EXISTS yield_curve_history (
  id SERIAL PRIMARY KEY,
  curve_id TEXT NOT NULL,        -- e.g. 'USD_SWAP', 'EUR_SWAP'
  snapshot_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  points JSONB NOT NULL,          -- array of { tenor, rate }
  source TEXT DEFAULT 'system',   -- 'system', 'manual', 'import'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(curve_id, snapshot_date)
);

ALTER TABLE yield_curve_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ych_read" ON yield_curve_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "ych_insert" ON yield_curve_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE email = auth.jwt()->>'email' AND role IN ('Admin', 'Risk_Manager')));

CREATE INDEX idx_ych_curve_date ON yield_curve_history(curve_id, snapshot_date DESC);
CREATE INDEX idx_ych_currency ON yield_curve_history(currency);

ALTER PUBLICATION supabase_realtime ADD TABLE yield_curve_history;
