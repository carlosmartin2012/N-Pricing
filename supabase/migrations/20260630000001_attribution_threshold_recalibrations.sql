-- Ola 10 Bloque B — Attribution threshold recalibrations.
--
-- Tabla append-style con UPDATE permitido sólo para transiciones de
-- status. El worker `attributionThresholdRecalibrator` agrupa drift
-- signals históricos y propone ajustes a thresholds existentes; las
-- propuestas quedan en `pending` esperando review humana.
--
-- Cuando Admin/Risk_Manager aprueba:
--   1. Se crea un threshold nuevo con los proposed_* (mismo level_id,
--      scope idéntico, isActive=true). Esto vive en
--      attribution_thresholds vía endpoint normal — la migración no lo
--      hace automático.
--   2. Se marca el threshold viejo como is_active=false (soft delete
--      preserva FK histórico en attribution_decisions).
--   3. Se actualiza esta row a status='approved' + decided_*.
-- Cuando rechaza: status='rejected' + decided_* con reason.
--
-- Trigger valida que threshold_id existe + es del mismo entity_id (no
-- cross-tenant recalibrations).

CREATE TABLE IF NOT EXISTS attribution_threshold_recalibrations (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                   UUID         NOT NULL REFERENCES entities(id),
  threshold_id                UUID         NOT NULL REFERENCES attribution_thresholds(id),
  proposed_deviation_bps_max  NUMERIC(10,4),
  proposed_raroc_pp_min       NUMERIC(10,4),
  proposed_volume_eur_max     NUMERIC(20,2),
  rationale                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status                      TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected','superseded')),
  proposed_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  decided_at                  TIMESTAMPTZ,
  decided_by_user             TEXT,
  reason                      TEXT,

  CHECK (
    proposed_deviation_bps_max IS NOT NULL
    OR proposed_raroc_pp_min    IS NOT NULL
    OR proposed_volume_eur_max  IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_attr_recal_entity_status
  ON attribution_threshold_recalibrations (entity_id, status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_recal_threshold
  ON attribution_threshold_recalibrations (threshold_id, status);
-- Una sola pending por threshold a la vez (re-runs del worker la actualizan
-- vía UPDATE en lugar de duplicar)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attr_recal_pending
  ON attribution_threshold_recalibrations (threshold_id)
  WHERE status = 'pending';

ALTER TABLE attribution_threshold_recalibrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attr_recal_read   ON attribution_threshold_recalibrations;
DROP POLICY IF EXISTS attr_recal_insert ON attribution_threshold_recalibrations;
DROP POLICY IF EXISTS attr_recal_update ON attribution_threshold_recalibrations;

CREATE POLICY attr_recal_read ON attribution_threshold_recalibrations
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY attr_recal_insert ON attribution_threshold_recalibrations
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Sólo Admin/Risk_Manager puede aprobar/rechazar
CREATE POLICY attr_recal_update ON attribution_threshold_recalibrations
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin','Risk_Manager')
  );

-- Sin DELETE: una propuesta rechazada queda como audit trail.

CREATE OR REPLACE FUNCTION validate_attr_recal_threshold_entity()
RETURNS TRIGGER AS $$
DECLARE
  threshold_entity UUID;
BEGIN
  SELECT entity_id INTO threshold_entity
  FROM attribution_thresholds
  WHERE id = NEW.threshold_id;

  IF threshold_entity IS NULL THEN
    RAISE EXCEPTION
      'attribution_threshold_recalibration rejects unknown threshold_id %',
      NEW.threshold_id;
  END IF;
  IF threshold_entity <> NEW.entity_id THEN
    RAISE EXCEPTION
      'cross-tenant recalibration rejected: threshold % belongs to entity %, recalibration claims %',
      NEW.threshold_id, threshold_entity, NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_attr_recal_entity ON attribution_threshold_recalibrations;

CREATE TRIGGER trg_validate_attr_recal_entity
  BEFORE INSERT OR UPDATE OF threshold_id ON attribution_threshold_recalibrations
  FOR EACH ROW
  EXECUTE FUNCTION validate_attr_recal_threshold_entity();

COMMENT ON TABLE attribution_threshold_recalibrations IS
  'Propuestas de ajuste de thresholds emitidas por el drift recalibrator. Pending → approved/rejected con governance flow Admin/Risk_Manager.';
