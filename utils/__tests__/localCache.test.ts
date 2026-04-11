import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * localCache must fail soft when the backing localStorage throws. These tests
 * cover the three degraded modes we actually hit in production: quota
 * exceeded on write, SecurityError in Safari private mode, and corrupt
 * serialized state from a previous version of the app.
 *
 * We stub `window` + `window.localStorage` at module level because vitest is
 * configured with `environment: 'node'` and Node 22 ships a partial WebStorage
 * that doesn't implement the full API the cache relies on.
 */

interface MockStorage {
  store: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function createMockStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

let mockStorage: MockStorage;

describe('localCache — resilience', () => {
  beforeEach(async () => {
    mockStorage = createMockStorage();
    vi.stubGlobal('window', { localStorage: mockStorage });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loadCache() {
    return (await import('../localCache')).localCache;
  }

  it('round-trips simple values', async () => {
    const cache = await loadCache();
    expect(cache.saveLocal('nfq_test_key', { a: 1 })).toBe(true);
    expect(cache.loadLocal<{ a: number }>('nfq_test_key', { a: 0 })).toEqual({ a: 1 });
  });

  it('returns the default value when the key is missing', async () => {
    const cache = await loadCache();
    expect(cache.loadLocal('nfq_missing_key', 'fallback')).toBe('fallback');
  });

  it('returns the default and drops corrupt entries rather than throwing', async () => {
    mockStorage.setItem('nfq_corrupt_key', 'not-json-{');
    const cache = await loadCache();
    const result = cache.loadLocal('nfq_corrupt_key', []);
    expect(result).toEqual([]);
    // Corrupt entry should have been evicted so the next write starts clean.
    expect(mockStorage.getItem('nfq_corrupt_key')).toBeNull();
  });

  it('returns false from saveLocal when localStorage throws (quota exceeded)', async () => {
    mockStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cache = await loadCache();
    const ok = cache.saveLocal('nfq_quota_key', { huge: 'payload' });
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns the default value when localStorage.getItem throws (SecurityError)', async () => {
    mockStorage.getItem = () => {
      throw new Error('SecurityError');
    };
    const cache = await loadCache();
    expect(cache.loadLocal('nfq_secerr_key', 'safe-default')).toBe('safe-default');
  });

  it('returns defaults when window is undefined (SSR / test)', async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const cache = await loadCache();
    expect(cache.loadLocal('anything', 'default')).toBe('default');
    expect(cache.saveLocal('anything', { a: 1 })).toBe(false);
  });

  it('does not throw when saving a value that cannot be serialized', async () => {
    type Cyclic = { self?: Cyclic };
    const cyclic: Cyclic = {};
    cyclic.self = cyclic;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cache = await loadCache();
    expect(cache.saveLocal('nfq_cyclic_key', cyclic)).toBe(false);
  });

  it('saveCurrentUser(null) removes the cached user', async () => {
    const cache = await loadCache();
    cache.saveCurrentUser({
      id: 'u1',
      name: 'Alice',
      email: 'a@x',
      role: 'Trader',
      status: 'Active',
      lastLogin: '',
      department: 'Desk',
    });
    expect(cache.loadCurrentUser()?.email).toBe('a@x');
    cache.saveCurrentUser(null);
    expect(cache.loadCurrentUser()).toBeNull();
  });
});
