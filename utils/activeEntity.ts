/**
 * Active-entity resolver — single source of truth for which `entity_id` the
 * API client should send in the `x-entity-id` header.
 *
 * Rules (keep them stable — every consumer depends on this contract):
 *
 *   1. When the app is in "demo" mode (localStorage key `n_pricing_data_mode`),
 *      we force `DEFAULT_ENTITY_ID`. This is the entity seeded by
 *      `scripts/seed-demo-dataset.ts` and it is what the JS mock catalogue
 *      targets too — so demo-via-DB and demo-via-JS stay interchangeable.
 *
 *   2. When the app is in "live" mode, we return the user's selected entity
 *      (`n_pricing_active_entity`). If none is set yet (e.g. cold start
 *      before `EntityContext.loadUserEntities` runs), we fall back to
 *      `DEFAULT_ENTITY_ID` so the server never receives a blank
 *      `x-entity-id` — the tenancy middleware would respond 400 otherwise.
 *
 *   3. The resolver is SSR/test safe: if `localStorage` is unavailable
 *      (e.g. Vitest with jsdom and mocked storage) we silently fall back
 *      to `DEFAULT_ENTITY_ID`. No throws.
 */

import { DEFAULT_ENTITY_ID } from './seedData.entities';

export const DATA_MODE_STORAGE_KEY = 'n_pricing_data_mode';
export const ACTIVE_ENTITY_STORAGE_KEY = 'n_pricing_active_entity';

export function resolveActiveEntityId(): string {
  try {
    const mode = localStorage.getItem(DATA_MODE_STORAGE_KEY);
    if (mode === '"demo"' || mode === 'demo') {
      return DEFAULT_ENTITY_ID;
    }
    const active = localStorage.getItem(ACTIVE_ENTITY_STORAGE_KEY);
    if (!active) return DEFAULT_ENTITY_ID;
    // localCache wraps values in JSON; unwrap safely.
    try {
      const parsed = JSON.parse(active);
      return typeof parsed === 'string' && parsed.length > 0 ? parsed : DEFAULT_ENTITY_ID;
    } catch {
      return active.length > 0 ? active : DEFAULT_ENTITY_ID;
    }
  } catch {
    return DEFAULT_ENTITY_ID;
  }
}
