// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  PresenceValueProvider,
  usePresence,
  usePresenceOptional,
  type PresenceContextValue,
} from '../PresenceContext';
import type { PresenceUser } from '../../hooks/usePresenceAwareness';

const u = (overrides: Partial<PresenceUser> = {}): PresenceUser => ({
  userId: overrides.userId ?? 'u1',
  name: 'User One',
  email: 'u1@bank.es',
  role: 'Trader',
  activeView: 'CALCULATOR',
  activeDealId: undefined,
  entityId: 'E1',
  lastSeen: '2026-04-29T10:00:00Z',
  ...overrides,
});

function makeValue(users: PresenceUser[], selfUserId = 'self'): PresenceContextValue {
  return {
    onlineUsers: users,
    getUsersOnView: (view) => users.filter((x) => x.activeView === view),
    getUsersOnDeal: (dealId) => users.filter((x) => x.activeDealId === dealId),
    selfUserId,
  };
}

describe('PresenceValueProvider + usePresence', () => {
  it('exposes the injected value to descendants', () => {
    const value = makeValue([u({ userId: 'a' }), u({ userId: 'b' })], 'self');
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <PresenceValueProvider value={value}>{children}</PresenceValueProvider>
    );
    const { result } = renderHook(() => usePresence(), { wrapper });
    expect(result.current.onlineUsers).toHaveLength(2);
    expect(result.current.selfUserId).toBe('self');
  });

  it('throws when usePresence runs outside a provider', () => {
    expect(() => renderHook(() => usePresence())).toThrowError(/within PresenceProvider/);
  });

  it('usePresenceOptional returns null outside a provider (no throw)', () => {
    const { result } = renderHook(() => usePresenceOptional());
    expect(result.current).toBeNull();
  });
});
