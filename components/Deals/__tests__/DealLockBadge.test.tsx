// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PresenceValueProvider,
  type PresenceContextValue,
} from '../../../contexts/PresenceContext';
import DealLockBadge from '../DealLockBadge';
import type { PresenceUser } from '../../../hooks/usePresenceAwareness';

const u = (overrides: Partial<PresenceUser> = {}): PresenceUser => ({
  userId: overrides.userId ?? 'u1',
  name: overrides.name ?? 'User One',
  email: overrides.email ?? 'u1@bank.es',
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

describe('DealLockBadge', () => {
  it('renders nothing when there is no presence provider', () => {
    const { container } = render(<DealLockBadge dealId="D-001" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when nobody else is on the deal', () => {
    const value = buildValue([u({ userId: 'self', activeDealId: 'D-001' })], 'self');
    const { container } = render(
      <PresenceValueProvider value={value}>
        <DealLockBadge dealId="D-001" />
      </PresenceValueProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the singular label with the user name when one other user is editing', () => {
    const value = buildValue([
      u({ userId: 'alice', activeDealId: 'D-001', name: 'Alice' }),
    ], 'self');
    render(
      <PresenceValueProvider value={value}>
        <DealLockBadge dealId="D-001" />
      </PresenceValueProvider>,
    );
    const badge = screen.getByTestId('deal-lock-badge');
    expect(badge.textContent).toMatch(/Alice editing/);
    expect(badge.getAttribute('data-lock-count')).toBe('1');
  });

  it('renders the plural label with count when multiple users are editing', () => {
    const value = buildValue([
      u({ userId: 'alice', activeDealId: 'D-001', name: 'Alice' }),
      u({ userId: 'bob',   activeDealId: 'D-001', name: 'Bob' }),
      u({ userId: 'carol', activeDealId: 'D-001', name: 'Carol' }),
    ], 'self');
    render(
      <PresenceValueProvider value={value}>
        <DealLockBadge dealId="D-001" />
      </PresenceValueProvider>,
    );
    const badge = screen.getByTestId('deal-lock-badge');
    expect(badge.textContent).toMatch(/3 editing/);
    expect(badge.getAttribute('data-lock-count')).toBe('3');
  });

  it('exposes lockedBy names in the title attribute for hover detail', () => {
    const value = buildValue([
      u({ userId: 'alice', activeDealId: 'D-001', name: 'Alice' }),
      u({ userId: 'bob',   activeDealId: 'D-001', name: 'Bob' }),
    ], 'self');
    render(
      <PresenceValueProvider value={value}>
        <DealLockBadge dealId="D-001" />
      </PresenceValueProvider>,
    );
    const badge = screen.getByTestId('deal-lock-badge');
    expect(badge.getAttribute('title')).toBe('Alice, Bob');
  });

  it('uses the chip variant styles when variant="chip"', () => {
    const value = buildValue([
      u({ userId: 'alice', activeDealId: 'D-001', name: 'Alice' }),
    ], 'self');
    render(
      <PresenceValueProvider value={value}>
        <DealLockBadge dealId="D-001" variant="chip" />
      </PresenceValueProvider>,
    );
    const badge = screen.getByTestId('deal-lock-badge');
    expect(badge.className).toContain('rounded-full');
  });
});
