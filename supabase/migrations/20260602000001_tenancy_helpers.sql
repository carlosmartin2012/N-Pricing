-- Tenancy strict mode + user-role helper + violation log.
-- Ties Postgres session to the authenticated user/entity set by the Node
-- middleware (SET LOCAL app.current_entity_id / app.current_user_email /
-- app.current_user_role). Supabase clients keep going through auth.jwt().
--
-- Breaking change: get_current_entity_id() will raise when app.tenancy_strict
-- is 'on'. During rollout the flag stays 'off' (legacy fallback to Default
-- Entity). See docs/phase-0-design.md §A and §5 for the rollout plan.

-- ---------- 1) Strict current entity resolver ----------
-- Supersedes the version in 20260406000001_multi_entity.sql.
CREATE OR REPLACE FUNCTION get_current_entity_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  raw       TEXT;
  is_strict TEXT;
BEGIN
  raw       := current_setting('app.current_entity_id', true);
  is_strict := coalesce(current_setting('app.tenancy_strict', true), 'off');

  IF raw IS NULL OR raw = '' THEN
    IF is_strict = 'on' THEN
      RAISE EXCEPTION 'tenancy_not_set'
        USING ERRCODE = '42501',
              HINT = 'Server must set app.current_entity_id before running queries.';
    END IF;
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
  END IF;

  RETURN raw::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    IF is_strict = 'on' THEN
      RAISE EXCEPTION 'tenancy_invalid_uuid' USING ERRCODE = '42501';
    END IF;
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
END;
$$;

-- ---------- 2) Current user role helper ----------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN coalesce(current_setting('app.current_user_role', true), '');
END;
$$;

-- ---------- 3) Current user email helper ----------
-- Coalesces Supabase auth.jwt() (browser / edge functions) with the Node
-- middleware's app.current_user_email setting (server path). Lets future
-- policies be authored once and work on both runtimes.
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  jwt_email TEXT;
  setting_email TEXT;
BEGIN
  BEGIN
    jwt_email := auth.jwt() ->> 'email';
  EXCEPTION WHEN undefined_function THEN
    jwt_email := NULL;
  END;
  IF jwt_email IS NOT NULL AND jwt_email <> '' THEN
    RETURN jwt_email;
  END IF;
  setting_email := current_setting('app.current_user_email', true);
  RETURN coalesce(setting_email, '');
END;
$$;

-- ---------- 4) Tenancy violation counter ----------
CREATE TABLE IF NOT EXISTS tenancy_violations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id      TEXT,
  user_email      TEXT,
  endpoint        TEXT,
  claimed_entity  UUID,
  actual_entities UUID[],
  error_code      TEXT        NOT NULL,
  detail          JSONB       DEFAULT '{}'::jsonb
);

ALTER TABLE tenancy_violations ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only service role / server pool can INSERT.
-- No authenticated read path; we surface counts through /observability.

CREATE INDEX IF NOT EXISTS idx_tenancy_violations_recent
  ON tenancy_violations (occurred_at DESC);

COMMENT ON TABLE tenancy_violations IS
  'Append-only log of tenancy check failures. SLO target = 0 events / minute.';
