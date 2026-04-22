export type DataMode = 'live' | 'demo';
export type SyncStatus = 'idle' | 'mock' | 'synced' | 'error';

export interface HydrationPlan {
  source: 'remote' | 'mock';
  syncStatus: SyncStatus;
  reason: 'demo-mode-db' | 'demo-mode-offline' | 'live-mode' | 'supabase-unconfigured';
}

export function resolveHydrationPlan({
  dataMode,
  isSupabaseConfigured,
}: {
  dataMode: DataMode;
  isSupabaseConfigured: boolean;
}): HydrationPlan {
  // Demo mode prefers the DB path when available — the JS mock catalogue and
  // the seeded DEFAULT_ENTITY_ID rows are byte-compatible (same IDs, same
  // shape), so reading from DB keeps demo coherent with live's code path.
  // The remote fetch in useInitialHydration already falls back to MOCK_* via
  // resolveWithFallback when an endpoint returns null, so this is safe even
  // if the DB is partially empty. Full offline (no Supabase config) keeps
  // the legacy mock-only path.
  if (dataMode === 'demo') {
    if (!isSupabaseConfigured) {
      return { source: 'mock', syncStatus: 'mock', reason: 'demo-mode-offline' };
    }
    return { source: 'remote', syncStatus: 'idle', reason: 'demo-mode-db' };
  }

  if (!isSupabaseConfigured) {
    return { source: 'mock', syncStatus: 'mock', reason: 'supabase-unconfigured' };
  }

  return { source: 'remote', syncStatus: 'idle', reason: 'live-mode' };
}

export function canPersistRemotely({
  dataMode,
  isSupabaseConfigured,
}: {
  dataMode: DataMode;
  isSupabaseConfigured: boolean;
}): boolean {
  return dataMode === 'live' && isSupabaseConfigured;
}

export function describeDataModeState({
  dataMode,
  syncStatus,
}: {
  dataMode: DataMode;
  syncStatus: SyncStatus;
}): { badgeLabel: string; accent: 'amber' | 'emerald' | 'rose'; detail: string } {
  if (dataMode === 'demo') {
    if (syncStatus === 'mock') {
      return {
        badgeLabel: 'DEMO · FALLBACK',
        accent: 'amber',
        detail: 'Demo mode using JS fallback dataset (DB unreachable).',
      };
    }
    return {
      badgeLabel: 'DEMO',
      accent: 'amber',
      detail: 'Using coherent demo dataset from the database.',
    };
  }

  if (syncStatus === 'synced') {
    return {
      badgeLabel: 'LIVE',
      accent: 'emerald',
      detail: 'Connected to the live synchronized workspace.',
    };
  }

  if (syncStatus === 'mock') {
    return {
      badgeLabel: 'LIVE · FALLBACK',
      accent: 'amber',
      detail: 'Live mode selected, but the app is currently using fallback demo data.',
    };
  }

  return {
    badgeLabel: 'LIVE · ATTENTION',
    accent: 'rose',
    detail: 'Live mode selected, but synchronization is degraded.',
  };
}
