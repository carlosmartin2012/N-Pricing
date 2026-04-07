-- Migration: Add ESG Greenium, DNSH, and ISF columns to deals table
-- Gaps 17-19: Greenium/Movilización, DNSH Capital Discount, ISF Pillar I Overlay

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS green_format TEXT DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS dnsh_compliant BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS isf_eligible BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN deals.green_format IS 'Green instrument format: Green_Bond, Green_Loan, Sustainability_Linked, Social_Bond, None';
COMMENT ON COLUMN deals.dnsh_compliant IS 'DNSH (Do No Significant Harm) compliance — enables capital charge discount';
COMMENT ON COLUMN deals.isf_eligible IS 'Infrastructure Supporting Factor eligibility (CRR2 Art. 501a) — reduces RW by 25%';

-- Greenium rate cards table for configurable green format discounts
CREATE TABLE IF NOT EXISTS greenium_rate_cards (
  id SERIAL PRIMARY KEY,
  green_format TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'All',
  adjustment_bps NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default greenium grid
INSERT INTO greenium_rate_cards (green_format, sector, adjustment_bps, description) VALUES
  ('Green_Bond', 'All', -20, 'EU Green Bond Standard — full taxonomy alignment discount'),
  ('Green_Loan', 'All', -15, 'Green Loan Principles (LMA) — verified use of proceeds'),
  ('Sustainability_Linked', 'All', -10, 'Sustainability-Linked Loan — KPI-based margin ratchet'),
  ('Social_Bond', 'All', -8, 'Social Bond Principles — affordable housing/healthcare')
ON CONFLICT DO NOTHING;

-- RLS for greenium_rate_cards (same pattern as existing rate card tables)
ALTER TABLE greenium_rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "greenium_rate_cards_read" ON greenium_rate_cards
  FOR SELECT USING (true);

CREATE POLICY "greenium_rate_cards_write" ON greenium_rate_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
    )
  );
