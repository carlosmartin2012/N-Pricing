export type DataMode = 'live' | 'demo';
export type SyncStatus = 'idle' | 'mock' | 'synced' | 'error';

export interface HydrationPlan {
  source: 'remote' | 'mock';
  syncStatus: SyncStatus;
  reason: 'demo-mode' | 'live-mode' | 'supabase-unconfigured';
}

export function resolveHydrationPlan({
  dataMode,
  isSupabaseConfigured,
}: {
  dataMode: DataMode;
  isSupabaseConfigured: boolean;
}): HydrationPlan {
  if (dataMode === 'demo') {
    return { source: 'mock', syncStatus: 'mock', reason: 'demo-mode' };
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
    return {
      badgeLabel: 'DEMO',
      accent: 'amber',
      detail: 'Using coherent demo dataset across the workspace.',
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
