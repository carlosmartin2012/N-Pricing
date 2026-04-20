import { useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import * as dealsApi from '../api/deals';
import type { Transaction } from '../types';
import { canPersistRemotely } from '../utils/dataModeUtils';
import { createLogger } from '../utils/logger';
import { isSupabaseConfigured } from '../utils/supabaseClient';

const log = createLogger('optimistic-update');

/**
 * Hook for optimistic deal updates.
 * Updates local state immediately, then syncs with server.
 * Rolls back on failure.
 */
export function useOptimisticDealUpdate() {
  const { deals, setDeals, dataMode } = useData();
  const canWriteRemotely = canPersistRemotely({ dataMode, isSupabaseConfigured });

  const optimisticUpdate = useCallback(
    async (updatedDeal: Transaction): Promise<{ success: boolean; error?: string }> => {
      // Save snapshot for rollback
      const snapshot = [...deals];
      const index = deals.findIndex((d) => d.id === updatedDeal.id);

      // Optimistic: update local state immediately
      if (index >= 0) {
        setDeals((prev) => prev.map((d) => (d.id === updatedDeal.id ? updatedDeal : d)));
      } else {
        setDeals((prev) => [updatedDeal, ...prev]);
      }

      try {
        if (!canWriteRemotely) {
          log.info('Optimistic update kept local in demo mode', { dealId: updatedDeal.id });
          return { success: true };
        }
        // Sync with server
        const persisted = await dealsApi.upsertDeal(updatedDeal);
        if (!persisted) {
          throw new Error('Server returned null');
        }

        // Update with server version (may have server-computed fields)
        setDeals((prev) => prev.map((d) => (d.id === persisted.id ? persisted : d)));

        log.info('Optimistic update synced', { dealId: updatedDeal.id });
        return { success: true };
      } catch (err: unknown) {
        // Rollback
        log.warn('Optimistic update failed, rolling back', { dealId: updatedDeal.id, error: err });
        setDeals(snapshot);
        return { success: false, error: err instanceof Error ? err.message : 'Sync failed' };
      }
    },
    [canWriteRemotely, deals, setDeals],
  );

  const optimisticDelete = useCallback(
    async (dealId: string): Promise<{ success: boolean; error?: string }> => {
      const snapshot = [...deals];

      // Optimistic: remove from local state
      setDeals((prev) => prev.filter((d) => d.id !== dealId));

      try {
        if (!canWriteRemotely) {
          log.info('Optimistic delete kept local in demo mode', { dealId });
          return { success: true };
        }
        await dealsApi.deleteDeal(dealId);
        log.info('Optimistic delete synced', { dealId });
        return { success: true };
      } catch (err: unknown) {
        log.warn('Optimistic delete failed, rolling back', { dealId, error: err });
        setDeals(snapshot);
        return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
      }
    },
    [canWriteRemotely, deals, setDeals],
  );

  return { optimisticUpdate, optimisticDelete };
}
