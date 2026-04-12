import type { Group, Entity, EntityUser } from '../types/entity';
import { apiGet, apiPost } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import {
  mapGroupFromDB,
  mapGroupToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,
} from './mappers';

const log = createLogger('api/entities');

export async function listGroups(): Promise<Group[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/entities/groups');
    if (!Array.isArray(rows)) return [];
    return rows.map(mapGroupFromDB);
  } catch (err) {
    log.warn('listGroups failed — returning empty list', { error: String(err) });
    return [];
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  try {
    const row = await apiGet<Record<string, unknown>>(`/entities/groups/${id}`);
    return row ? mapGroupFromDB(row) : null;
  } catch (err) {
    log.warn('getGroup failed', { id, error: String(err) });
    return null;
  }
}

export async function upsertGroup(group: Partial<Group>): Promise<Group | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/entities/groups', mapGroupToDB(group));
    return row ? mapGroupFromDB(row) : null;
  } catch (err) {
    log.error('upsertGroup failed', { groupId: group.id }, err as Error);
    return null;
  }
}

export async function listEntities(): Promise<Entity[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/entities/entities');
    if (!Array.isArray(rows)) return [];
    return rows.map(mapEntityFromDB);
  } catch (err) {
    log.warn('listEntities failed — returning empty list', { error: String(err) });
    return [];
  }
}

export async function getEntity(id: string): Promise<Entity | null> {
  try {
    const row = await apiGet<Record<string, unknown>>(`/entities/entities/${id}`);
    return row ? mapEntityFromDB(row) : null;
  } catch (err) {
    log.warn('getEntity failed', { id, error: String(err) });
    return null;
  }
}

export async function upsertEntity(entity: Partial<Entity>): Promise<Entity | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/entities/entities', mapEntityToDB(entity));
    return row ? mapEntityFromDB(row) : null;
  } catch (err) {
    log.error('upsertEntity failed', { entityId: entity.id }, err as Error);
    return null;
  }
}

export async function listEntityUsers(entityId?: string): Promise<EntityUser[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/entities/entity-users${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapEntityUserFromDB);
  } catch (err) {
    log.warn('listEntityUsers failed — returning empty list', { entityId, error: String(err) });
    return [];
  }
}

export async function getUserEntities(email: string): Promise<EntityUser[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(`/entities/entity-users?email=${encodeURIComponent(email)}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapEntityUserFromDB);
  } catch (err) {
    log.warn('getUserEntities failed — returning empty list', { email, error: String(err) });
    return [];
  }
}

export async function upsertEntityUser(entityUser: Partial<EntityUser>): Promise<void> {
  await apiPost('/entities/entity-users', entityUser);
}
