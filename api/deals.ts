/**
 * API layer — Deals (CRUD + workflow transitions)
 *
 * Wraps Supabase calls for the `deals` table with typed inputs/outputs
 * and consistent error handling via `safeSupabaseCall`.
 */

import type { FTPResult, Transaction } from '../types';
import { safeSupabaseCall } from '../utils/validation';
import { supabase, nowIso } from '../utils/supabase/shared';
import { mapDealFromDB, mapDealToDB } from './mappers';

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/** Fetch all deals, ordered by most-recently created first. Optionally filter by entity. */
export async function listDeals(entityId?: string): Promise<Transaction[]> {
  const { data } = await safeSupabaseCall(
    async () => {
      let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      return query;
    },
    [],
    'listDeals',
  );
  return (data as Record<string, unknown>[]).map(mapDealFromDB);
}

/** Insert or update a single deal. Returns the persisted deal or `null` on error. */
export async function upsertDeal(deal: Transaction): Promise<Transaction | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('deals').upsert(mapDealToDB(deal)).select(),
    null,
    'upsertDeal',
  );
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapDealFromDB(rows[0]) : null;
}

/**
 * Update a deal with optimistic locking.
 * Returns the updated deal, or throws if version conflict.
 */
export async function updateDealWithLock(
  deal: Transaction,
  expectedVersion: number,
): Promise<{ deal: Transaction | null; conflict: boolean; serverVersion?: Transaction }> {
  // Attempt update with version check
  const { data, error } = await safeSupabaseCall(
    async () =>
      supabase
        .from('deals')
        .update(mapDealToDB(deal))
        .eq('id', deal.id)
        .eq('version', expectedVersion)
        .select(),
    null,
    'updateDealWithLock',
  );

  if (error) return { deal: null, conflict: false };

  const rows = data as Record<string, unknown>[] | null;
  if (!rows || rows.length === 0) {
    // Version mismatch — fetch current server version
    const { data: currentData } = await safeSupabaseCall(
      async () => supabase.from('deals').select('*').eq('id', deal.id).single(),
      null,
      'fetchConflictDeal',
    );
    const serverDeal = currentData ? mapDealFromDB(currentData as Record<string, unknown>) : undefined;
    return { deal: null, conflict: true, serverVersion: serverDeal };
  }

  return { deal: mapDealFromDB(rows[0]), conflict: false };
}

/** Delete a deal by id. */
export async function deleteDeal(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('deals').delete().eq('id', id),
    null,
    'deleteDeal',
  );
}

/** Batch upsert multiple deals. Returns the persisted deals. */
export async function batchUpsertDeals(deals: Transaction[]): Promise<Transaction[]> {
  if (deals.length === 0) return [];

  const { data, error } = await safeSupabaseCall(
    async () =>
      supabase
        .from('deals')
        .upsert(deals.map(mapDealToDB))
        .select(),
    null,
    'batchUpsertDeals',
  );
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapDealFromDB);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedDeals {
  data: Transaction[];
  total: number;
}

export interface PaginatedResult<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
  totalEstimate?: number;
}

export interface DealSummary {
  id: string;
  status: string;
  clientId: string;
  productType: string;
  amount: number;
  currency: string;
  entityId?: string;
  createdAt: string;
}

/**
 * Cursor-based pagination for deals.
 * Uses (created_at, id) as cursor for stable ordering.
 */
export async function listDealsCursor(
  options: {
    limit?: number;
    cursor?: string;
    entityId?: string;
  } = {},
): Promise<PaginatedResult<Transaction>> {
  const { limit = 50, cursor, entityId } = options;

  const { data, error } = await safeSupabaseCall(
    async () => {
      let query = supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1); // Fetch one extra to check hasMore

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      if (cursor) {
        // Cursor format: base64 of "created_at|id"
        const decoded = atob(cursor);
        const [cursorDate, cursorId] = decoded.split('|');
        query = query.or(
          `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`,
        );
      }

      return query;
    },
    [],
    'listDealsCursor',
  );

  if (error || !data) return { data: [], cursor: null, hasMore: false };

  const rows = data as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const deals = pageRows.map(mapDealFromDB);

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const lastRow = pageRows[pageRows.length - 1];
    nextCursor = btoa(`${lastRow.created_at}|${lastRow.id}`);
  }

  return { data: deals, cursor: nextCursor, hasMore };
}

/** Fetch deals with minimal columns for list views. */
export async function listDealsLight(entityId?: string): Promise<DealSummary[]> {
  const { data } = await safeSupabaseCall(
    async () => {
      let query = supabase
        .from('deals')
        .select('id, status, client_id, product_type, amount, currency, entity_id, created_at')
        .order('created_at', { ascending: false });
      if (entityId) query = query.eq('entity_id', entityId);
      return query;
    },
    [],
    'listDealsLight',
  );
  return (data as any[]).map((row) => ({
    id: row.id,
    status: row.status,
    clientId: row.client_id,
    productType: row.product_type,
    amount: row.amount,
    currency: row.currency,
    entityId: row.entity_id,
    createdAt: row.created_at,
  }));
}

/** Fetch a paginated slice of deals. */
export async function listDealsPaginated(
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedDeals> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await safeSupabaseCall(
    async () =>
      supabase
        .from('deals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to),
    null,
    'listDealsPaginated',
  );

  if (error || !data) return { data: [], total: 0 };

  // Supabase returns count alongside data when { count: 'exact' } is used.
  const result = data as Record<string, unknown>[] & { count?: number };
  return {
    data: (Array.isArray(result) ? result : []).map(mapDealFromDB),
    total: (result as unknown as { count?: number }).count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

export interface TransitionOptions {
  dealId: string;
  newStatus: string;
  userEmail: string;
  pricingSnapshot?: FTPResult;
}

/** Transition a deal to a new status (Draft, Pending_Approval, Approved, ...). */
export async function transitionDeal(opts: TransitionOptions): Promise<Transaction | null> {
  const { dealId, newStatus, userEmail, pricingSnapshot } = opts;

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: nowIso(),
  };

  if (newStatus === 'Approved') {
    updateData.approved_by = userEmail;
    updateData.approved_at = nowIso();
  }

  if (newStatus === 'Pending_Approval' && pricingSnapshot) {
    updateData.pricing_snapshot = JSON.parse(JSON.stringify(pricingSnapshot));
    updateData.locked_at = nowIso();
    updateData.locked_by = userEmail;
  }

  if (newStatus === 'Booked') {
    updateData.locked_at = nowIso();
    updateData.locked_by = userEmail;
  }

  if (newStatus === 'Draft' || newStatus === 'Rejected') {
    updateData.locked_at = null;
    updateData.locked_by = null;
    updateData.approved_by = null;
    updateData.approved_at = null;
  }

  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('deals').update(updateData).eq('id', dealId).select(),
    null,
    'transitionDeal',
  );

  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapDealFromDB(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Deal versions
// ---------------------------------------------------------------------------

/** Create a point-in-time version snapshot of a deal. */
export async function createDealVersion(
  dealId: string,
  version: number,
  snapshot: Transaction,
  pricingResult: FTPResult | null,
  changedBy: string,
  reason?: string,
): Promise<void> {
  await safeSupabaseCall(
    async () =>
      supabase.from('deal_versions').insert({
        deal_id: dealId,
        version,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        pricing_result: pricingResult ? JSON.parse(JSON.stringify(pricingResult)) : null,
        changed_by: changedBy,
        change_reason: reason || null,
      }),
    null,
    'createDealVersion',
  );
}

/** Fetch all versions of a deal, most-recent first. */
export async function listDealVersions(dealId: string): Promise<Record<string, unknown>[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('deal_versions')
        .select('*')
        .eq('deal_id', dealId)
        .order('version', { ascending: false }),
    [],
    'listDealVersions',
  );
  return (data ?? []) as Record<string, unknown>[];
}
