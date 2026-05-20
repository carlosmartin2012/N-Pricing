import { describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, tryReloadForChunkError } from '../chunkReload';

describe('isChunkLoadError', () => {
  it('matches the Chromium dynamic-import message', () => {
    const err = new Error('Failed to fetch dynamically imported module: https://x/y.js');
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('matches the Firefox dynamic-import message', () => {
    const err = new Error('error loading dynamically imported module');
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('matches the Safari dynamic-import message', () => {
    const err = new Error('Importing a module script failed.');
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('accepts plain string errors (window.onerror first arg)', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('accepts {message} objects (PromiseRejectionEvent.reason can be a non-Error)', () => {
    expect(
      isChunkLoadError({ message: 'Failed to fetch dynamically imported module: /assets/x.js' }),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError(new Error('TypeError: Cannot read property foo of undefined'))).toBe(false);
    expect(isChunkLoadError(new Error('NetworkError when attempting to fetch resource.'))).toBe(false);
    expect(isChunkLoadError('Some random rejection')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});

function makeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v);
    }),
    _data: data,
  };
}

describe('tryReloadForChunkError', () => {
  const chunkErr = new Error('Failed to fetch dynamically imported module: /assets/X.js');

  it('returns false (and does NOT reload) for non-chunk errors', () => {
    const reload = vi.fn();
    expect(tryReloadForChunkError(new Error('unrelated'), { storage: makeStorage(), reload, now: () => 1 })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('triggers a reload on the first chunk error and stamps the marker', () => {
    const storage = makeStorage();
    const reload = vi.fn();
    const now = () => 1_700_000_000_000;

    expect(tryReloadForChunkError(chunkErr, { storage, reload, now })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith('n_pricing_chunk_reload_at', String(now()));
  });

  it('does NOT reload again within the 30s re-entry window (avoids infinite loop)', () => {
    const t0 = 1_700_000_000_000;
    const storage = makeStorage({ n_pricing_chunk_reload_at: String(t0) });
    const reload = vi.fn();

    // 10s later — still inside the window
    expect(tryReloadForChunkError(chunkErr, { storage, reload, now: () => t0 + 10_000 })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again once the re-entry window has elapsed', () => {
    const t0 = 1_700_000_000_000;
    const storage = makeStorage({ n_pricing_chunk_reload_at: String(t0) });
    const reload = vi.fn();

    // 31s later — outside the window, safe to retry
    expect(tryReloadForChunkError(chunkErr, { storage, reload, now: () => t0 + 31_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('treats a missing storage gracefully (still reloads)', () => {
    const reload = vi.fn();
    expect(
      tryReloadForChunkError(chunkErr, {
        // Cast through unknown to simulate the "storage unavailable" branch.
        storage: null as unknown as Storage,
        reload,
        now: () => 1,
      }),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
