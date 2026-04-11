import { useState, useEffect, useCallback } from 'react';
import * as notificationsApi from '../api/notifications';
import { useAuth } from '../contexts/AuthContext';
import type { Notification } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('useNotifications');

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch on mount
  useEffect(() => {
    if (!currentUser?.email) return;

    notificationsApi.listNotifications(currentUser.email)
      .then(setNotifications)
      .catch((err) => log.warn('fetch failed', { error: String(err) }));

    notificationsApi.getUnreadNotificationCount(currentUser.email)
      .then(setUnreadCount)
      .catch((err) => log.warn('unread count failed', { error: String(err) }));
  }, [currentUser?.email]);

  const markRead = useCallback(async (id: number) => {
    await notificationsApi.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.email) return;
    try {
      await notificationsApi.markAllNotificationsRead(currentUser.email);
    } catch {
      // Fallback: nothing to do, UI already reflects the change optimistically
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [currentUser?.email]);

  return { notifications, unreadCount, markRead, markAllRead };
}
