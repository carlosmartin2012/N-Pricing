import type { FTPResult, Transaction } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import { mapDealFromDB, mapDealToDB } from './mappers';

const log = createLogger('api/deals');

export async function listDeals(entityId?: string): Promise<Transaction[]> {
  const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
  const rows = await apiGet<Record<string, unknown>[]>(`/deals${qs}`);
  return rows.map(mapDealFromDB);
}

export async function upsertDeal(deal: Transaction): Promise<Transaction | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/deals/upsert', mapDealToDB(deal));
    return row ? mapDealFromDB(row) : null;
  } catch (err) {
    log.error('upsertDeal failed', { dealId: deal.id }, err as Error);
    return null;
  }
}

export async function updateDealWithLock(
  deal: Transaction,
  expectedVersion: number,
): Promise<{ deal: Transaction | null; conflict: boolean; serverVersion?: Transaction }> {
  try {
    const result = await apiPatch<{ conflict: boolean; deal: Record<string, unknown> | null; serverVersion?: Record<string, unknown> }>(
      `/deals/${deal.id}/lock-update`,
      { deal: mapDealToDB(deal), expectedVersion },
    );
    return {
      deal: result.deal ? mapDealFromDB(result.deal) : null,
      conflict: result.conflict,
      serverVersion: result.serverVersion ? mapDealFromDB(result.serverVersion) : undefined,
    };
  } catch (err) {
    log.error('updateDealWithLock failed', { dealId: deal.id, expectedVersion }, err as Error);
    return { deal: null, conflict: false };
  }
}

export async function deleteDeal(id: string): Promise<void> {
  await apiDelete(`/deals/${id}`);
}

export async function batchUpsertDeals(deals: Transaction[]): Promise<Transaction[]> {
  if (deals.length === 0) return [];
  try {
    const rows = await apiPost<Record<string, unknown>[]>('/deals/batch-upsert', deals.map(mapDealToDB));
    return rows.map(mapDealFromDB);
  } catch (err) {
    log.error('batchUpsertDeals failed', { count: deals.length }, err as Error);
    return [];
  }
}

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

export async function listDealsCursor(
  options: { limit?: number; cursor?: string; entityId?: string } = {},
): Promise<PaginatedResult<Transaction>> {
  const { limit = 50, cursor, entityId } = options;
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (entityId) params.set('entity_id', entityId);
  try {
    const result = await apiGet<{ data: Record<string, unknown>[]; cursor: string | null; hasMore: boolean }>(`/deals/cursor?${params}`);
    return { data: result.data.map(mapDealFromDB), cursor: result.cursor, hasMore: result.hasMore };
  } catch (err) {
    log.warn('listDealsCursor failed — returning empty page', { limit, cursor, entityId, error: String(err) });
    return { data: [], cursor: null, hasMore: false };
  }
}

export async function listDealsLight(entityId?: string): Promise<DealSummary[]> {
  const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
  try {
    const rows = await apiGet<Record<string, unknown>[]>(`/deals/light${qs}`);
    return rows.map((row) => ({
      id: String(row.id),
      status: String(row.status ?? ''),
      clientId: String(row.client_id ?? ''),
      productType: String(row.product_type ?? ''),
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? 'USD'),
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      createdAt: String(row.created_at ?? ''),
    }));
  } catch (err) {
    log.warn('listDealsLight failed — returning empty list', { entityId, error: String(err) });
    return [];
  }
}

export async function listDealsPaginated(page: number = 1, pageSize: number = 50): Promise<PaginatedDeals> {
  try {
    const result = await apiGet<{ data: Record<string, unknown>[]; total: number }>(`/deals/paginated?page=${page}&pageSize=${pageSize}`);
    return { data: result.data.map(mapDealFromDB), total: result.total };
  } catch (err) {
    log.warn('listDealsPaginated failed — returning empty page', { page, pageSize, error: String(err) });
    return { data: [], total: 0 };
  }
}

export interface TransitionOptions {
  dealId: string;
  newStatus: string;
  userEmail: string;
  pricingSnapshot?: FTPResult;
}

export async function transitionDeal(opts: TransitionOptions): Promise<Transaction | null> {
  try {
    const row = await apiPatch<Record<string, unknown>>(`/deals/${opts.dealId}/transition`, {
      newStatus: opts.newStatus,
      userEmail: opts.userEmail,
      pricingSnapshot: opts.pricingSnapshot,
    });
    return row ? mapDealFromDB(row) : null;
  } catch (err) {
    log.error('transitionDeal failed', { dealId: opts.dealId, newStatus: opts.newStatus }, err as Error);
    return null;
  }
}

export async function createDealVersion(
  dealId: string,
  version: number,
  snapshot: Transaction,
  pricingResult: FTPResult | null,
  changedBy: string,
  reason?: string,
): Promise<void> {
  try {
    await apiPost(`/deals/${dealId}/versions`, { version, snapshot, pricingResult, changedBy, changeReason: reason });
  } catch (err) {
    // Non-blocking: versioning failure should surface but not break deal save flow
    log.warn('createDealVersion failed — version snapshot not persisted', { dealId, version, changedBy, error: String(err) });
  }
}

export async function listDealVersions(dealId: string): Promise<Record<string, unknown>[]> {
  try {
    return await apiGet<Record<string, unknown>[]>(`/deals/${dealId}/versions`);
  } catch (err) {
    log.warn('listDealVersions failed — returning empty list', { dealId, error: String(err) });
    return [];
  }
}
