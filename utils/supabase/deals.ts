import type { FTPResult, Transaction } from '../../types';
import { mapDealFromDB, mapDealToDB } from './mappers';
import { apiGet, apiPost, apiPatch, apiDelete } from '../apiFetch';
import { log, nowIso } from './shared';

export const dealService = {
  async fetchDeals(): Promise<Transaction[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/deals');
      return rows.map(mapDealFromDB);
    } catch (err) {
      log.error('Error fetching deals', { error: String(err) });
      return [];
    }
  },

  async upsertDeal(deal: Transaction) {
    try {
      const db = mapDealToDB(deal);
      const row = await apiPost<Record<string, unknown>>('/deals/upsert', db);
      return row ? mapDealFromDB(row) : null;
    } catch (err) {
      log.error('Error saving deal', { error: String(err) });
      return null;
    }
  },

  async deleteDeal(id: string) {
    try {
      await apiDelete(`/deals/${id}`);
    } catch (err) {
      log.error('Error deleting deal', { error: String(err) });
    }
  },

  async renameDealId(previousId: string, nextId: string) {
    if (!previousId || !nextId || previousId === nextId) return null;
    try {
      const row = await apiPost<Record<string, unknown>>(`/deals/${previousId}/rename`, { nextId });
      return row ? mapDealFromDB(row) : null;
    } catch (err) {
      log.error('Error renaming deal', { error: String(err) });
      return null;
    }
  },

  async createDealVersion(dealId: string, version: number, snapshot: Transaction, pricingResult: FTPResult | null, changedBy: string, reason?: string) {
    try {
      await apiPost(`/deals/${dealId}/versions`, { version, snapshot, pricingResult, changedBy, changeReason: reason });
    } catch (err) {
      log.error('Error creating deal version', { error: String(err) });
    }
  },

  async fetchDealVersions(dealId: string): Promise<unknown[]> {
    try {
      return await apiGet<unknown[]>(`/deals/${dealId}/versions`);
    } catch { return []; }
  },

  async transitionDeal(dealId: string, newStatus: string, userEmail: string, pricingSnapshot?: FTPResult) {
    try {
      const row = await apiPatch<Record<string, unknown>>(`/deals/${dealId}/transition`, { newStatus, userEmail, pricingSnapshot });
      return row ? mapDealFromDB(row) : null;
    } catch (err) {
      log.error('Error transitioning deal', { error: String(err) });
      return null;
    }
  },

  async fetchDealsPaginated(page: number = 1, pageSize: number = 50): Promise<{ data: Transaction[]; total: number }> {
    try {
      const result = await apiGet<{ data: Record<string, unknown>[]; total: number }>(`/deals/paginated?page=${page}&pageSize=${pageSize}`);
      return { data: result.data.map(mapDealFromDB), total: result.total };
    } catch {
      return { data: [], total: 0 };
    }
  },
};
