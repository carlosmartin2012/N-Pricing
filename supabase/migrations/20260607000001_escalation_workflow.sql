-- Phase 3 continuation — approval escalation workflow.
--
-- Adds:
--   1) approval_escalation_configs — per-entity timeout + notify settings
--      for each level (L1, L2, Committee).
--   2) Columns on approval_escalations:
--        - opened_by            : who initiated L1
--        - current_notes        : optional free-text trail
--        - escalated_from_id    : link to the escalation we replaced
--   3) Seed default configs for the Default Entity so that the evaluator
--      has sensible thresholds out of the box.
--
-- SLAs chosen deliberately:
--   L1        =  24 hours  (retail desk / local approver)
--   L2        =  48 hours  (regional / head of desk)
--   Committee = 120 hours  (five business days, matches typical ALCO)
-- Each entity can override without touching the engine.

-- ---------- 1) approval_escalation_configs ----------

CREATE TABLE IF NOT EXISTS approval_escalation_configs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL REFERENCES entities(id),
  level             TEXT        NOT NULL CHECK (level IN ('L1','L2','Committee')),
  timeout_hours     NUMERIC     NOT NULL CHECK (timeout_hours > 0),
  notify_before_hours NUMERIC   NOT NULL DEFAULT 0
                    CHECK (notify_before_hours >= 0),
  channel_type      TEXT        NOT NULL DEFAULT 'email'
                    CHECK (channel_type IN ('email','slack','pagerduty','webhook','opsgenie')),
  channel_config    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, level)
);

CREATE INDEX IF NOT EXISTS idx_escalation_configs_entity
  ON approval_escalation_configs (entity_id, level)
  WHERE is_active;

ALTER TABLE approval_escalation_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escalation_configs_read   ON approval_escalation_configs;
DROP POLICY IF EXISTS escalation_configs_insert ON approval_escalation_configs;
DROP POLICY IF EXISTS escalation_configs_update ON approval_escalation_configs;
DROP POLICY IF EXISTS escalation_configs_delete ON approval_escalation_configs;

CREATE POLICY escalation_configs_read ON approval_escalation_configs
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

-- Writes gated to Admin — timeout changes affect compliance posture.
CREATE POLICY escalation_configs_insert ON approval_escalation_configs
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id()
              AND get_current_user_role() = 'Admin');

CREATE POLICY escalation_configs_update ON approval_escalation_configs
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id()
         AND get_current_user_role() = 'Admin')
  WITH CHECK (entity_id = get_current_entity_id());

CREATE POLICY escalation_configs_delete ON approval_escalation_configs
  FOR DELETE TO authenticated
  USING (entity_id = get_current_entity_id()
         AND get_current_user_role() = 'Admin');

COMMENT ON TABLE approval_escalation_configs IS
  'Per-entity timeout + notify settings for the approval escalation workflow. Admin-only writes. One row per (entity_id, level).';

-- ---------- 2) approval_escalations — extra columns ----------

ALTER TABLE approval_escalations
  ADD COLUMN IF NOT EXISTS opened_by         TEXT,
  ADD COLUMN IF NOT EXISTS current_notes     TEXT,
  ADD COLUMN IF NOT EXISTS escalated_from_id UUID
      REFERENCES approval_escalations(id);

CREATE INDEX IF NOT EXISTS idx_escalations_chain
  ON approval_escalations (escalated_from_id)
  WHERE escalated_from_id IS NOT NULL;

-- ---------- 3) Seed defaults for Default Entity ----------
-- Use ON CONFLICT DO NOTHING so re-running the migration is idempotent.

INSERT INTO approval_escalation_configs (entity_id, level, timeout_hours, notify_before_hours, channel_type)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'L1',         24,  4, 'email'),
  ('00000000-0000-0000-0000-000000000010', 'L2',         48,  8, 'email'),
  ('00000000-0000-0000-0000-000000000010', 'Committee', 120, 24, 'email')
ON CONFLICT (entity_id, level) DO NOTHING;
