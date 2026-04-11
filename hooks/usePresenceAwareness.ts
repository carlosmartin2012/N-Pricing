import { useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  activeView: string;
  activeDealId?: string;
  entityId?: string;
  lastSeen: string;
}

interface UsePresenceOptions {
  userId: string;
  name: string;
  email: string;
  role: string;
  activeView: string;
  activeDealId?: string;
  entityId?: string;
  enabled: boolean;
}

export function usePresenceAwareness(options: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !options.enabled || !options.userId) return;

    const channel = supabase.channel('presence-awareness', {
      config: { presence: { key: options.userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const [, presences] of Object.entries(state)) {
          for (const p of presences as any[]) {
            if (p.userId !== options.userId) {
              users.push({
                userId: p.userId,
                name: p.name,
                email: p.email,
                role: p.role,
                activeView: p.activeView,
                activeDealId: p.activeDealId,
                entityId: p.entityId,
                lastSeen: p.lastSeen,
              });
            }
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: options.userId,
            name: options.name,
            email: options.email,
            role: options.role,
            activeView: options.activeView,
            activeDealId: options.activeDealId ?? null,
            entityId: options.entityId ?? null,
            lastSeen: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // Intentionally only re-subscribes when `enabled` or `userId` change.
    // Changes to other `options.*` fields (name, role, view, deal, entity)
    // are handled by the second effect below, which calls `channel.track`
    // on the existing channel without tearing down and re-opening the
    // Realtime subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled, options.userId]);

  // Update tracked presence when view/deal changes (without re-subscribing)
  useEffect(() => {
    if (!channelRef.current || !options.enabled) return;
    void channelRef.current.track({
      userId: options.userId,
      name: options.name,
      email: options.email,
      role: options.role,
      activeView: options.activeView,
      activeDealId: options.activeDealId ?? null,
      entityId: options.entityId ?? null,
      lastSeen: new Date().toISOString(),
    });
  }, [options.activeView, options.activeDealId, options.enabled, options.userId, options.name, options.email, options.role, options.entityId]);

  const getUsersOnView = useCallback(
    (viewId: string) => onlineUsers.filter((u) => u.activeView === viewId),
    [onlineUsers]
  );

  const getUsersOnDeal = useCallback(
    (dealId: string) => onlineUsers.filter((u) => u.activeDealId === dealId),
    [onlineUsers]
  );

  return { onlineUsers, getUsersOnView, getUsersOnDeal };
}
