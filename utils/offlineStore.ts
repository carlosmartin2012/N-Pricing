import { get, set, del, keys, createStore } from 'idb-keyval';
import { createLogger } from './logger';

const log = createLogger('offline-store');
export const OFFLINE_QUEUE_EVENT = 'n-pricing-offline-queue-changed';

// Separate stores for different data types
const draftStore = createStore('n-pricing-drafts', 'deals');
const mutationStore = createStore('n-pricing-mutations', 'queue');

// ─── Mutation Queue ───────────────────────────────────────────────

export interface OfflineMutation {
  id: string;
  type: 'create' | 'update' | 'upsert' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  entityId: string;
  createdAt: string;
  retryCount: number;
}

function emitQueueChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

/** Add a mutation to the offline queue */
export async function enqueueMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const entry: OfflineMutation = {
    ...mutation,
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await set(entry.id, entry, mutationStore);
  emitQueueChange();
  log.info('Mutation enqueued', { id: entry.id, type: mutation.type, table: mutation.table });
}

/** Get all pending mutations in order */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const allKeys = await keys(mutationStore);
  const mutations: OfflineMutation[] = [];
  for (const key of allKeys) {
    const val = await get<OfflineMutation>(key, mutationStore);
    if (val) mutations.push(val);
  }
  return mutations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Remove a processed mutation */
export async function removeMutation(id: string): Promise<void> {
  await del(id, mutationStore);
  emitQueueChange();
}

/** Increment retry count for a failed mutation */
export async function incrementRetry(id: string): Promise<void> {
  const mutation = await get<OfflineMutation>(id, mutationStore);
  if (mutation) {
    mutation.retryCount += 1;
    await set(id, mutation, mutationStore);
  }
}

/** Get count of pending mutations */
export async function getPendingCount(): Promise<number> {
  const allKeys = await keys(mutationStore);
  return allKeys.length;
}

// ─── Draft Storage ────────────────────────────────────────────────

/** Save a deal draft to IndexedDB */
export async function saveDraft(dealId: string, data: Record<string, unknown>): Promise<void> {
  await set(dealId, { ...data, _savedAt: new Date().toISOString() }, draftStore);
}

/** Get a saved draft */
export async function getDraft(dealId: string): Promise<Record<string, unknown> | undefined> {
  return get(dealId, draftStore);
}

/** Remove a draft (e.g., after successful sync) */
export async function removeDraft(dealId: string): Promise<void> {
  await del(dealId, draftStore);
}

/** Get all saved drafts */
export async function getAllDrafts(): Promise<Record<string, unknown>[]> {
  const allKeys = await keys(draftStore);
  const drafts: Record<string, unknown>[] = [];
  for (const key of allKeys) {
    const val = await get<Record<string, unknown>>(key, draftStore);
    if (val) drafts.push(val);
  }
  return drafts;
}
