import React, { createContext, useContext, useMemo } from 'react';
import {
  usePresenceAwareness,
  type PresenceUser,
} from '../hooks/usePresenceAwareness';

/**
 * PresenceContext — Ola 7 Bloque B.1.
 *
 * Wraps `usePresenceAwareness` so descendant components can read the
 * current set of online users + derived selectors (per-view, per-deal)
 * without each opening their own Supabase Realtime channel.
 *
 * The Provider takes the same options the hook used to take in App.tsx;
 * App.tsx mounts it once at the auth boundary and unmounts it on logout
 * (because `enabled` follows isAuthenticated).
 */

export interface PresenceContextValue {
  onlineUsers: PresenceUser[];
  getUsersOnView: (viewId: string) => PresenceUser[];
  getUsersOnDeal: (dealId: string) => PresenceUser[];
  /** Always equal to the userId passed in options, so descendant
   *  selectors can filter "everyone except me" without prop-drilling. */
  selfUserId: string;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

interface ProviderProps {
  userId: string;
  name: string;
  email: string;
  role: string;
  activeView: string;
  activeDealId?: string;
  entityId?: string;
  enabled: boolean;
  children: React.ReactNode;
}

export const PresenceProvider: React.FC<ProviderProps> = ({
  userId, name, email, role, activeView, activeDealId, entityId, enabled, children,
}) => {
  const { onlineUsers, getUsersOnView, getUsersOnDeal } = usePresenceAwareness({
    userId, name, email, role, activeView, activeDealId, entityId, enabled,
  });

  const value = useMemo<PresenceContextValue>(
    () => ({ onlineUsers, getUsersOnView, getUsersOnDeal, selfUserId: userId }),
    [onlineUsers, getUsersOnView, getUsersOnDeal, userId],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

/**
 * Lower-level value provider — accepts an explicit PresenceContextValue
 * instead of running `usePresenceAwareness` itself. Use it when the
 * caller already has the hook running (App.tsx) to avoid opening a
 * second Supabase Realtime channel, or in tests/Storybook to inject
 * synthetic presence data.
 */
export const PresenceValueProvider: React.FC<{
  value: PresenceContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
);

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return ctx;
}

/**
 * Optional variant — returns null if no provider is mounted. Useful for
 * components that want to render gracefully outside the auth tree
 * (e.g. shared components used in Storybook stories).
 */
export function usePresenceOptional(): PresenceContextValue | null {
  return useContext(PresenceContext);
}
