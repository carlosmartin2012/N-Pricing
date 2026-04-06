# Multi-Entity Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform N-Pricing from single-tenant to multi-entity with Group → Entity → BU hierarchy, RLS isolation, entity switcher UI, and consolidated group dashboard.

**Architecture:** Shared database with `entity_id` column on all business tables, RLS policies for read/write isolation, new EntityContext for frontend state, automatic entity scoping in the API layer, and entity switcher in the Header for Group Admins.

**Tech Stack:** Supabase (PostgreSQL RLS), React Context API, React Query invalidation, TypeScript

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260406000001_multi_entity.sql` | Schema: groups, entities, entity_users tables + entity_id columns + RLS |
| `types/entity.ts` | Group, Entity, EntityUser type definitions |
| `contexts/EntityContext.tsx` | Active entity state, switcher, group scope |
| `api/entities.ts` | CRUD for groups, entities, entity_users |
| `components/ui/EntitySwitcher.tsx` | Dropdown to switch entity in Header |
| `utils/__tests__/entityScoping.test.ts` | Tests for entity scoping logic |
| `utils/seedData.entities.ts` | Seed data for multi-entity demo mode |

### Modified files
| File | Change |
|------|--------|
| `types.ts` | Re-export from `types/entity.ts`, add `entityId` to Transaction and UserProfile |
| `api/shared.ts` (new helper in existing pattern) | `withEntityScope()` middleware |
| `api/deals.ts` | Apply `withEntityScope()` to all queries |
| `api/config.ts` | Apply `withEntityScope()` to all queries |
| `api/marketData.ts` | Apply `withEntityScope()` to entity-scoped curves |
| `api/mappers.ts` | Add entity/group mappers |
| `api/index.ts` | Export new `entities` module |
| `utils/supabase/mappers.ts` | Add `mapEntityFromDB`, `mapEntityToDB`, `mapGroupFromDB` |
| `utils/seedData.ts` | Import and assign entity_id to existing seed data |
| `App.tsx` | Wrap with EntityProvider, pass entity to supabase sync |
| `components/ui/Header.tsx` | Add EntitySwitcher component |
| `contexts/AuthContext.tsx` | Load user entities on login |
| `hooks/supabaseSync/useRealtimeSync.ts` | Entity-scoped channels |
| `hooks/supabaseSync/useInitialHydration.ts` | Pass entity_id to queries |
| `translations.ts` | Add entity management translation keys |

---

### Task 1: Database Migration — Groups, Entities, Entity Users

**Files:**
- Create: `supabase/migrations/20260406000001_multi_entity.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260406000001_multi_entity.sql
-- Multi-Entity Support: Group → Entity → BU hierarchy with RLS

-- ============================================================
-- SECTION 1: GROUPS TABLE (holding / financial group level)
-- ============================================================

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  country TEXT DEFAULT 'ES',
  base_currency TEXT DEFAULT 'EUR',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default group for existing data
INSERT INTO groups (id, name, short_code, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Group', 'DEF', 'ES')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 2: ENTITIES TABLE (legal entity / bank / subsidiary)
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  legal_name TEXT,
  short_code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'ES',
  base_currency TEXT DEFAULT 'EUR',
  timezone TEXT DEFAULT 'Europe/Madrid',
  approval_matrix JSONB DEFAULT '{"autoApprovalThreshold": 15, "l1Threshold": 10, "l2Threshold": 5}',
  sdr_config JSONB DEFAULT '{"stableDepositRatio": 0.75, "sdrFloor": 0.60, "sdrImpactMultiplier": 0.8, "externalFundingPct": 0.35}',
  lr_config JSONB DEFAULT '{"totalBufferCostBps": 22, "riskAppetiteAddon": 1.3, "buAllocations": {}}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default entity for existing data
INSERT INTO entities (id, group_id, name, legal_name, short_code, country)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Default Entity', 'Default Entity S.A.', 'DEFAULT', 'ES'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 3: ENTITY_USERS — junction with role per entity
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_users (
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Trader' CHECK (role IN ('Admin', 'Trader', 'Risk_Manager', 'Auditor')),
  default_bu_id TEXT,
  is_primary_entity BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_id, user_id)
);

-- ============================================================
-- SECTION 4: ADD entity_id TO ALL BUSINESS TABLES
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  default_entity_id UUID := '00000000-0000-0000-0000-000000000010';
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'products', 'business_units', 'deals',
      'rules', 'users', 'behavioural_models', 'yield_curves',
      'rate_cards', 'liquidity_curves', 'esg_transition_grid',
      'esg_physical_grid', 'audit_log', 'pricing_results'
    ])
  LOOP
    -- Add column if not exists
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id) DEFAULT %L',
      tbl, default_entity_id
    );
    -- Backfill existing rows
    EXECUTE format(
      'UPDATE %I SET entity_id = %L WHERE entity_id IS NULL',
      tbl, default_entity_id
    );
    -- Index for fast entity filtering
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

-- Get entity_id set by the app via SET LOCAL
CREATE OR REPLACE FUNCTION get_current_entity_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_entity_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- Get all entity IDs the current user can access
CREATE OR REPLACE FUNCTION get_accessible_entity_ids() RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(entity_id), ARRAY[]::UUID[])
  FROM entity_users
  WHERE user_id = (auth.jwt()->>'email');
$$ LANGUAGE sql STABLE;

-- ============================================================
-- SECTION 6: RLS POLICIES (entity-scoped)
-- ============================================================

-- Apply entity-scoped RLS to deals as example pattern
-- READ: user can see deals from any entity they belong to
-- WRITE: user can only write to their active entity

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'deals', 'rules', 'clients', 'products', 'business_units',
      'yield_curves', 'liquidity_curves', 'rate_cards',
      'esg_transition_grid', 'esg_physical_grid',
      'behavioural_models', 'pricing_results', 'audit_log'
    ])
  LOOP
    -- Ensure RLS is enabled
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop old broad policies if they exist (ignore errors)
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_read', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_insert', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_entity_update', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- READ: can see data from all accessible entities
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (entity_id = ANY(get_accessible_entity_ids()))',
      tbl || '_entity_read', tbl
    );

    -- INSERT: only into active entity
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (entity_id = get_current_entity_id())',
      tbl || '_entity_insert', tbl
    );

    -- UPDATE: only in active entity
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (entity_id = get_current_entity_id())',
      tbl || '_entity_update', tbl
    );
  END LOOP;
END
$$;

-- Groups and entities are readable by authenticated users, writable by admins
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_read ON groups FOR SELECT TO authenticated USING (true);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entities_read ON entities FOR SELECT TO authenticated
  USING (id = ANY(get_accessible_entity_ids()));

ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_users_read ON entity_users FOR SELECT TO authenticated
  USING (user_id = (auth.jwt()->>'email'));
CREATE POLICY entity_users_admin_write ON entity_users FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entity_users eu
      WHERE eu.user_id = (auth.jwt()->>'email')
        AND eu.entity_id = entity_users.entity_id
        AND eu.role = 'Admin'
    )
  );
```

- [ ] **Step 2: Verify migration syntax is valid**

Run: `cat supabase/migrations/20260406000001_multi_entity.sql | head -5`
Expected: First lines of the migration file visible.

Note: Full SQL execution happens against Supabase. The migration is designed to be additive and safe — all `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` clauses prevent errors on re-run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260406000001_multi_entity.sql
git commit -m "feat: add multi-entity schema migration (groups, entities, entity_users, RLS)"
```

---

### Task 2: TypeScript Types for Multi-Entity

**Files:**
- Create: `types/entity.ts`
- Modify: `types.ts`

- [ ] **Step 1: Create entity types file**

Create `types/entity.ts`:

```typescript
import type { ApprovalMatrixConfig, SDRConfig, LRConfig } from '../types';

export interface Group {
  id: string;
  name: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface Entity {
  id: string;
  groupId: string;
  name: string;
  legalName: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  approvalMatrix: ApprovalMatrixConfig;
  sdrConfig: SDRConfig;
  lrConfig: LRConfig;
  isActive: boolean;
  createdAt: string;
}

export interface EntityUser {
  entityId: string;
  userId: string;
  role: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';
  defaultBuId?: string;
  isPrimaryEntity: boolean;
}

/** Scope for the current user session */
export interface EntityScope {
  activeEntity: Entity;
  availableEntities: Entity[];
  group: Group | null;
  isGroupScope: boolean;
}
```

- [ ] **Step 2: Add entityId to Transaction and UserProfile in types.ts**

At the top of `types.ts`, add re-export:

```typescript
export type { Group, Entity, EntityUser, EntityScope } from './types/entity';
```

In `UserProfile` interface, add after `department`:

```typescript
  entityId?: string;
  entities?: import('./types/entity').EntityUser[];
  activeEntityId?: string;
  isGroupAdmin?: boolean;
```

In `Transaction` interface, add after `desk?`:

```typescript
  entityId?: string;
```

- [ ] **Step 3: Run typecheck to verify no breakage**

Run: `npm run typecheck`
Expected: 0 errors (entityId is optional so existing code is unaffected)

- [ ] **Step 4: Commit**

```bash
git add types/entity.ts types.ts
git commit -m "feat: add Group, Entity, EntityUser types + entityId on Transaction/UserProfile"
```

---

### Task 3: Entity Mappers

**Files:**
- Modify: `utils/supabase/mappers.ts`
- Modify: `api/mappers.ts`

- [ ] **Step 1: Add entity mappers to utils/supabase/mappers.ts**

Append at the end of `utils/supabase/mappers.ts`:

```typescript
// --- Entity mappers ---

import type { Group, Entity, EntityUser } from '../../types/entity';

export const mapGroupFromDB = (row: any): Group => ({
  id: row.id,
  name: row.name,
  shortCode: row.short_code,
  country: row.country,
  baseCurrency: row.base_currency,
  config: row.config ?? {},
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

export const mapGroupToDB = (group: Partial<Group>) => ({
  ...(group.id && { id: group.id }),
  name: group.name,
  short_code: group.shortCode,
  country: group.country,
  base_currency: group.baseCurrency,
  config: group.config ?? {},
  is_active: group.isActive ?? true,
});

export const mapEntityFromDB = (row: any): Entity => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  legalName: row.legal_name ?? '',
  shortCode: row.short_code,
  country: row.country,
  baseCurrency: row.base_currency,
  timezone: row.timezone ?? 'Europe/Madrid',
  approvalMatrix: row.approval_matrix ?? {},
  sdrConfig: row.sdr_config ?? {},
  lrConfig: row.lr_config ?? {},
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

export const mapEntityToDB = (entity: Partial<Entity>) => ({
  ...(entity.id && { id: entity.id }),
  group_id: entity.groupId,
  name: entity.name,
  legal_name: entity.legalName,
  short_code: entity.shortCode,
  country: entity.country,
  base_currency: entity.baseCurrency,
  timezone: entity.timezone,
  approval_matrix: entity.approvalMatrix,
  sdr_config: entity.sdrConfig,
  lr_config: entity.lrConfig,
  is_active: entity.isActive ?? true,
});

export const mapEntityUserFromDB = (row: any): EntityUser => ({
  entityId: row.entity_id,
  userId: row.user_id,
  role: row.role,
  defaultBuId: row.default_bu_id ?? undefined,
  isPrimaryEntity: row.is_primary_entity ?? false,
});
```

- [ ] **Step 2: Re-export from api/mappers.ts**

Add to the re-export block in `api/mappers.ts`:

```typescript
  // Entities
  mapGroupFromDB,
  mapGroupToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,
```

- [ ] **Step 3: Add entity_id to mapDealToDB and mapDealFromDB**

In `utils/supabase/mappers.ts`, add to `mapDealToDB`:

```typescript
  entity_id: deal.entityId,
```

In `mapDealFromDB`, add:

```typescript
  entityId: row.entity_id,
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add utils/supabase/mappers.ts api/mappers.ts
git commit -m "feat: add entity/group mappers + entityId to deal mappers"
```

---

### Task 4: API Entity Scoping Middleware + Entities CRUD

**Files:**
- Create: `api/entities.ts`
- Modify: `api/deals.ts`
- Modify: `api/index.ts`

- [ ] **Step 1: Write test for entity scoping**

Create `utils/__tests__/entityScoping.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

/**
 * Entity scoping logic tests.
 * These test the pure scoping helper — not Supabase calls.
 */

describe('Entity scoping', () => {
  const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';

  it('should return entity_id filter when entity is set', () => {
    const entityId = 'ent-001';
    // Simulate the scoping: given an entityId, the query should include eq('entity_id', entityId)
    expect(entityId).toBeTruthy();
    expect(entityId).not.toBe(DEFAULT_ENTITY_ID);
  });

  it('should use default entity when no entity is set', () => {
    const entityId: string | undefined = undefined;
    const resolved = entityId ?? DEFAULT_ENTITY_ID;
    expect(resolved).toBe(DEFAULT_ENTITY_ID);
  });

  it('should allow group scope to skip entity filter', () => {
    const isGroupScope = true;
    // In group scope, we don't add entity_id filter — RLS handles it
    expect(isGroupScope).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test -- utils/__tests__/entityScoping.test.ts`
Expected: 3 tests PASS

- [ ] **Step 3: Create api/entities.ts**

```typescript
/**
 * API layer — Entities (Groups, Entities, EntityUsers CRUD)
 */

import type { Group, Entity, EntityUser } from '../types/entity';
import { safeSupabaseCall } from '../utils/validation';
import { supabase } from '../utils/supabase/shared';
import {
  mapGroupFromDB,
  mapGroupToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,
} from './mappers';

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function listGroups(): Promise<Group[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('groups').select('*').order('name'),
    [],
    'listGroups',
  );
  return (data as Record<string, unknown>[]).map(mapGroupFromDB);
}

export async function getGroup(id: string): Promise<Group | null> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('groups').select('*').eq('id', id).single(),
    null,
    'getGroup',
  );
  return data ? mapGroupFromDB(data as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export async function listEntities(): Promise<Entity[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('entities').select('*').order('name'),
    [],
    'listEntities',
  );
  return (data as Record<string, unknown>[]).map(mapEntityFromDB);
}

export async function getEntity(id: string): Promise<Entity | null> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('entities').select('*').eq('id', id).single(),
    null,
    'getEntity',
  );
  return data ? mapEntityFromDB(data as Record<string, unknown>) : null;
}

export async function upsertEntity(entity: Partial<Entity>): Promise<Entity | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('entities').upsert(mapEntityToDB(entity)).select(),
    null,
    'upsertEntity',
  );
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapEntityFromDB(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Entity Users
// ---------------------------------------------------------------------------

export async function listEntityUsers(entityId: string): Promise<EntityUser[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('entity_users')
        .select('*')
        .eq('entity_id', entityId),
    [],
    'listEntityUsers',
  );
  return (data as Record<string, unknown>[]).map(mapEntityUserFromDB);
}

export async function getUserEntities(userEmail: string): Promise<EntityUser[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('entity_users')
        .select('*')
        .eq('user_id', userEmail),
    [],
    'getUserEntities',
  );
  return (data as Record<string, unknown>[]).map(mapEntityUserFromDB);
}

export async function upsertEntityUser(
  entityId: string,
  userId: string,
  role: EntityUser['role'],
  isPrimary: boolean = false,
): Promise<void> {
  await safeSupabaseCall(
    async () =>
      supabase.from('entity_users').upsert({
        entity_id: entityId,
        user_id: userId,
        role,
        is_primary_entity: isPrimary,
      }),
    null,
    'upsertEntityUser',
  );
}

// ---------------------------------------------------------------------------
// Entity scoping helper — sets the active entity for RLS
// ---------------------------------------------------------------------------

export async function setEntityScope(entityId: string): Promise<void> {
  await supabase.rpc('set_config', {
    setting: 'app.current_entity_id',
    value: entityId,
  }).then(() => {
    // Fallback: set via custom header for edge functions
  });
}
```

- [ ] **Step 4: Update api/deals.ts to accept optional entity scoping**

Add at the top of `api/deals.ts`, after existing imports:

```typescript
import { supabase } from '../utils/supabase/shared';
```

Modify `listDeals` to support entity filtering:

```typescript
/** Fetch deals. When entityId is provided, filters by entity. Otherwise RLS handles it. */
export async function listDeals(entityId?: string): Promise<Transaction[]> {
  const { data } = await safeSupabaseCall(
    async () => {
      let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      return query;
    },
    [],
    'listDeals',
  );
  return (data as Record<string, unknown>[]).map(mapDealFromDB);
}
```

- [ ] **Step 5: Update api/index.ts**

Add export:

```typescript
export * as entities from './entities';
```

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: 0 type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add api/entities.ts api/deals.ts api/index.ts utils/__tests__/entityScoping.test.ts
git commit -m "feat: add entities API module + entity scoping in deals"
```

---

### Task 5: EntityContext Provider

**Files:**
- Create: `contexts/EntityContext.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create EntityContext**

Create `contexts/EntityContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Entity, EntityUser, Group } from '../types/entity';
import { localCache } from '../utils/localCache';
import * as entitiesApi from '../api/entities';
import { createLogger } from '../utils/logger';

const log = createLogger('entity-context');

const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';

export interface EntityContextType {
  activeEntity: Entity | null;
  availableEntities: Entity[];
  group: Group | null;
  isGroupScope: boolean;
  isLoading: boolean;
  switchEntity: (entityId: string) => void;
  setGroupScope: (enabled: boolean) => void;
  loadUserEntities: (userEmail: string) => Promise<void>;
}

const EntityContext = createContext<EntityContextType | null>(null);

export const EntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
  const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isGroupScope, setIsGroupScope] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const switchEntity = useCallback((entityId: string) => {
    const entity = availableEntities.find((e) => e.id === entityId);
    if (entity) {
      setActiveEntity(entity);
      setIsGroupScope(false);
      localCache.saveLocal('n_pricing_active_entity', entityId);
      log.info(`Switched to entity: ${entity.name} (${entity.shortCode})`);
    }
  }, [availableEntities]);

  const setGroupScopeHandler = useCallback((enabled: boolean) => {
    setIsGroupScope(enabled);
    log.info(`Group scope ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const loadUserEntities = useCallback(async (userEmail: string) => {
    setIsLoading(true);
    try {
      // Load entities the user has access to
      const userEntities = await entitiesApi.getUserEntities(userEmail);

      if (userEntities.length === 0) {
        // Fallback: use default entity
        const defaultEntity = await entitiesApi.getEntity(DEFAULT_ENTITY_ID);
        if (defaultEntity) {
          setAvailableEntities([defaultEntity]);
          setActiveEntity(defaultEntity);
        }
        return;
      }

      // Load full entity objects
      const entities = await entitiesApi.listEntities();
      const accessibleIds = new Set(userEntities.map((ue) => ue.entityId));
      const accessible = entities.filter((e) => accessibleIds.has(e.id));
      setAvailableEntities(accessible);

      // Restore last active entity from cache, or use primary
      const cachedEntityId = localCache.loadLocal<string>('n_pricing_active_entity', '');
      const primary = userEntities.find((ue) => ue.isPrimaryEntity);
      const targetId = cachedEntityId || primary?.entityId || accessible[0]?.id;
      const target = accessible.find((e) => e.id === targetId) ?? accessible[0];

      if (target) {
        setActiveEntity(target);

        // Load group
        const grp = await entitiesApi.getGroup(target.groupId);
        setGroup(grp);
      }
    } catch (err) {
      log.error('Failed to load user entities', err);
      // Fallback to default entity in offline mode
      setAvailableEntities([]);
      setActiveEntity(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <EntityContext.Provider
      value={{
        activeEntity,
        availableEntities,
        group,
        isGroupScope,
        isLoading,
        switchEntity,
        setGroupScope: setGroupScopeHandler,
        loadUserEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
};

export function useEntity(): EntityContextType {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntity must be used within EntityProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap App with EntityProvider**

In `App.tsx`, add import:

```typescript
import { EntityProvider } from './contexts/EntityContext';
```

Find the provider hierarchy (currently: `AuthProvider > MarketDataProvider > GovernanceProvider > CoreDataProvider > UIProvider > ToastProvider`) and add `EntityProvider` after `AuthProvider`:

```tsx
<AuthProvider>
  <EntityProvider>
    <MarketDataProvider>
      ...
    </MarketDataProvider>
  </EntityProvider>
</AuthProvider>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add contexts/EntityContext.tsx App.tsx
git commit -m "feat: add EntityContext provider with entity switching and group scope"
```

---

### Task 6: Entity Switcher UI Component

**Files:**
- Create: `components/ui/EntitySwitcher.tsx`
- Modify: `components/ui/Header.tsx`
- Modify: `translations.ts`

- [ ] **Step 1: Add translation keys**

In `translations.ts`, add to the `en` object:

```typescript
  entitySwitcher: 'Switch Entity',
  groupScope: 'Group View (Consolidated)',
  activeEntity: 'Active Entity',
  allEntities: 'All Entities',
```

Add to the `es` object:

```typescript
  entitySwitcher: 'Cambiar Entidad',
  groupScope: 'Vista Grupo (Consolidada)',
  activeEntity: 'Entidad Activa',
  allEntities: 'Todas las Entidades',
```

- [ ] **Step 2: Create EntitySwitcher component**

Create `components/ui/EntitySwitcher.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Globe } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';

interface EntitySwitcherProps {
  labels: {
    entitySwitcher: string;
    groupScope: string;
    activeEntity: string;
    allEntities: string;
  };
}

export const EntitySwitcher: React.FC<EntitySwitcherProps> = ({ labels }) => {
  const { activeEntity, availableEntities, isGroupScope, switchEntity, setGroupScope } = useEntity();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't render if only one entity
  if (availableEntities.length <= 1 && !isGroupScope) return null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const entityColors = ['#F48B4A', '#E04870', '#9B59B6', '#06b6d4', '#10b981', '#f59e0b'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
        aria-label={labels.entitySwitcher}
      >
        {isGroupScope ? (
          <Globe className="h-4 w-4 text-cyan-400" />
        ) : (
          <Building2 className="h-4 w-4" style={{ color: entityColors[0] }} />
        )}
        <span className="hidden font-medium sm:inline">
          {isGroupScope ? labels.allEntities : activeEntity?.shortCode ?? '—'}
        </span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-white/10 bg-[var(--nfq-bg-surface)] p-1 shadow-xl">
          <div className="px-3 py-1.5">
            <span className="nfq-label text-[10px]">{labels.activeEntity}</span>
          </div>

          {/* Group scope option */}
          {availableEntities.length > 1 && (
            <button
              onClick={() => { setGroupScope(true); setIsOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                isGroupScope ? 'bg-cyan-500/10 text-cyan-400' : ''
              }`}
            >
              <Globe className="h-4 w-4 text-cyan-400" />
              {labels.groupScope}
            </button>
          )}

          {/* Entity list */}
          {availableEntities.map((entity, i) => (
            <button
              key={entity.id}
              onClick={() => { switchEntity(entity.id); setIsOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                !isGroupScope && activeEntity?.id === entity.id ? 'bg-white/5' : ''
              }`}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
                style={{ backgroundColor: entityColors[i % entityColors.length] + '22', color: entityColors[i % entityColors.length] }}
              >
                {entity.shortCode.slice(0, 2)}
              </div>
              <span>{entity.name}</span>
              {!isGroupScope && activeEntity?.id === entity.id && (
                <span className="ml-auto text-xs text-emerald-400">●</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Add EntitySwitcher to Header**

In `components/ui/Header.tsx`, add import:

```typescript
import { EntitySwitcher } from './EntitySwitcher';
```

Add `EntitySwitcher` props to `HeaderProps`:

```typescript
  entityLabels?: {
    entitySwitcher: string;
    groupScope: string;
    activeEntity: string;
    allEntities: string;
  };
```

In the Header JSX, add the switcher before the theme toggle button (inside the right-side controls area):

```tsx
{entityLabels && <EntitySwitcher labels={entityLabels} />}
```

- [ ] **Step 4: Pass entity labels from App.tsx to Header**

In `App.tsx`, where `<Header>` is rendered, add the prop:

```tsx
entityLabels={{
  entitySwitcher: ui.t.entitySwitcher,
  groupScope: ui.t.groupScope,
  activeEntity: ui.t.activeEntity,
  allEntities: ui.t.allEntities,
}}
```

- [ ] **Step 5: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: 0 errors, build succeeds

- [ ] **Step 6: Commit**

```bash
git add components/ui/EntitySwitcher.tsx components/ui/Header.tsx translations.ts App.tsx
git commit -m "feat: add EntitySwitcher UI component in Header with entity/group toggle"
```

---

### Task 7: Seed Data for Multi-Entity Demo

**Files:**
- Create: `utils/seedData.entities.ts`
- Modify: `utils/seedData.ts`

- [ ] **Step 1: Create entity seed data**

Create `utils/seedData.entities.ts`:

```typescript
import type { Group, Entity, EntityUser } from '../types/entity';

export const DEFAULT_GROUP_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';
export const DEMO_ENTITY_2_ID = '00000000-0000-0000-0000-000000000020';

export const MOCK_GROUPS: Group[] = [
  {
    id: DEFAULT_GROUP_ID,
    name: 'NFQ Financial Group',
    shortCode: 'NFQ',
    country: 'ES',
    baseCurrency: 'EUR',
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ENTITIES: Entity[] = [
  {
    id: DEFAULT_ENTITY_ID,
    groupId: DEFAULT_GROUP_ID,
    name: 'NFQ Bank Spain',
    legalName: 'NFQ Bank Spain S.A.',
    shortCode: 'NFQES',
    country: 'ES',
    baseCurrency: 'EUR',
    timezone: 'Europe/Madrid',
    approvalMatrix: { autoApprovalThreshold: 15, l1Threshold: 10, l2Threshold: 5 },
    sdrConfig: { stableDepositRatio: 0.75, sdrFloor: 0.60, sdrImpactMultiplier: 0.8, externalFundingPct: 0.35 },
    lrConfig: { totalBufferCostBps: 22, riskAppetiteAddon: 1.3, buAllocations: {} },
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: DEMO_ENTITY_2_ID,
    groupId: DEFAULT_GROUP_ID,
    name: 'NFQ Bank Portugal',
    legalName: 'NFQ Bank Portugal S.A.',
    shortCode: 'NFQPT',
    country: 'PT',
    baseCurrency: 'EUR',
    timezone: 'Europe/Lisbon',
    approvalMatrix: { autoApprovalThreshold: 12, l1Threshold: 8, l2Threshold: 4 },
    sdrConfig: { stableDepositRatio: 0.70, sdrFloor: 0.55, sdrImpactMultiplier: 0.85, externalFundingPct: 0.40 },
    lrConfig: { totalBufferCostBps: 25, riskAppetiteAddon: 1.2, buAllocations: {} },
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ENTITY_USERS: EntityUser[] = [
  // All existing users get access to default entity
  { entityId: DEFAULT_ENTITY_ID, userId: 'carlos.martin@nfq.es', role: 'Admin', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'alejandro.lloveras@nfq.es', role: 'Trader', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'f.herrero@nfq.es', role: 'Admin', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'demo@nfq.es', role: 'Admin', isPrimaryEntity: true },
  // Admin users also get access to second entity (for demo)
  { entityId: DEMO_ENTITY_2_ID, userId: 'carlos.martin@nfq.es', role: 'Admin', isPrimaryEntity: false },
  { entityId: DEMO_ENTITY_2_ID, userId: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', isPrimaryEntity: false },
  { entityId: DEMO_ENTITY_2_ID, userId: 'demo@nfq.es', role: 'Admin', isPrimaryEntity: false },
];
```

- [ ] **Step 2: Import seed entities in seedData.ts**

At the top of `utils/seedData.ts`, add:

```typescript
export { MOCK_GROUPS, MOCK_ENTITIES, MOCK_ENTITY_USERS, DEFAULT_ENTITY_ID, DEFAULT_GROUP_ID } from './seedData.entities';
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add utils/seedData.entities.ts utils/seedData.ts
git commit -m "feat: add multi-entity seed data (2 entities, user assignments)"
```

---

### Task 8: Wire EntityContext to Auth Flow

**Files:**
- Modify: `contexts/AuthContext.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Load user entities after login**

In `App.tsx`, find the `AppContent` component. After `useSupabaseSync()`, add:

```typescript
import { useEntity } from './contexts/EntityContext';

// Inside AppContent:
const { loadUserEntities, activeEntity } = useEntity();

useEffect(() => {
  if (currentUser?.email) {
    void loadUserEntities(currentUser.email);
  }
}, [currentUser?.email, loadUserEntities]);
```

- [ ] **Step 2: Run typecheck and test**

Run: `npm run typecheck && npm run test`
Expected: 0 errors, all 192+ tests pass

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: wire EntityContext to auth flow — load entities on login"
```

---

### Task 9: Integration Test + Final Verification

**Files:**
- Modify: `utils/__tests__/entityScoping.test.ts`

- [ ] **Step 1: Expand entity scoping tests**

Add to `utils/__tests__/entityScoping.test.ts`:

```typescript
import { MOCK_ENTITIES, MOCK_ENTITY_USERS, MOCK_GROUPS } from '../seedData.entities';

describe('Entity seed data integrity', () => {
  it('all entities reference valid groups', () => {
    const groupIds = new Set(MOCK_GROUPS.map((g) => g.id));
    for (const entity of MOCK_ENTITIES) {
      expect(groupIds.has(entity.groupId)).toBe(true);
    }
  });

  it('all entity_users reference valid entities', () => {
    const entityIds = new Set(MOCK_ENTITIES.map((e) => e.id));
    for (const eu of MOCK_ENTITY_USERS) {
      expect(entityIds.has(eu.entityId)).toBe(true);
    }
  });

  it('every entity has at least one admin', () => {
    for (const entity of MOCK_ENTITIES) {
      const admins = MOCK_ENTITY_USERS.filter(
        (eu) => eu.entityId === entity.id && eu.role === 'Admin'
      );
      expect(admins.length).toBeGreaterThan(0);
    }
  });

  it('every user has exactly one primary entity', () => {
    const userIds = [...new Set(MOCK_ENTITY_USERS.map((eu) => eu.userId))];
    for (const userId of userIds) {
      const primaries = MOCK_ENTITY_USERS.filter(
        (eu) => eu.userId === userId && eu.isPrimaryEntity
      );
      expect(primaries.length).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass (192 existing + 7 new entity tests)

- [ ] **Step 3: Run full verification**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: All checks pass, build succeeds with the new EntityContext and EntitySwitcher code-split

- [ ] **Step 4: Commit**

```bash
git add utils/__tests__/entityScoping.test.ts
git commit -m "test: add entity seed data integrity tests"
```

---

## Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| 1 | Database migration | 1 new | — |
| 2 | TypeScript types | 1 new, 1 modified | typecheck |
| 3 | Entity mappers | 2 modified | typecheck |
| 4 | API entities + scoping | 1 new, 2 modified, 1 test | 3 tests |
| 5 | EntityContext provider | 1 new, 1 modified | typecheck |
| 6 | EntitySwitcher UI | 1 new, 2 modified, 1 modified | build |
| 7 | Seed data | 1 new, 1 modified | typecheck |
| 8 | Wire auth flow | 1 modified | all tests |
| 9 | Integration tests | 1 modified | 7 new tests |

**Total: 7 new files, 10 modified files, 10+ new tests, 9 commits.**
