import type { Notification } from '../types';
import { apiGet, apiPatch, apiPost } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import { mapNotificationFromDB } from './mappers';

const log = createLogger('api/notifications');

export async function listNotifications(email: string): Promise<Notification[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(
      `/config/notifications?email=${encodeURIComponent(email)}`,
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapNotificationFromDB);
  } catch (err) {
    log.warn('listNotifications failed — returning empty list', { email, error: String(err) });
    return [];
  }
}

export async function getUnreadNotificationCount(email: string): Promise<number> {
  try {
    const result = await apiGet<{ count: number }>(
      `/config/notifications/unread-count?email=${encodeURIComponent(email)}`,
    );
    return result.count;
  } catch (err) {
    log.warn('getUnreadNotificationCount failed — returning 0', { email, error: String(err) });
    return 0;
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiPatch(`/config/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(email: string): Promise<void> {
  await apiPatch('/config/notifications/read-all', { email });
}

export async function createNotification(input: {
  recipient: string;
  sender: string;
  type: string;
  title: string;
  message: string;
  dealId?: string;
}): Promise<void> {
  await apiPost('/config/notifications', input);
}
