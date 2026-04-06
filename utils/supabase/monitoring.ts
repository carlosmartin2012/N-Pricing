import type { AuditEntry, DealComment, Notification } from '../../types';
import {
  mapAuditFromDB,
  mapBUFromDB,
  mapClientFromDB,
  mapDealCommentFromDB,
  mapDealFromDB,
  mapModelFromDB,
  mapNotificationFromDB,
  mapProductFromDB,
  mapRuleFromDB,
} from './mappers';
import { buildAuditInsertPayload, type AuditWriteResult } from './auditTransport';
import { log, supabase } from './shared';

function buildRealtimeMappedPayload(payload: any) {
  const isDelete = payload.eventType === 'DELETE';
  const data = isDelete ? payload.old : payload.new;

  if (!data) return undefined;

  if (payload.table === 'deals') {
    data.id = data.id || payload.old?.id;
  }

  if (payload.table === 'deals') data.mapped = mapDealFromDB(data);
  if (payload.table === 'audit_log') data.mapped = mapAuditFromDB(data);
  if (payload.table === 'behavioural_models') data.mapped = mapModelFromDB(data);
  if (payload.table === 'rules') data.mapped = mapRuleFromDB(data);
  if (payload.table === 'clients') data.mapped = mapClientFromDB(data);
  if (payload.table === 'products') data.mapped = mapProductFromDB(data);
  if (payload.table === 'business_units') data.mapped = mapBUFromDB(data);
  if (payload.table === 'yield_curves') {
    data.mapped = {
      currency: data.currency,
      date: data.as_of_date,
      points: data.grid_data,
    };
  }

  if (payload.table === 'system_config' && !isDelete) {
    data.mapped = data.value;
    data.config_key = data.key;
  }

  return data.mapped;
}

export const monitoringService = {
  async fetchAuditLog(): Promise<AuditEntry[]> {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      log.error('Error fetching audit log', { code: error.code });
      return [];
    }

    log.info('Fetched audit entries', { count: data?.length || 0 });
    return (data || []).map(mapAuditFromDB);
  },

  async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditWriteResult> {
    const { error } = await supabase
      .from('audit_log')
      .insert(buildAuditInsertPayload({ ...entry, timestamp: new Date().toISOString() }));

    if (error) {
      log.error('Error adding audit entry', { code: error.code, message: error.message });
      return {
        ok: false,
        errorMessage: `Error de Supabase (${error.code}): ${error.message}`,
      };
    }

    log.info('Successfully added audit entry', { action: entry.action });
    return { ok: true };
  },

  async fetchAuditLogPaginated(
    page: number = 1,
    pageSize: number = 100,
  ): Promise<{ data: AuditEntry[]; total: number; errorMessage?: string }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (error) {
      log.error('Error fetching paginated audit log', { code: error.code });
      return {
        data: [],
        total: 0,
        errorMessage: `Error audit_log: ${error.message} (${error.code})`,
      };
    }

    return {
      data: (data || []).map(mapAuditFromDB),
      total: count || 0,
    };
  },

  subscribeToAll(onUpdate: (payload: any) => void) {
    return supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const mapped = buildRealtimeMappedPayload(payload);
        log.debug(`Realtime update on ${payload.table}`, { eventType: payload.eventType });
        onUpdate({ ...payload, mapped });
      })
      .subscribe((status) => {
        log.info('Supabase Channel Subscription Status', { status });
        if (status === 'SUBSCRIBED') {
          log.info('Successfully connected to Supabase Realtime');
        } else if (status === 'CHANNEL_ERROR') {
          log.error('Error connecting to Supabase Realtime channel');
        }
      });
  },

  async savePricingResult(
    dealId: string,
    result: any,
    dealSnapshot: any,
    calculatedBy: string,
  ): Promise<void> {
    try {
      const { count } = await supabase
        .from('pricing_results')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId);

      await supabase
        .from('pricing_results')
        .insert({
          deal_id: dealId,
          version: (count || 0) + 1,
          base_rate: result.baseRate,
          liquidity_spread: result.liquiditySpread,
          strategic_spread: result.strategicSpread,
          option_cost: result.optionCost,
          regulatory_cost: result.regulatoryCost,
          lcr_cost: result.lcrCost || 0,
          nsfr_cost: result.nsfrCost || 0,
          operational_cost: result.operationalCost,
          capital_charge: result.capitalCharge,
          esg_transition_charge: result.esgTransitionCharge,
          esg_physical_charge: result.esgPhysicalCharge,
          floor_price: result.floorPrice,
          technical_price: result.technicalPrice,
          target_price: result.targetPrice,
          total_ftp: result.totalFTP,
          final_client_rate: result.finalClientRate,
          raroc: result.raroc,
          economic_profit: result.economicProfit,
          approval_level: result.approvalLevel,
          matched_methodology: result.matchedMethodology,
          match_reason: result.matchReason,
          formula_used: result.formulaUsed || null,
          behavioral_maturity_used: result.behavioralMaturityUsed || null,
          incentivisation_adj: result.incentivisationAdj || null,
          capital_income: result.capitalIncome || null,
          calculated_by: calculatedBy,
          deal_snapshot: dealSnapshot,
        });
    } catch (error) {
      log.warn('savePricingResult failed', { error: String(error) });
    }
  },

  async fetchPricingHistory(dealId: string): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('pricing_results')
        .select('*')
        .eq('deal_id', dealId)
        .order('version', { ascending: false });

      return data || [];
    } catch (error) {
      log.warn('fetchPricingHistory failed', { error: String(error) });
      return [];
    }
  },

  async fetchDealComments(dealId: string): Promise<DealComment[]> {
    const { data, error } = await supabase
      .from('deal_comments')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Error fetching deal comments', { code: error.code });
      return [];
    }

    return (data || []).map(mapDealCommentFromDB);
  },

  async addDealComment(
    dealId: string,
    userEmail: string,
    userName: string,
    action: string,
    comment: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('deal_comments')
      .insert({
        deal_id: dealId,
        user_email: userEmail,
        user_name: userName,
        action,
        comment,
      });

    if (error) log.error('Error adding deal comment', { code: error.code });
  },

  async fetchNotifications(email: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      log.error('Error fetching notifications', { code: error.code });
      return [];
    }

    return (data || []).map(mapNotificationFromDB);
  },

  async markNotificationRead(id: number): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) log.error('Error marking notification read', { code: error.code });
  },

  async createNotification(
    recipient: string,
    sender: string,
    type: string,
    title: string,
    message: string,
    dealId?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert({
        recipient_email: recipient,
        sender_email: sender,
        type,
        title,
        message,
        deal_id: dealId || null,
      });

    if (error) log.error('Error creating notification', { code: error.code });
  },

  async getUnreadCount(email: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', email)
      .eq('is_read', false);

    if (error) {
      log.error('Error getting unread count', { code: error.code });
      return 0;
    }

    return count || 0;
  },
};
