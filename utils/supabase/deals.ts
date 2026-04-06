import type { FTPResult, Transaction } from '../../types';
import { mapDealFromDB, mapDealToDB } from './mappers';
import { log, nowIso, supabase } from './shared';

export const dealService = {
  async fetchDeals(): Promise<Transaction[]> {
    const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false });

    if (error) {
      log.error('Error fetching deals', { code: error.code }, error);
      return [];
    }

    return (data || []).map(mapDealFromDB);
  },

  async upsertDeal(deal: Transaction) {
    const { data, error } = await supabase.from('deals').upsert(mapDealToDB(deal)).select();

    if (error) log.error('Error saving deal', { code: error.code });
    return data ? mapDealFromDB(data[0]) : null;
  },

  async deleteDeal(id: string) {
    const { error } = await supabase.from('deals').delete().eq('id', id);

    if (error) log.error('Error deleting deal', { code: error.code });
  },

  async renameDealId(previousId: string, nextId: string) {
    if (!previousId || !nextId || previousId === nextId) {
      return null;
    }

    const { data: existingDeal, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', previousId)
      .single();

    if (fetchError || !existingDeal) {
      log.error('Error fetching deal for rename', { code: fetchError?.code, previousId, nextId });
      return null;
    }

    const { data: insertedDeal, error: insertError } = await supabase
      .from('deals')
      .insert({
        ...existingDeal,
        id: nextId,
        updated_at: nowIso(),
      })
      .select()
      .single();

    if (insertError || !insertedDeal) {
      log.error('Error inserting renamed deal', { code: insertError?.code, previousId, nextId });
      return null;
    }

    const updateEmbeddedDealId = async (table: string, column: string) => {
      const { data: rows, error: rowsError } = await (supabase
        .from(table)
        .select(`id, ${column}`)
        .eq('deal_id', previousId) as unknown as Promise<{
        data: Array<{ id: string | number; [key: string]: unknown }> | null;
        error: { code?: string } | null;
      }>);

      if (rowsError) {
        log.error('Error fetching rows for embedded deal rename', { code: rowsError.code, table, previousId, nextId });
        return;
      }

      await Promise.all(
        (rows || []).map(async (row: { id: string | number; [key: string]: unknown }) => {
          const snapshot = row[column];
          if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
            return;
          }

          const nextSnapshot = {
            ...(snapshot as Record<string, unknown>),
            id:
              (snapshot as Record<string, unknown>).id === previousId
                ? nextId
                : (snapshot as Record<string, unknown>).id,
          };

          const { error } = await supabase
            .from(table)
            .update({ [column]: nextSnapshot })
            .eq('id', row.id);

          if (error) {
            log.error('Error updating embedded deal snapshot during rename', {
              code: error.code,
              table,
              previousId,
              nextId,
            });
          }
        })
      );
    };

    await Promise.all([
      supabase.from('pricing_results').update({ deal_id: nextId }).eq('deal_id', previousId),
      supabase.from('deal_versions').update({ deal_id: nextId }).eq('deal_id', previousId),
      supabase.from('deal_comments').update({ deal_id: nextId }).eq('deal_id', previousId),
      supabase.from('notifications').update({ deal_id: nextId }).eq('deal_id', previousId),
    ]);
    await Promise.all([
      updateEmbeddedDealId('pricing_results', 'deal_snapshot'),
      updateEmbeddedDealId('deal_versions', 'snapshot'),
    ]);

    const { error: deleteError } = await supabase.from('deals').delete().eq('id', previousId);

    if (deleteError) {
      log.error('Error deleting original deal after rename', { code: deleteError.code, previousId, nextId });
      return null;
    }

    return mapDealFromDB(insertedDeal);
  },

  async createDealVersion(
    dealId: string,
    version: number,
    snapshot: Transaction,
    pricingResult: FTPResult | null,
    changedBy: string,
    reason?: string
  ) {
    const { error } = await supabase.from('deal_versions').insert({
      deal_id: dealId,
      version,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      pricing_result: pricingResult ? JSON.parse(JSON.stringify(pricingResult)) : null,
      changed_by: changedBy,
      change_reason: reason || null,
    });

    if (error) log.error('Error creating deal version', { code: error.code });
  },

  async fetchDealVersions(dealId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('deal_versions')
      .select('*')
      .eq('deal_id', dealId)
      .order('version', { ascending: false });

    if (error) {
      log.error('Error fetching deal versions', { code: error.code });
      return [];
    }

    return data || [];
  },

  async transitionDeal(dealId: string, newStatus: string, userEmail: string, pricingSnapshot?: FTPResult) {
    const updateData: any = {
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

    const { data, error } = await supabase.from('deals').update(updateData).eq('id', dealId).select();

    if (error) {
      log.error('Error transitioning deal', { code: error.code });
      return null;
    }

    return data ? mapDealFromDB(data[0]) : null;
  },

  async fetchDealsPaginated(page: number = 1, pageSize: number = 50): Promise<{ data: Transaction[]; total: number }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('deals')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      log.error('Error fetching paginated deals', { code: error.code });
      return { data: [], total: 0 };
    }

    return {
      data: (data || []).map(mapDealFromDB),
      total: count || 0,
    };
  },
};
