import type { FTPResult, Transaction } from '../../types';
import * as dealsApi from '../../api/deals';
import { mapDealFromDB } from '../../api/mappers';
import { apiPost } from '../apiFetch';

/**
 * @deprecated Use `api/deals.ts` directly for CRUD flows. This adapter remains
 * only to preserve the public `supabaseService` surface during the migration.
 */
export const dealService = {
  fetchDeals: dealsApi.listDeals,
  upsertDeal: dealsApi.upsertDeal,
  deleteDeal: dealsApi.deleteDeal,
  createDealVersion: dealsApi.createDealVersion,
  fetchDealsPaginated: dealsApi.listDealsPaginated,

  async renameDealId(previousId: string, nextId: string) {
    if (!previousId || !nextId || previousId === nextId) return null;
    try {
      const row = await apiPost<Record<string, unknown>>(`/deals/${previousId}/rename`, { nextId });
      return row ? mapDealFromDB(row) : null;
    } catch {
      return null;
    }
  },

  fetchDealVersions: dealsApi.listDealVersions,

  async transitionDeal(
    dealId: string,
    newStatus: string,
    userEmail: string,
    pricingSnapshot?: FTPResult,
  ) {
    return dealsApi.transitionDeal({ dealId, newStatus, userEmail, pricingSnapshot });
  },

  async updateDealWithLock(deal: Transaction, expectedVersion: number) {
    return dealsApi.updateDealWithLock(deal, expectedVersion);
  },
};
