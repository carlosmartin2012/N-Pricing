import type { Group, Entity, EntityUser } from '../types/entity';
import { apiGet, apiPost } from '../utils/apiFetch';
import {
  mapGroupFromDB,
  mapGroupToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,
} from './mappers';

export async function listGroups(): Promise<Group[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/entities/groups');
    return rows.map(mapGroupFromDB);
  } catch { return []; }
}

export async function getGroup(id: string): Promise<Group | null> {
  try {
    const row = await apiGet<Record<string, unknown>>(`/entities/groups/${id}`);
    return row ? mapGroupFromDB(row) : null;
  } catch { return null; }
}

export async function upsertGroup(group: Partial<Group>): Promise<Group | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/entities/groups', mapGroupToDB(group));
    return row ? mapGroupFromDB(row) : null;
  } catch { return null; }
}

export async function listEntities(): Promise<Entity[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/entities/entities');
    return rows.map(mapEntityFromDB);
  } catch { return []; }
}

export async function getEntity(id: string): Promise<Entity | null> {
  try {
    const row = await apiGet<Record<string, unknown>>(`/entities/entities/${id}`);
    return row ? mapEntityFromDB(row) : null;
  } catch { return null; }
}

export async function upsertEntity(entity: Partial<Entity>): Promise<Entity | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/entities/entities', mapEntityToDB(entity));
    return row ? mapEntityFromDB(row) : null;
  } catch { return null; }
}

export async function listEntityUsers(entityId?: string): Promise<EntityUser[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/entities/entity-users${qs}`);
    return rows.map(mapEntityUserFromDB);
  } catch { return []; }
}

export async function upsertEntityUser(entityUser: Partial<EntityUser>): Promise<void> {
  await apiPost('/entities/entity-users', entityUser);
}
