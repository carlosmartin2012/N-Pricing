/**
 * API layer — Groups, Entities, and Entity-User assignments (CRUD)
 *
 * Wraps Supabase calls for `groups`, `entities`, and `entity_users` tables
 * with typed inputs/outputs and consistent error handling via `safeSupabaseCall`.
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

/** Fetch all groups ordered by name. */
export async function listGroups(): Promise<Group[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('groups').select('*').order('name'),
    [],
    'listGroups',
  );
  return (data as Record<string, unknown>[]).map(mapGroupFromDB);
}

/** Fetch a single group by id. Returns null if not found. */
export async function getGroup(id: string): Promise<Group | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('groups').select('*').eq('id', id).single(),
    null,
    'getGroup',
  );
  if (error || !data) return null;
  return mapGroupFromDB(data as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

/** Fetch all entities ordered by name. */
export async function listEntities(): Promise<Entity[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('entities').select('*').order('name'),
    [],
    'listEntities',
  );
  return (data as Record<string, unknown>[]).map(mapEntityFromDB);
}

/** Fetch a single entity by id. Returns null if not found. */
export async function getEntity(id: string): Promise<Entity | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('entities').select('*').eq('id', id).single(),
    null,
    'getEntity',
  );
  if (error || !data) return null;
  return mapEntityFromDB(data as Record<string, unknown>);
}

/** Insert or update a single entity. Returns the persisted entity or null on error. */
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

/** Fetch all user assignments for a given entity. */
export async function listEntityUsers(entityId: string): Promise<EntityUser[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('entity_users').select('*').eq('entity_id', entityId),
    [],
    'listEntityUsers',
  );
  return (data as Record<string, unknown>[]).map(mapEntityUserFromDB);
}

/** Fetch all entity assignments for a given user (by email). */
export async function getUserEntities(userEmail: string): Promise<EntityUser[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('entity_users').select('*').eq('user_id', userEmail),
    [],
    'getUserEntities',
  );
  return (data as Record<string, unknown>[]).map(mapEntityUserFromDB);
}

/** Insert or update an entity-user assignment. */
export async function upsertEntityUser(
  entityId: string,
  userId: string,
  role: EntityUser['role'],
  isPrimary: boolean,
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
