-- Move greenium_rate_cards into the entity-scoped model.
-- Pre-condition: greenium_rate_cards exists (see 20260407000001_esg_greenium_dnsh_isf.sql).

ALTER TABLE greenium_rate_cards
  ADD COLUMN IF NOT EXISTS entity_id UUID
  REFERENCES entities(id)
  DEFAULT '00000000-0000-0000-0000-000000000010';

UPDATE greenium_rate_cards
  SET entity_id = '00000000-0000-0000-0000-000000000010'
  WHERE entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_greenium_rate_cards_entity
  ON greenium_rate_cards(entity_id);

ALTER TABLE greenium_rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "greenium_rate_cards_read"  ON greenium_rate_cards;
DROP POLICY IF EXISTS "greenium_rate_cards_write" ON greenium_rate_cards;
DROP POLICY IF EXISTS greenium_rate_cards_entity_read   ON greenium_rate_cards;
DROP POLICY IF EXISTS greenium_rate_cards_entity_insert ON greenium_rate_cards;
DROP POLICY IF EXISTS greenium_rate_cards_entity_update ON greenium_rate_cards;
DROP POLICY IF EXISTS greenium_rate_cards_entity_delete ON greenium_rate_cards;

CREATE POLICY greenium_rate_cards_entity_read ON greenium_rate_cards
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY greenium_rate_cards_entity_insert ON greenium_rate_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY greenium_rate_cards_entity_update ON greenium_rate_cards
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY greenium_rate_cards_entity_delete ON greenium_rate_cards
  FOR DELETE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  );
