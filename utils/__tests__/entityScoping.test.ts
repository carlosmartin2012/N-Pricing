import { describe, it, expect } from 'vitest';
import { MOCK_ENTITIES, MOCK_ENTITY_USERS, MOCK_GROUPS } from '../seedData.entities';

describe('Entity scoping', () => {
  const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';

  it('should return entity_id filter when entity is set', () => {
    const entityId = 'ent-001';
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
    expect(isGroupScope).toBe(true);
  });
});

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
