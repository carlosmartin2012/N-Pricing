-- Multi-Entity Support for N-Pricing
-- Adds a two-level hierarchy: Groups → Entities, replaces tenant_id (TEXT) with
-- entity_id (UUID) on all business tables, and applies UUID-based RLS policies.
--
-- This migration builds on 20240501000002_multi_tenant.sql (which added tenant_id TEXT).
-- Existing data is backfilled to the Default Entity.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout).

-- ============================================================
-- SECTION 1: GROUPS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  short_code    TEXT        NOT NULL UNIQUE,
  country       TEXT        DEFAULT 'ES',
  base_currency TEXT        DEFAULT 'EUR',
  config        JSONB       DEFAULT '{}',
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Default group for existing data
INSERT INTO groups (id, name, short_code, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Group', 'DEF', 'ES')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 2: ENTITIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES groups(id),
  name            TEXT        NOT NULL,
  legal_name      TEXT,
  short_code      TEXT        NOT NULL UNIQUE,
  country         TEXT        NOT NULL DEFAULT 'ES',
  base_currency   TEXT        DEFAULT 'EUR',
  timezone        TEXT        DEFAULT 'Europe/Madrid',
  approval_matrix JSONB,
  sdr_config      JSONB,
  lr_config       JSONB,
  is_active       BOOLEAN     DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default entity that maps to the legacy DEFAULT tenant
INSERT INTO entities (id, group_id, name, legal_name, short_code, country)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Default Entity',
  'Default Entity',
  'DEFAULT',
  'ES'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 3: ENTITY_USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_users (
  entity_id         UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id           TEXT        NOT NULL,
  role              TEXT        NOT NULL DEFAULT 'Trader'
                                CHECK (role IN ('Admin', 'Trader', 'Risk_Manager', 'Auditor')),
  default_bu_id     TEXT,
  is_primary_entity BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_id, user_id)
);

-- ============================================================
-- SECTION 4: ADD entity_id TO ALL BUSINESS TABLES
-- ============================================================
-- Adds entity_id UUID column referencing entities(id) with a default pointing
-- at the Default Entity, then backfills any NULLs and creates indexes.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'products', 'business_units', 'deals',
      'rules', 'users', 'behavioural_models', 'yield_curves',
      'rate_cards', 'liquidity_curves', 'esg_transition_grid',
      'esg_physical_grid', 'audit_log', 'pricing_results'
    ])
  LOOP
    -- Add column only if it does not already exist
    EXECUTE format(
      $f$ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS entity_id UUID
           REFERENCES entities(id)
           DEFAULT '00000000-0000-0000-0000-000000000010'$f$,
      tbl
    );

    -- Backfill rows that still have NULL entity_id (e.g. pre-migration rows)
    EXECUTE format(
      $f$UPDATE %I
         SET entity_id = '00000000-0000-0000-0000-000000000010'
         WHERE entity_id IS NULL$f$,
      tbl
    );

    -- Index for fast entity-scoped filtering
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_entity ON %I(entity_id)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ============================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================

-- Returns the entity UUID set by the application layer in the session config.
-- Falls back to the Default Entity if no setting is present.
CREATE OR REPLACE FUNCTION get_current_entity_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  raw TEXT;
BEGIN
  raw := current_setting('app.current_entity_id', true);
  IF raw IS NULL OR raw = '' THEN
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
  END IF;
  RETURN raw::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
END;
$$;

-- Returns all entity UUIDs that the calling user has access to,
-- based on their rows in entity_users.
CREATE OR REPLACE FUNCTION get_accessible_entity_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN ARRAY(
    SELECT entity_id
    FROM entity_users
    WHERE user_id = auth.jwt()->>'email'
  );
END;
$$;

-- ============================================================
-- SECTION 6: RLS POLICIES ON BUSINESS TABLES
-- ============================================================
-- Enable RLS and create three entity-scoped policies per table:
--   {table}_entity_read    — SELECT filtered to accessible entities
--   {table}_entity_insert  — INSERT restricted to current entity
--   {table}_entity_update  — UPDATE restricted to current entity

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'products', 'business_units', 'deals',
      'rules', 'users', 'behavioural_models', 'yield_curves',
      'rate_cards', 'liquidity_curves', 'esg_transition_grid',
      'esg_physical_grid', 'audit_log', 'pricing_results'
    ])
  LOOP
    -- Enable RLS on the table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop old entity policies if they exist (idempotency)
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_read',   tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_update', tbl);

    -- SELECT: user must have access to the row's entity
    EXECUTE format(
      $f$CREATE POLICY %I ON %I
         FOR SELECT
         TO authenticated
         USING (entity_id = ANY(get_accessible_entity_ids()))$f$,
      tbl || '_entity_read', tbl
    );

    -- INSERT: row must belong to the session's current entity
    EXECUTE format(
      $f$CREATE POLICY %I ON %I
         FOR INSERT
         TO authenticated
         WITH CHECK (entity_id = get_current_entity_id())$f$,
      tbl || '_entity_insert', tbl
    );

    -- UPDATE: row must belong to the session's current entity
    EXECUTE format(
      $f$CREATE POLICY %I ON %I
         FOR UPDATE
         TO authenticated
         USING (entity_id = get_current_entity_id())$f$,
      tbl || '_entity_update', tbl
    );
  END LOOP;
END
$$;

-- ============================================================
-- SECTION 7: RLS POLICIES ON GROUPS, ENTITIES, ENTITY_USERS
-- ============================================================

-- groups: readable by any authenticated user
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_authenticated_read ON groups;
CREATE POLICY groups_authenticated_read ON groups
  FOR SELECT
  TO authenticated
  USING (true);

-- entities: readable if the user belongs to that entity
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entities_accessible_read ON entities;
CREATE POLICY entities_accessible_read ON entities
  FOR SELECT
  TO authenticated
  USING (id = ANY(get_accessible_entity_ids()));

-- entity_users: users can read their own rows; entity Admins can write
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_users_self_read ON entity_users;
CREATE POLICY entity_users_self_read ON entity_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.jwt()->>'email');

DROP POLICY IF EXISTS entity_users_admin_write ON entity_users;
CREATE POLICY entity_users_admin_write ON entity_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entity_users eu
      WHERE eu.entity_id = entity_users.entity_id
        AND eu.user_id   = auth.jwt()->>'email'
        AND eu.role      = 'Admin'
    )
  );
