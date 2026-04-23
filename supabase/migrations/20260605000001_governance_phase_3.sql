-- Phase 3 Sprint 1 — model inventory, signed committee dossiers,
-- approval escalation tracking.
--
-- Driving requirement: SR 11-7 / EBA model risk management — every model
-- (engine version, ruleset, elasticity model, shock pack) must be inventoried
-- with owner, status, validation evidence, and effective dates. Committee
-- dossiers must carry a tamper-evident signature.

-- ---------- 1) model_inventory ----------
CREATE TABLE IF NOT EXISTS model_inventory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        REFERENCES entities(id),     -- NULL = bandera-wide
  kind            TEXT        NOT NULL CHECK (kind IN (
    'engine','ruleset','elasticity','shock_pack','behavioural','rate_card','other'
  )),
  name            TEXT        NOT NULL,
  version         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'candidate'
                    CHECK (status IN ('candidate','active','retired','rejected')),
  owner_email     TEXT,
  validation_doc_url TEXT,
  validated_at    TIMESTAMPTZ,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (entity_id, kind, name, version)
);

CREATE INDEX IF NOT EXISTS idx_model_inventory_active
  ON model_inventory (kind, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_model_inventory_entity
  ON model_inventory (entity_id);

ALTER TABLE model_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS model_inventory_read   ON model_inventory;
DROP POLICY IF EXISTS model_inventory_insert ON model_inventory;
DROP POLICY IF EXISTS model_inventory_update ON model_inventory;

CREATE POLICY model_inventory_read ON model_inventory
  FOR SELECT TO authenticated
  USING (entity_id IS NULL OR entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY model_inventory_insert ON model_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('Admin','Risk_Manager')
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

CREATE POLICY model_inventory_update ON model_inventory
  FOR UPDATE TO authenticated
  USING (entity_id IS NULL OR entity_id = get_current_entity_id())
  WITH CHECK (
    get_current_user_role() IN ('Admin','Risk_Manager')
    AND (entity_id IS NULL OR entity_id = get_current_entity_id())
  );

COMMENT ON TABLE model_inventory IS
  'SR 11-7 / EBA model inventory. One row per (kind, name, version). Active set is searchable via the partial index.';

-- ---------- 2) signed_committee_dossiers ----------
-- A dossier is the immutable record presented to the credit committee.
-- payload_hash + signature_hex + signed_by_email give tamper-evident audit.

CREATE TABLE IF NOT EXISTS signed_committee_dossiers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  deal_id         TEXT        REFERENCES deals(id),
  pricing_snapshot_id UUID    REFERENCES pricing_snapshots(id),
  dossier_payload JSONB       NOT NULL,
  payload_hash    TEXT        NOT NULL,    -- sha256 of canonical dossier_payload
  signature_hex   TEXT        NOT NULL,    -- HMAC-SHA256(payload_hash, secret)
  signed_by_email TEXT        NOT NULL,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  CHECK (signature_hex ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_dossiers_deal     ON signed_committee_dossiers (deal_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_snapshot ON signed_committee_dossiers (pricing_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_entity   ON signed_committee_dossiers (entity_id, signed_at DESC);

ALTER TABLE signed_committee_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dossiers_read   ON signed_committee_dossiers;
DROP POLICY IF EXISTS dossiers_insert ON signed_committee_dossiers;

CREATE POLICY dossiers_read ON signed_committee_dossiers
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY dossiers_insert ON signed_committee_dossiers
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());
-- Append-only by design: no UPDATE / DELETE policies.

-- ---------- 3) approval_escalations ----------
-- Tracks deadlines on approval workflow: when a deal sits in pending state
-- past N hours, an escalation row is opened so the alert evaluator can
-- chase it.

CREATE TABLE IF NOT EXISTS approval_escalations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES entities(id),
  deal_id         TEXT        REFERENCES deals(id),
  exception_id    UUID        REFERENCES pricing_exceptions(id),
  level           TEXT        NOT NULL CHECK (level IN ('L1','L2','Committee')),
  due_at          TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved','escalated','expired')),
  notified_at     TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_open
  ON approval_escalations (entity_id, due_at)
  WHERE status = 'open';

ALTER TABLE approval_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_escalations_read   ON approval_escalations;
DROP POLICY IF EXISTS approval_escalations_insert ON approval_escalations;
DROP POLICY IF EXISTS approval_escalations_update ON approval_escalations;

CREATE POLICY approval_escalations_read ON approval_escalations
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY approval_escalations_insert ON approval_escalations
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

CREATE POLICY approval_escalations_update ON approval_escalations
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

COMMENT ON TABLE approval_escalations IS
  'Time-bound escalation rows for approvals. Opened when a deal enters L1/L2/Committee, resolved when the level approves/rejects, escalated when due_at passes.';
