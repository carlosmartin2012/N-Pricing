import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import LtvProjectionCard from './LtvProjectionCard';
import { UIProvider } from '../../contexts/UIContext';
import type { ClientLtvSnapshot } from '../../types/clv';

/**
 * Storybook variants for LtvProjectionCard.
 *
 * The card talks to React Query under the hood via `useClientLtvHistoryQuery`.
 * To drive deterministic states in stories we pre-seed the QueryClient cache
 * with the exact shape the hook expects — no HTTP, no flicker. The component
 * is wrapped in the real `UIProvider` so `useUI().language` resolves.
 */

const SNAPSHOT_POPULATED: ClientLtvSnapshot = {
  id: 'snap-1',
  entityId: 'ent-1',
  clientId: 'demo-1',
  asOfDate: '2026-04-15',
  horizonYears: 10,
  discountRate: 0.08,
  clvPointEur: 1_250_000,
  clvP5Eur: 980_000,
  clvP95Eur: 1_520_000,
  churnHazardAnnual: 0.08,
  renewalProb: 0.65,
  shareOfWalletEst: 0.45,
  shareOfWalletGap: 0.55,
  breakdown: {
    niiEur: 900_000,
    crosssellEur: 220_000,
    feesEur: 180_000,
    churnCostEur: 50_000,
    perPosition: [],
  },
  assumptions: {
    asOfDate: '2026-04-15', horizonYears: 10, discountRate: 0.08,
    churnHazardAnnual: 0.08, renewalProb: 0.65, crosssellProbPerYear: 0.12,
    capitalAllocationRate: 0.08, rarocByProduct: {},
    shareOfWalletEst: 0.45, churnCostPerEur: 0.015,
  },
  assumptionsHash: 'a'.repeat(64),
  engineVersion: 'dev-story',
  computedAt: '2026-04-15T10:00:00Z',
  computedBy: 'story',
};

function withSeededCache(snapshots: ClientLtvSnapshot[]) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['clv', 'ltv', 'demo-1'], snapshots);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh' }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Customer360/LtvProjectionCard',
  component: LtvProjectionCard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LtvProjectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([SNAPSHOT_POPULATED])],
};

export const TightBand: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([{
    ...SNAPSHOT_POPULATED,
    clvP5Eur: 1_200_000,
    clvP95Eur: 1_300_000,
  }])],
};

export const EmptyNeverComputed: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([])],
};

export const HighShareOfWalletGap: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([{
    ...SNAPSHOT_POPULATED,
    shareOfWalletEst: 0.12,
    shareOfWalletGap: 0.88,
  }])],
};
