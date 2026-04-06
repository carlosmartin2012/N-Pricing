-- Add version counter for optimistic locking on deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- Trigger to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_deal_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_version ON deals;
CREATE TRIGGER trg_deal_version
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION increment_deal_version();
