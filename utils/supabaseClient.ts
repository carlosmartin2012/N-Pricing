/**
 * Supabase client stub — all data access goes through the Express API (utils/apiFetch.ts).
 * This stub exists to satisfy legacy imports that reference `supabase` without making
 * real network calls. Any code path reaching this stub is a no-op by design.
 *
 * @deprecated Remove this file once all legacy Supabase imports are migrated.
 */
export const isSupabaseConfigured = true;

// No-op supabase object — only used for legacy code paths that haven't been
// fully migrated. All real data access goes through utils/apiFetch.ts.
const noopAsync = async () => ({ data: null, error: null, count: null });

const noopChain: Record<string, unknown> = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'then') return undefined;
    if (['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gt', 'lt',
         'gte', 'lte', 'in', 'is', 'or', 'order', 'limit', 'range', 'single', 'head',
         'returns', 'filter', 'match'].includes(String(prop))) {
      return () => noopChain;
    }
    return noopAsync;
  },
});

function makeTable() {
  return () => noopChain;
}

const noopChannel = {
  on: () => noopChannel,
  subscribe: (_cb?: (status: string) => void) => { _cb?.('SUBSCRIBED'); return noopChannel; },
  unsubscribe: () => {},
  track: async () => {},
  presenceState: () => ({}),
};

export const supabase = {
  from: makeTable(),
  channel: (_name: string) => noopChannel,
  removeChannel: () => {},
} as unknown as import('@supabase/supabase-js').SupabaseClient;
