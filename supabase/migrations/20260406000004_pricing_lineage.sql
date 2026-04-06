-- Data lineage tracking: source references for pricing results
ALTER TABLE pricing_results ADD COLUMN IF NOT EXISTS source_ref JSONB DEFAULT '{}';
-- source_ref stores: { curveId, curveDate, ruleId, ruleVersion, modelId, entityId, calculatedAt }

COMMENT ON COLUMN pricing_results.source_ref IS 'Pricing lineage: references to curves, rules, and models used in this calculation';
