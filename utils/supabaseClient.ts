/**
 * Supabase client compat shim — all real data access goes through the Express
 * API (`utils/apiFetch.ts`). This stub keeps Supabase-shaped code paths
 * (`supabase.from('x').select()`, `supabase.channel('y').on(...)`) functional
 * as silent no-ops so that hooks like `useLiveCursors`, `useMFA`, presence,
 * realtime sync, etc. can be feature-flagged on/off without dynamic imports.
 *
 * Active consumers (~14 modules): MFA hooks, live cursors, presence
 * awareness, optimistic deal updates, supabaseSync/* hooks, Admin UI.
 *
 * **Do NOT delete** until those consumers either (a) migrate fully to the
 * Express API and remove their Supabase imports, or (b) get rewired through
 * an explicit feature-flag layer. Deleting prematurely breaks the offline /
 * realtime fallback contract documented in `useSupabaseSync`.
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
