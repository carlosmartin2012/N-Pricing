-- Metrics table for observability
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metrics_entity_name ON metrics(entity_id, metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_recent ON metrics(recorded_at DESC);

ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_read ON metrics FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY metrics_insert ON metrics FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('gt', 'lt', 'gte', 'lte', 'eq')),
  threshold NUMERIC NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_rules_read ON alert_rules FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY alert_rules_write ON alert_rules FOR ALL TO authenticated
  USING (entity_id = get_current_entity_id());

CREATE INDEX idx_alert_rules_entity ON alert_rules(entity_id);
