import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveActiveEntityId, DATA_MODE_STORAGE_KEY, ACTIVE_ENTITY_STORAGE_KEY } from '../activeEntity';
import { DEFAULT_ENTITY_ID } from '../seedData.entities';

// The default test environment is 'node' (no localStorage). We install a
// minimal Map-backed shim so these tests are self-contained and don't rely
// on jsdom being configured per-file.
function installLocalStorageShim(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  });
  return store;
}

describe('resolveActiveEntityId', () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it('returns DEFAULT_ENTITY_ID when dataMode is demo (quoted form)', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"demo"');
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('returns DEFAULT_ENTITY_ID when dataMode is demo (unquoted form)', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, 'demo');
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('ignores demo override when user picked a live entity', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"demo"');
    localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, '"00000000-0000-0000-0000-000000000099"');
    // Demo always wins — regardless of active entity.
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('returns live active entity when mode is live', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"live"');
    localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, '"00000000-0000-0000-0000-000000000099"');
    expect(resolveActiveEntityId()).toBe('00000000-0000-0000-0000-000000000099');
  });

  it('falls back to DEFAULT_ENTITY_ID when no active entity set in live mode', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"live"');
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('falls back to DEFAULT_ENTITY_ID when storage is empty', () => {
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('falls back to DEFAULT_ENTITY_ID when active entity is an empty string', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"live"');
    localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, '""');
    expect(resolveActiveEntityId()).toBe(DEFAULT_ENTITY_ID);
  });

  it('handles non-JSON active entity value gracefully', () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, '"live"');
    localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, 'raw-uuid-without-quotes');
    expect(resolveActiveEntityId()).toBe('raw-uuid-without-quotes');
  });
});
