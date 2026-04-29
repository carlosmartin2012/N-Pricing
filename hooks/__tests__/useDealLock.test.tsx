// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  PresenceValueProvider,
  type PresenceContextValue,
} from '../../contexts/PresenceContext';
import { useDealLock } from '../useDealLock';
import type { PresenceUser } from '../usePresenceAwareness';

const u = (overrides: Partial<PresenceUser> = {}): PresenceUser => ({
  userId: overrides.userId ?? 'u1',
  name: 'User One',
  email: 'u1@bank.es',
  role: 'Trader',
  activeView: 'CALCULATOR',
  activeDealId: overrides.activeDealId,
  entityId: 'E1',
  lastSeen: '2026-04-29T10:00:00Z',
  ...overrides,
});

function buildValue(users: PresenceUser[], selfUserId = 'self'): PresenceContextValue {
  return {
    onlineUsers: users,
    getUsersOnView: (view) => users.filter((x) => x.activeView === view),
    getUsersOnDeal: (dealId) => users.filter((x) => x.activeDealId === dealId),
    selfUserId,
  };
}

function wrap(value: PresenceContextValue): React.FC<{ children: React.ReactNode }> {
  return ({ children }) => (
    <PresenceValueProvider value={value}>{children}</PresenceValueProvider>
  );
}

describe('useDealLock', () => {
  it('returns unlocked when no presence provider is mounted', () => {
    const { result } = renderHook(() => useDealLock('D-001'));
    expect(result.current).toEqual({ locked: false, lockedBy: [] });
  });

  it('returns unlocked when dealId is null/empty', () => {
    const value = buildValue([u({ userId: 'a', activeDealId: 'D-001' })]);
    const { result: r1 } = renderHook(() => useDealLock(null), { wrapper: wrap(value) });
    expect(r1.current.locked).toBe(false);
    const { result: r2 } = renderHook(() => useDealLock(''), { wrapper: wrap(value) });
    expect(r2.current.locked).toBe(false);
  });

  it('returns unlocked when nobody else is on the deal', () => {
    const value = buildValue([u({ userId: 'self', activeDealId: 'D-001' })], 'self');
    const { result } = renderHook(() => useDealLock('D-001'), { wrapper: wrap(value) });
    expect(result.current.locked).toBe(false);
    expect(result.current.lockedBy).toEqual([]);
  });

  it('returns locked + lockedBy when another user is on the deal', () => {
    const other = u({ userId: 'alice', activeDealId: 'D-001', name: 'Alice' });
    const value = buildValue([
      u({ userId: 'self', activeDealId: 'D-001' }),
      other,
    ], 'self');
    const { result } = renderHook(() => useDealLock('D-001'), { wrapper: wrap(value) });
    expect(result.current.locked).toBe(true);
    expect(result.current.lockedBy).toHaveLength(1);
    expect(result.current.lockedBy[0]?.userId).toBe('alice');
  });

  it('aggregates multiple concurrent viewers in lockedBy', () => {
    const value = buildValue([
      u({ userId: 'alice', activeDealId: 'D-001' }),
      u({ userId: 'bob',   activeDealId: 'D-001' }),
      u({ userId: 'carol', activeDealId: 'D-002' }),  // different deal — ignored
    ], 'self');
    const { result } = renderHook(() => useDealLock('D-001'), { wrapper: wrap(value) });
    expect(result.current.locked).toBe(true);
    expect(result.current.lockedBy.map((x) => x.userId).sort()).toEqual(['alice', 'bob']);
  });

  it('excludes the current user even if they are tracked on the same deal', () => {
    const value = buildValue([
      u({ userId: 'self',  activeDealId: 'D-001' }),
      u({ userId: 'alice', activeDealId: 'D-001' }),
    ], 'self');
    const { result } = renderHook(() => useDealLock('D-001'), { wrapper: wrap(value) });
    expect(result.current.lockedBy.find((x) => x.userId === 'self')).toBeUndefined();
    expect(result.current.lockedBy).toHaveLength(1);
  });
});
