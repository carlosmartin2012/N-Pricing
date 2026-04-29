import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import DealLockBadge from './DealLockBadge';
import {
  PresenceValueProvider,
  type PresenceContextValue,
} from '../../contexts/PresenceContext';
import type { PresenceUser } from '../../hooks/usePresenceAwareness';

/**
 * Stories for DealLockBadge (Ola 7 Bloque B.2). Renders the soft-lock
 * pill that appears when 1+ other users are tracked on the same deal.
 *
 * Each story injects a synthetic PresenceContext value via
 * PresenceValueProvider — bypassing the real Supabase Realtime channel
 * keeps the stories deterministic and offline-friendly.
 */

function buildUser(overrides: Partial<PresenceUser> = {}): PresenceUser {
  return {
    userId: overrides.userId ?? 'u1',
    name: overrides.name ?? 'User One',
    email: overrides.email ?? 'u1@bank.es',
    role: 'Trader',
    activeView: 'CALCULATOR',
    activeDealId: overrides.activeDealId ?? 'D-001',
    entityId: 'E1',
    lastSeen: '2026-04-29T10:00:00Z',
    ...overrides,
  };
}

function buildPresence(users: PresenceUser[], selfUserId = 'self'): PresenceContextValue {
  return {
    onlineUsers: users,
    getUsersOnView: (view) => users.filter((u) => u.activeView === view),
    getUsersOnDeal: (dealId) => users.filter((u) => u.activeDealId === dealId),
    selfUserId,
  };
}

const meta = {
  title: 'Deals/DealLockBadge',
  component: DealLockBadge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DealLockBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const wrapWithPresence = (presence: PresenceContextValue) =>
  function Wrap(StoryComponent: React.ComponentType) {
    return (
      <PresenceValueProvider value={presence}>
        <div style={{ background: 'var(--nfq-bg-root)', padding: 24, fontFamily: 'JetBrains Mono' }}>
          <span style={{ color: 'var(--nfq-accent)', fontSize: 12, fontWeight: 700 }}>
            TRD-HYPER-001
          </span>
          <StoryComponent />
        </div>
      </PresenceValueProvider>
    );
  };

export const NoLock: Story = {
  args: { dealId: 'D-001' },
  decorators: [wrapWithPresence(buildPresence([]))],
  parameters: {
    docs: { description: { story: 'No other users on this deal — badge does not render.' } },
  },
};

export const SingleEditor: Story = {
  args: { dealId: 'D-001' },
  decorators: [
    wrapWithPresence(buildPresence([buildUser({ userId: 'alice', name: 'Alice' })])),
  ],
  parameters: {
    docs: { description: { story: 'One other user editing — singular label "Alice editing".' } },
  },
};

export const MultipleEditors: Story = {
  args: { dealId: 'D-001' },
  decorators: [
    wrapWithPresence(
      buildPresence([
        buildUser({ userId: 'alice', name: 'Alice' }),
        buildUser({ userId: 'bob', name: 'Bob' }),
        buildUser({ userId: 'carol', name: 'Carol' }),
      ]),
    ),
  ],
  parameters: {
    docs: { description: { story: 'Three editors — pluralised "3 editing" with hover-tooltip listing names.' } },
  },
};

export const ChipVariant: Story = {
  args: { dealId: 'D-001', variant: 'chip' },
  decorators: [
    wrapWithPresence(buildPresence([buildUser({ userId: 'alice', name: 'Alice' })])),
  ],
  parameters: {
    docs: { description: { story: 'Chip variant — used in Calculator selector header (Ola 7 Bloque B.3).' } },
  },
};
