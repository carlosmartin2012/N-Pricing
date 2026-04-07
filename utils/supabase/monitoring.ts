import type { AuditEntry, DealComment, Notification } from '../../types';
import { mapAuditFromDB, mapDealCommentFromDB, mapNotificationFromDB } from './mappers';
import { type AuditWriteResult } from './auditTransport';
import { apiGet, apiPost, apiPatch } from '../apiFetch';
import { log } from './shared';

export const monitoringService = {
  async fetchAuditLog(): Promise<AuditEntry[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/audit');
      return rows.map(mapAuditFromDB);
    } catch (err) {
      log.error('Error fetching audit log', { error: String(err) });
      return [];
    }
  },

  async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditWriteResult> {
    try {
      await apiPost('/audit', {
        user_email: entry.userEmail,
        user_name: entry.userName,
        action: entry.action,
        module: entry.module,
        description: entry.description,
        details: (entry as Record<string, unknown>).details ?? {},
        timestamp: new Date().toISOString(),
      });
      return { ok: true };
    } catch (err) {
      log.error('Error adding audit entry', { error: String(err) });
      return { ok: false, errorMessage: String(err) };
    }
  },

  async fetchAuditLogPaginated(
    page: number = 1,
    pageSize: number = 100,
  ): Promise<{ data: AuditEntry[]; total: number; errorMessage?: string }> {
    try {
      const result = await apiGet<{ data: Record<string, unknown>[]; total: number }>(`/audit/paginated?page=${page}&pageSize=${pageSize}`);
      return { data: result.data.map(mapAuditFromDB), total: result.total };
    } catch (err) {
      return { data: [], total: 0, errorMessage: String(err) };
    }
  },

  subscribeToAll(_onUpdate: (payload: unknown) => void) {
    return { unsubscribe: () => {} };
  },

  async savePricingResult(dealId: string, result: unknown, dealSnapshot: unknown, calculatedBy: string): Promise<void> {
    try {
      await apiPost(`/deals/${dealId}/pricing-results`, { ...result as object, calculatedBy, dealSnapshot });
    } catch (err) {
      log.warn('savePricingResult failed', { error: String(err) });
    }
  },

  async fetchPricingHistory(dealId: string): Promise<unknown[]> {
    try {
      return await apiGet<unknown[]>(`/deals/${dealId}/pricing-history`);
    } catch {
      return [];
    }
  },

  async fetchDealComments(dealId: string): Promise<DealComment[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>(`/deals/${dealId}/comments`);
      return rows.map(mapDealCommentFromDB);
    } catch {
      return [];
    }
  },

  async addDealComment(dealId: string, userEmail: string, userName: string, action: string, comment: string): Promise<void> {
    try {
      await apiPost(`/deals/${dealId}/comments`, { userEmail, userName, action, comment });
    } catch (err) {
      log.error('Error adding deal comment', { error: String(err) });
    }
  },

  async fetchNotifications(email: string): Promise<Notification[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>(`/config/notifications?email=${encodeURIComponent(email)}`);
      return rows.map(mapNotificationFromDB);
    } catch {
      return [];
    }
  },

  async markNotificationRead(id: number): Promise<void> {
    try {
      await apiPatch(`/config/notifications/${id}/read`, {});
    } catch (err) {
      log.error('Error marking notification read', { error: String(err) });
    }
  },

  async createNotification(recipient: string, sender: string, type: string, title: string, message: string, dealId?: string): Promise<void> {
    try {
      await apiPost('/config/notifications', { recipient, sender, type, title, message, dealId });
    } catch (err) {
      log.error('Error creating notification', { error: String(err) });
    }
  },

  async getUnreadCount(email: string): Promise<number> {
    try {
      const result = await apiGet<{ count: number }>(`/config/notifications/unread-count?email=${encodeURIComponent(email)}`);
      return result.count;
    } catch {
      return 0;
    }
  },
};
