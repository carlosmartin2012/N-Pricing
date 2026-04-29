import { useMemo } from 'react';
import { usePresenceOptional } from '../contexts/PresenceContext';
import type { PresenceUser } from './usePresenceAwareness';

/**
 * useDealLock — Ola 7 Bloque B.1.
 *
 * Returns whether someone *other than the current user* is currently
 * viewing or editing the given deal. Built on top of PresenceContext so
 * it does not open additional Supabase Realtime subscriptions.
 *
 * Soft-lock semantics: the lock is *advisory*, not enforced. The UI
 * surfaces the conflict so users can coordinate — they can still
 * proceed (with audit trail) if they choose to. See
 * `docs/ola-7-collaborative-ux.md` §2 Bloque B.
 *
 * If no PresenceProvider is mounted (e.g. tests, Storybook) the hook
 * returns `{ locked: false, lockedBy: [] }` — graceful degradation.
 */
export interface DealLockState {
  locked: boolean;
  lockedBy: PresenceUser[];
}

const EMPTY: DealLockState = { locked: false, lockedBy: [] };

export function useDealLock(dealId: string | null | undefined): DealLockState {
  const presence = usePresenceOptional();

  return useMemo(() => {
    if (!presence || !dealId) return EMPTY;
    const others = presence
      .getUsersOnDeal(dealId)
      .filter((u) => u.userId !== presence.selfUserId);
    if (others.length === 0) return EMPTY;
    return { locked: true, lockedBy: others };
  }, [presence, dealId]);
}
