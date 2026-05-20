/**
 * Stale-bundle guard.
 *
 * When the SPA's entrypoint is older than what the server now serves (PWA
 * cached the old index.html, or the user kept the tab open across a deploy),
 * dynamic `import()` for a lazy chunk asks the server for a hash that no
 * longer exists. The browser raises:
 *   - Chrome / V8:  "Failed to fetch dynamically imported module"
 *   - Firefox:      "error loading dynamically imported module"
 *   - Safari:       "Importing a module script failed"
 *
 * A single hard reload picks up the new entrypoint and resolves it. The guard
 * is a hot path (every uncaught error / rejection passes through it) so it is
 * a pure, allocation-free check followed by a single sessionStorage roundtrip.
 *
 * Reload-once via a sessionStorage marker prevents an infinite reload loop
 * when the chunk is genuinely missing on the server (vs. stale-bundle).
 */

const MARKER_KEY = 'n_pricing_chunk_reload_at';
const REENTRY_WINDOW_MS = 30_000;

const NEEDLES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
];

export function isChunkLoadError(err: unknown): boolean {
  const msg = errorMessage(err);
  if (!msg) return false;
  for (const needle of NEEDLES) {
    if (msg.includes(needle)) return true;
  }
  return false;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    return typeof m === 'string' ? m : '';
  }
  return '';
}

interface ReloadDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  reload: () => void;
  now: () => number;
}

/**
 * Returns true if a reload was triggered. Caller can use the return value to
 * skip downstream error reporting (the page is about to navigate away).
 */
export function tryReloadForChunkError(err: unknown, deps?: Partial<ReloadDeps>): boolean {
  if (!isChunkLoadError(err)) return false;

  const storage = deps?.storage ?? safeSessionStorage();
  const reload = deps?.reload ?? defaultReload;
  const now = deps?.now ?? Date.now;

  if (!storage) {
    reload();
    return true;
  }

  const last = Number(storage.getItem(MARKER_KEY) ?? '0');
  if (Number.isFinite(last) && last > 0 && now() - last < REENTRY_WINDOW_MS) {
    // Already reloaded recently. The chunk is genuinely missing — let the
    // error propagate so the RootErrorBoundary shows it.
    return false;
  }

  storage.setItem(MARKER_KEY, String(now()));
  reload();
  return true;
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function defaultReload(): void {
  if (typeof window === 'undefined') return;
  window.location.reload();
}
