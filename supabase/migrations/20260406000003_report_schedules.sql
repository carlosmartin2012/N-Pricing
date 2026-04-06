-- Report scheduling for automated report generation and delivery
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'portfolio_summary', 'lcr_nsfr', 'raroc_breakdown',
    'maturity_ladder', 'nii_sensitivity', 'pricing_analytics',
    'executive_summary'
  )),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'xlsx', 'csv')),
  recipients JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: entity-scoped
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_schedules_read ON report_schedules
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY report_schedules_write ON report_schedules
  FOR ALL TO authenticated
  USING (entity_id = get_current_entity_id());

CREATE INDEX idx_report_schedules_entity ON report_schedules(entity_id);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = TRUE;

-- Report execution log
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  output_url TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_runs_read ON report_runs
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
