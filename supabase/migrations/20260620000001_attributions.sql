-- Ola 8 — Atribuciones jerárquicas (Bloque A).
--
-- Modela formalmente la "delegated authority by hierarchy" requerida por el
-- email de Banca March (Esteve Morey, Nov 2022) y la fase Robustez del PDF
-- Visión NFQ F&R Foco Pricing (Dic 2022). Tres tablas:
--
--   1. attribution_levels      — árbol N-ario de niveles organizativos
--                                (Oficina → Zona → Territorial → Comité)
--   2. attribution_thresholds  — umbrales por nivel × scope (jsonb)
--                                (deviation_bps, raroc_pp, volumen, producto)
--   3. attribution_decisions   — decisiones inmutables, hash chain a
--                                pricing_snapshots (reproducibilidad regulatoria)
--
-- RLS estricto: read accesible / insert current / update Admin/Risk /
-- decisions append-only (sin UPDATE/DELETE policy ⇒ Postgres bloquea).
-- Trigger valida que pricing_snapshot_hash existe antes del insert
-- (mismo patrón que pricing_snapshots hash chain).

-- ---------- 1) attribution_levels ----------
-- Árbol N-ario por entity. parent_id NULL = nivel raíz (típicamente Oficina).
-- level_order es entero ascendente (1=Oficina, 2=Zona, ..., N=Comité). El
-- orden NO se infiere de parent_id porque permitimos saltos (un Director
-- puede aprobar directamente sin pasar por Zona en ciertos productos).

CREATE TABLE IF NOT EXISTS attribution_levels (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID         NOT NULL REFERENCES entities(id),
  name         TEXT         NOT NULL,
  parent_id    UUID         REFERENCES attribution_levels(id),
  level_order  INT          NOT NULL,
  rbac_role    TEXT         NOT NULL,
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  active       BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CHECK (level_order >= 1),
  UNIQUE (entity_id, name)
);

CREATE INDEX IF NOT EXISTS idx_attribution_levels_entity
  ON attribution_levels (entity_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_levels_parent
  ON attribution_levels (parent_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_levels_order
  ON attribution_levels (entity_id, level_order) WHERE active = TRUE;

ALTER TABLE attribution_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribution_levels_read   ON attribution_levels;
DROP POLICY IF EXISTS attribution_levels_insert ON attribution_levels;
DROP POLICY IF EXISTS attribution_levels_update ON attribution_levels;
DROP POLICY IF EXISTS attribution_levels_delete ON attribution_levels;

CREATE POLICY attribution_levels_read ON attribution_levels
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY attribution_levels_insert ON attribution_levels
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY attribution_levels_update ON attribution_levels
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

-- Sin DELETE: levels se desactivan con active=false (preserva FK histórico
-- en attribution_decisions.required_level_id / decided_by_level_id).

COMMENT ON TABLE attribution_levels IS
  'Árbol N-ario de niveles organizativos por entity (Oficina/Zona/Territorial/Comité). Soft-delete via active=false para preservar FK histórico en decisiones.';

-- ---------- 2) attribution_thresholds ----------
-- Umbrales por nivel y scope (jsonb GIN). El scope describe a qué tipo de
-- operación aplica el threshold: producto, segmento, currency, plazo máximo.
-- Al menos un criterio de threshold debe estar definido (deviation_bps_max,
-- raroc_pp_min, o volume_eur_max).

CREATE TABLE IF NOT EXISTS attribution_thresholds (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID         NOT NULL REFERENCES entities(id),
  level_id            UUID         NOT NULL REFERENCES attribution_levels(id),
  scope               JSONB        NOT NULL,
  deviation_bps_max   NUMERIC(10,4),
  raroc_pp_min        NUMERIC(10,4),
  volume_eur_max      NUMERIC(20,2),

  active_from         DATE         NOT NULL DEFAULT CURRENT_DATE,
  active_to           DATE,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CHECK (
    deviation_bps_max IS NOT NULL
    OR raroc_pp_min    IS NOT NULL
    OR volume_eur_max  IS NOT NULL
  ),
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_level
  ON attribution_thresholds (level_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_entity
  ON attribution_thresholds (entity_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attribution_thresholds_scope
  ON attribution_thresholds USING GIN (scope) WHERE is_active = TRUE;

ALTER TABLE attribution_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribution_thresholds_read   ON attribution_thresholds;
DROP POLICY IF EXISTS attribution_thresholds_insert ON attribution_thresholds;
DROP POLICY IF EXISTS attribution_thresholds_update ON attribution_thresholds;
DROP POLICY IF EXISTS attribution_thresholds_delete ON attribution_thresholds;

CREATE POLICY attribution_thresholds_read ON attribution_thresholds
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY attribution_thresholds_insert ON attribution_thresholds
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

CREATE POLICY attribution_thresholds_update ON attribution_thresholds
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin', 'Risk_Manager')
  );

-- Sin DELETE: thresholds se desactivan con is_active=false (preserva
-- versioning para dry-run del editor).

COMMENT ON TABLE attribution_thresholds IS
  'Umbrales por (nivel × scope) con jsonb GIN para matching flexible. Al menos uno de deviation_bps_max/raroc_pp_min/volume_eur_max debe estar definido.';

-- ---------- 3) attribution_decisions ----------
-- Decisiones append-only. pricing_snapshot_hash es FK lógica a
-- pricing_snapshots.hash (sin FK física porque pricing_snapshots es
-- entity-scoped por RLS y la FK física complica la transacción tenancy).
-- El trigger valida la existencia antes del insert.

CREATE TABLE IF NOT EXISTS attribution_decisions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id                UUID        NOT NULL REFERENCES entities(id),
  deal_id                  TEXT        NOT NULL REFERENCES deals(id),
  required_level_id        UUID        NOT NULL REFERENCES attribution_levels(id),
  decided_by_level_id      UUID        REFERENCES attribution_levels(id),
  decided_by_user          TEXT        REFERENCES users(id),
  decision                 TEXT        NOT NULL
                            CHECK (decision IN ('approved','rejected','escalated','expired','reverted')),
  reason                   TEXT,
  pricing_snapshot_hash    TEXT        NOT NULL,
  routing_metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,

  decided_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attribution_decisions_deal
  ON attribution_decisions (deal_id);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_user
  ON attribution_decisions (decided_by_user);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_snapshot
  ON attribution_decisions (pricing_snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_attribution_decisions_entity_decided
  ON attribution_decisions (entity_id, decided_at DESC);

ALTER TABLE attribution_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attribution_decisions_read   ON attribution_decisions;
DROP POLICY IF EXISTS attribution_decisions_insert ON attribution_decisions;

CREATE POLICY attribution_decisions_read ON attribution_decisions
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY attribution_decisions_insert ON attribution_decisions
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- Append-only: no UPDATE/DELETE policy ⇒ Postgres bloquea por defecto.
-- Para anular una decisión se inserta una nueva con decision='reverted'.

COMMENT ON TABLE attribution_decisions IS
  'Decisiones inmutables con hash chain a pricing_snapshots. Append-only por RLS. Para anular se inserta decision=reverted (nunca UPDATE/DELETE).';

-- ---------- 4) Trigger de validación de hash chain ----------
-- Antes de insert, valida que el pricing_snapshot_hash existe en
-- pricing_snapshots para el mismo entity_id. Garantiza trazabilidad
-- end-to-end pricing → decisión.

CREATE OR REPLACE FUNCTION validate_attribution_decision_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- pricing_snapshots stores the engine output SHA-256 as `output_hash`
  -- (see migration 20260602000004_pricing_snapshots.sql columns
  -- input_hash / output_hash). Earlier revisions of this trigger
  -- referenced a non-existent column `hash` — every INSERT to
  -- attribution_decisions would have raised
  -- `column "hash" does not exist`, breaking the entire append flow.
  IF NOT EXISTS (
    SELECT 1
    FROM pricing_snapshots
    WHERE output_hash = NEW.pricing_snapshot_hash
      AND entity_id   = NEW.entity_id
  ) THEN
    RAISE EXCEPTION
      'attribution_decision rejects unknown pricing_snapshot_hash % for entity %',
      NEW.pricing_snapshot_hash, NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_attribution_decision ON attribution_decisions;

CREATE TRIGGER trg_validate_attribution_decision
  BEFORE INSERT ON attribution_decisions
  FOR EACH ROW
  EXECUTE FUNCTION validate_attribution_decision_hash();

COMMENT ON FUNCTION validate_attribution_decision_hash IS
  'Garantiza hash chain entre attribution_decisions y pricing_snapshots. Sin esto, una decisión podría apuntar a un hash que no existe.';
