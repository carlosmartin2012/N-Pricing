-- RLS hardening follow-up after 2026-04 audit.
-- Aligns new tables with the existing role/entity scoping model.

ALTER TABLE greenium_rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "greenium_rate_cards_read" ON greenium_rate_cards;
DROP POLICY IF EXISTS "greenium_rate_cards_write" ON greenium_rate_cards;

CREATE POLICY "greenium_rate_cards_read" ON greenium_rate_cards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "greenium_rate_cards_write" ON greenium_rate_cards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE email = auth.jwt()->>'email'
        AND role IN ('Admin', 'Risk_Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE email = auth.jwt()->>'email'
        AND role IN ('Admin', 'Risk_Manager')
    )
  );

DROP POLICY IF EXISTS report_schedules_write ON report_schedules;
CREATE POLICY report_schedules_write ON report_schedules
  FOR ALL
  TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

DROP POLICY IF EXISTS alert_rules_write ON alert_rules;
CREATE POLICY alert_rules_write ON alert_rules
  FOR ALL
  TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());
