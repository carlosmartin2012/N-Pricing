import { useState, useEffect, useCallback } from 'react';
import {
  OFFLINE_QUEUE_EVENT,
  getPendingMutations,
  removeMutation,
  incrementRetry,
  getPendingCount,
} from '../utils/offlineStore';
import type { OfflineMutation } from '../utils/offlineStore';
import { apiDelete, apiPost } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import { emitAuditLogChanged } from '../utils/auditEvents';

const log = createLogger('offline-sync');
const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Process a single mutation
  const processMutation = useCallback(async (mutation: OfflineMutation): Promise<boolean> => {
    try {
      if (mutation.table === 'deals') {
        if (mutation.type === 'delete') {
          const id = String(mutation.payload.id ?? '');
          if (!id) throw new Error('Offline delete mutation missing deal id');
          await apiDelete(`/deals/${encodeURIComponent(id)}`);
        } else {
          await apiPost('/deals/upsert', mutation.payload);
        }
      } else if (mutation.table === 'audit_log') {
        if (mutation.type === 'delete') {
          throw new Error('Audit log deletions are not supported');
        }
        await apiPost('/audit', mutation.payload);
        emitAuditLogChanged();
      } else {
        throw new Error(`Unsupported offline mutation table: ${mutation.table}`);
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
    const handleQueueChange = () => {
      void refreshCount();
    };
    const handleOnline = () => {
      log.info('Back online, starting sync');
      void syncAll();
    };
    const handleOffline = () => {
      log.info('Went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);

    // Initial count
    void refreshCount();

    // Sync on mount if online and there are pending mutations
    if (navigator.onLine) {
      void syncAll();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    };
  }, [refreshCount, syncAll]);

  return { pendingCount, isSyncing, syncAll, refreshCount };
}
