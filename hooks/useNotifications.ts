import { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../utils/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import type { Notification } from '../types';

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch on mount
  useEffect(() => {
    if (!currentUser?.email) return;

    supabaseService.fetchNotifications(currentUser.email)
      .then(setNotifications)
      .catch(() => {});

    supabaseService.getUnreadCount(currentUser.email)
      .then(setUnreadCount)
      .catch(() => {});
  }, [currentUser?.email]);

  const markRead = useCallback(async (id: number) => {
    await supabaseService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    for (const n of notifications.filter(n => !n.isRead)) {
      await supabaseService.markNotificationRead(n.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [notifications]);

  return { notifications, unreadCount, markRead, markAllRead };
}
