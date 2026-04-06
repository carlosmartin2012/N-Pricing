import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingMutations, removeMutation, incrementRetry, getPendingCount } from '../utils/offlineStore';
import type { OfflineMutation } from '../utils/offlineStore';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { createLogger } from '../utils/logger';

const log = createLogger('offline-sync');
const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useRef(navigator.onLine);

  // Update pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Process a single mutation
  const processMutation = useCallback(async (mutation: OfflineMutation): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;

    try {
      if (mutation.type === 'create') {
        const { error } = await supabase.from(mutation.table).insert(mutation.payload);
        if (error) throw error;
      } else if (mutation.type === 'update') {
        const id = mutation.payload.id;
        const { error } = await supabase.from(mutation.table).update(mutation.payload).eq('id', id);
        if (error) throw error;
      } else if (mutation.type === 'delete') {
        const id = mutation.payload.id;
        const { error } = await supabase.from(mutation.table).delete().eq('id', id);
        if (error) throw error;
      }

      await removeMutation(mutation.id);
      log.info('Mutation synced', { id: mutation.id, type: mutation.type });
      return true;
    } catch (err) {
      log.warn('Mutation sync failed', { id: mutation.id, error: err });

      if (mutation.retryCount >= MAX_RETRIES) {
        log.error('Mutation exceeded max retries, discarding', { id: mutation.id });
        await removeMutation(mutation.id);
        return false;
      }

      await incrementRetry(mutation.id);
      return false;
    }
  }, []);

  // Process all pending mutations
  const syncAll = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      const mutations = await getPendingMutations();
      log.info('Processing mutation queue', { count: mutations.length });

      for (const mutation of mutations) {
        const success = await processMutation(mutation);
        if (!success && navigator.onLine) {
          // Continue trying others even if one fails
          continue;
        }
        if (!navigator.onLine) {
          log.info('Went offline during sync, pausing');
          break;
        }
      }
    } finally {
      setIsSyncing(false);
      await refreshCount();
    }
  }, [isSyncing, processMutation, refreshCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true;
      log.info('Back online, starting sync');
      void syncAll();
    };
    const handleOffline = () => {
      isOnline.current = false;
      log.info('Went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count
    void refreshCount();

    // Sync on mount if online and there are pending mutations
    if (navigator.onLine) {
      void syncAll();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, syncAll]);

  return { pendingCount, isSyncing, syncAll, refreshCount };
}
