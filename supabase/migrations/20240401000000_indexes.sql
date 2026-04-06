-- N PRICING SYSTEM: PERFORMANCE INDEXES
-- Migration: 20240401000000_indexes
-- Description: All CREATE INDEX statements, separated for performance tuning.
-- Depends on: 20240201000000_v2_extensions (for deal_versions, etc.)

-- ============================================================
-- PRICING RESULTS INDEXES (from schema.sql)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pricing_results_deal_id ON pricing_results(deal_id);
CREATE INDEX IF NOT EXISTS idx_pricing_results_calculated_at ON pricing_results(calculated_at DESC);

-- ============================================================
-- DEALS INDEXES (from schema_v2.sql)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_business_unit ON deals(business_unit);
CREATE INDEX IF NOT EXISTS idx_deals_product_type ON deals(product_type);

-- ============================================================
-- AUDIT LOG INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);

-- ============================================================
-- YIELD CURVES INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_yield_curves_currency_date ON yield_curves(currency, as_of_date DESC);

-- ============================================================
-- RULES INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rules_bu_product ON rules(business_unit, product);

-- ============================================================
-- DEAL VERSIONS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_deal_versions_deal ON deal_versions(deal_id, version DESC);

-- ============================================================
-- CLIENTS INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clients_rating ON clients(rating);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
