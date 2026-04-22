import { describe, expect, it } from 'vitest';
import {
  canPersistRemotely,
  describeDataModeState,
  resolveHydrationPlan,
} from '../dataModeUtils';

describe('dataModeUtils', () => {
  it('uses remote hydration for demo mode when supabase is configured (DB-backed demo)', () => {
    const plan = resolveHydrationPlan({
      dataMode: 'demo',
      isSupabaseConfigured: true,
    });

    expect(plan.source).toBe('remote');
    expect(plan.syncStatus).toBe('idle');
    expect(plan.reason).toBe('demo-mode-db');
  });

  it('falls back to mock hydration for demo mode when supabase is unconfigured (offline)', () => {
    const plan = resolveHydrationPlan({
      dataMode: 'demo',
      isSupabaseConfigured: false,
    });

    expect(plan.source).toBe('mock');
    expect(plan.syncStatus).toBe('mock');
    expect(plan.reason).toBe('demo-mode-offline');
  });

  it('uses remote hydration when live mode is selected and supabase is configured', () => {
    const plan = resolveHydrationPlan({
      dataMode: 'live',
      isSupabaseConfigured: true,
    });

    expect(plan.source).toBe('remote');
    expect(plan.syncStatus).toBe('idle');
    expect(plan.reason).toBe('live-mode');
  });

  it('falls back to mock hydration when live mode has no supabase configuration', () => {
    const plan = resolveHydrationPlan({
      dataMode: 'live',
      isSupabaseConfigured: false,
    });

    expect(plan.source).toBe('mock');
    expect(plan.syncStatus).toBe('mock');
    expect(plan.reason).toBe('supabase-unconfigured');
  });

  it('disables remote persistence in demo mode', () => {
    expect(canPersistRemotely({ dataMode: 'demo', isSupabaseConfigured: true })).toBe(false);
    expect(canPersistRemotely({ dataMode: 'live', isSupabaseConfigured: true })).toBe(true);
  });

  it('describes the current data mode state for the UI badge', () => {
    // Demo + synced = DB-backed demo (the new default)
    expect(describeDataModeState({ dataMode: 'demo', syncStatus: 'synced' })).toEqual({
      badgeLabel: 'DEMO',
      accent: 'amber',
      detail: 'Using coherent demo dataset from the database.',
    });

    // Demo + mock = fallback (DB unreachable)
    expect(describeDataModeState({ dataMode: 'demo', syncStatus: 'mock' })).toEqual({
      badgeLabel: 'DEMO · FALLBACK',
      accent: 'amber',
      detail: 'Demo mode using JS fallback dataset (DB unreachable).',
    });

    expect(describeDataModeState({ dataMode: 'live', syncStatus: 'synced' })).toEqual({
      badgeLabel: 'LIVE',
      accent: 'emerald',
      detail: 'Connected to the live synchronized workspace.',
    });

    expect(describeDataModeState({ dataMode: 'live', syncStatus: 'mock' })).toEqual({
      badgeLabel: 'LIVE · FALLBACK',
      accent: 'amber',
      detail: 'Live mode selected, but the app is currently using fallback demo data.',
    });
  });
});
