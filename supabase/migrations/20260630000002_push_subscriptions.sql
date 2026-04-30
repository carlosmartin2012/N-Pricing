-- Ola 10 Bloque C — Push subscriptions for mobile-first approval cockpit.
--
-- Almacena suscripciones de Web Push (W3C standard) per (user, device).
-- El sender real (que usaría la lib `web-push` con VAPID keys) queda
-- como follow-up — esta migration entrega solo la primitiva de
-- persistencia que el cliente PWA usa para registrarse.
--
-- NOTA: No es PII per se (las claves p256dh/auth son del navegador, no
-- del usuario humano), pero sí es info sensible — ver runbook.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID         NOT NULL REFERENCES entities(id),
  user_email   TEXT         NOT NULL,
  endpoint     TEXT         NOT NULL,
  keys_p256dh  TEXT         NOT NULL,
  keys_auth    TEXT         NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Una endpoint = un device. Re-suscripciones del mismo navegador
  -- updatea last_seen_at + keys (rotación periódica del navegador).
  UNIQUE (entity_id, user_email, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_entity_user
  ON push_subscriptions (entity_id, user_email);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_read   ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete ON push_subscriptions;

-- Read: cada usuario lee sus propias suscripciones; Admin lee todas
CREATE POLICY push_subscriptions_read ON push_subscriptions
  FOR SELECT TO authenticated
  USING (
    entity_id = ANY(get_accessible_entity_ids())
    AND (
      get_current_user_role() IN ('Admin','Risk_Manager')
      OR user_email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND user_email = current_setting('app.current_user_email', true)
  );

CREATE POLICY push_subscriptions_update ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND user_email = current_setting('app.current_user_email', true)
  )
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND user_email = current_setting('app.current_user_email', true)
  );

CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND (
      get_current_user_role() = 'Admin'
      OR user_email = current_setting('app.current_user_email', true)
    )
  );

COMMENT ON TABLE push_subscriptions IS
  'Web Push subscriptions per (entity, user, device). Used by mobile-first Approval Cockpit (Ola 10 Bloque C) to notify approvers about pending decisions.';
