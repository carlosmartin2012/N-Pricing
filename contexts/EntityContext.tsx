import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
      const userEntities = await entitiesApi.getUserEntities(userEmail);

      if (userEntities.length === 0) {
        const defaultEntity = await entitiesApi.getEntity(DEFAULT_ENTITY_ID);
        if (defaultEntity) {
          setAvailableEntities([defaultEntity]);
          setActiveEntity(defaultEntity);
        }
        return;
      }

      const entities = await entitiesApi.listEntities();
      const accessibleIds = new Set(userEntities.map((ue: EntityUser) => ue.entityId));
      const accessible = entities.filter((e) => accessibleIds.has(e.id));
      setAvailableEntities(accessible);

      const cachedEntityId = localCache.loadLocal<string>('n_pricing_active_entity', '');
      const primary = userEntities.find((ue: EntityUser) => ue.isPrimaryEntity);
      const targetId = cachedEntityId || primary?.entityId || accessible[0]?.id;
      const target = accessible.find((e) => e.id === targetId) ?? accessible[0];

      if (target) {
        setActiveEntity(target);
        const grp = await entitiesApi.getGroup(target.groupId);
        setGroup(grp);
      }
    } catch (err) {
      log.error('Failed to load user entities', undefined, err instanceof Error ? err : new Error(String(err)));
      setAvailableEntities([]);
      setActiveEntity(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      activeEntity,
      availableEntities,
      group,
      isGroupScope,
      isLoading,
      switchEntity,
      setGroupScope: setGroupScopeHandler,
      loadUserEntities,
    }),
    [
      activeEntity,
      availableEntities,
      group,
      isGroupScope,
      isLoading,
      switchEntity,
      setGroupScopeHandler,
      loadUserEntities,
    ]
  );

  return (
    <EntityContext.Provider value={value}>
      {children}
    </EntityContext.Provider>
  );
};

export function useEntity(): EntityContextType {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntity must be used within EntityProvider');
  return ctx;
}
