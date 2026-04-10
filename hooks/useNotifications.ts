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
      .catch((err) => console.warn('[useNotifications] fetch failed:', err));

    supabaseService.getUnreadCount(currentUser.email)
      .then(setUnreadCount)
      .catch((err) => console.warn('[useNotifications] unread count failed:', err));
  }, [currentUser?.email]);

  const markRead = useCallback(async (id: number) => {
    await supabaseService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!currentUser?.email) return;
    try {
      await fetch('/api/config/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email }),
      });
    } catch {
      // Fallback: nothing to do, UI already reflects the change optimistically
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [currentUser?.email]);

  return { notifications, unreadCount, markRead, markAllRead };
}
