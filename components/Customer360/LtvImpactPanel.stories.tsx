import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import LtvImpactPanel from './LtvImpactPanel';
import { UIProvider } from '../../contexts/UIContext';
import type { DealCandidate, LtvAssumptions, MarginalLtvImpact } from '../../types/clv';
import type { PreviewLtvImpactResponse } from '../../api/clv';

/**
 * Stories for LtvImpactPanel — the live ΔCLV companion that sits next
 * to the Pricing Calculator.
 *
 * Three visible states the banker actually encounters:
 *   1. No client selected        → instructive placeholder.
 *   2. Client selected but deal
 *      incomplete                → "complete product + amount + rate".
 *   3. Deal ready                → full before/after + breakdown.
 *
 * Seeding React Query cache: the component builds a fingerprint as
 * `JSON.stringify({ clientId, ...candidate })`. The same shape is used
 * here so the cache key lines up and the story renders without HTTP.
 */

const BASE_CANDIDATE: DealCandidate = {
  productType: 'Corporate_Loan',
  currency: 'EUR',
  amountEur: 5_000_000,
  tenorYears: 5,
  rateBps: 420,
  marginBps: 200,
  capitalEur: 400_000,
  rarocAnnual: 0.16,
};

const BASE_ASSUMPTIONS: LtvAssumptions = {
  asOfDate: '2026-04-15',
  horizonYears: 10,
  discountRate: 0.08,
  churnHazardAnnual: 0.08,
  renewalProb: 0.65,
  crosssellProbPerYear: 0.12,
  capitalAllocationRate: 0.08,
  rarocByProduct: {},
  shareOfWalletEst: 0.5,
  churnCostPerEur: 0.015,
};

const fingerprintFor = (clientId: string | null, candidate: Partial<DealCandidate>): string =>
  JSON.stringify({ clientId, ...candidate });

function seed(
  clientId: string,
  candidate: DealCandidate,
  impact: MarginalLtvImpact,
  clvBefore = 1_250_000,
) {
  const response: PreviewLtvImpactResponse = {
    before: {
      clvPointEur: clvBefore,
      clvP5Eur: clvBefore * 0.78,
      clvP95Eur: clvBefore * 1.22,
    },
    impact,
    assumptions: BASE_ASSUMPTIONS,
  };
  const fp = fingerprintFor(clientId, candidate);
  return { fp, response };
}

function withSeededCache(clientId: string, candidate: DealCandidate, impact: MarginalLtvImpact) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { fp, response } = seed(clientId, candidate, impact);
    qc.setQueryData(['clv', 'preview-impact', clientId, fp], response);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 420 }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

// For placeholder/no-op states we don't need a seed — the component
// short-circuits before calling the query.
function withBareShell() {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 420 }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Customer360/LtvImpactPanel',
  component: LtvImpactPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LtvImpactPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoClientSelected: Story = {
  args: {
    clientId: null,
    candidate: BASE_CANDIDATE,
  },
  decorators: [withBareShell()],
};

export const ClientSelectedButIncompleteDeal: Story = {
  args: {
    clientId: 'demo-1',
    candidate: { productType: 'Corporate_Loan' },
  },
  decorators: [withBareShell()],
};

const POSITIVE_IMPACT: MarginalLtvImpact = {
  clvBeforeEur: 1_250_000,
  clvAfterEur: 1_350_000,
  deltaClvEur: 100_000,
  deltaClvPct: 0.08,
  breakdown: {
    directNiiEur: 60_000,
    crosssellUpliftEur: 20_000,
    churnReductionEur: 15_000,
    capitalOpportunityEur: 5_000,
  },
};

export const PopulatedPositiveDelta: Story = {
  args: {
    clientId: 'demo-1',
    candidate: BASE_CANDIDATE,
    debounceMs: 0,
  },
  decorators: [withSeededCache('demo-1', BASE_CANDIDATE, POSITIVE_IMPACT)],
};

const NEGATIVE_IMPACT: MarginalLtvImpact = {
  clvBeforeEur: 1_250_000,
  clvAfterEur: 1_180_000,
  deltaClvEur: -70_000,
  deltaClvPct: -0.056,
  breakdown: {
    directNiiEur: 30_000,
    crosssellUpliftEur: -10_000,
    churnReductionEur: -40_000,
    capitalOpportunityEur: -50_000,
  },
};

export const PopulatedNegativeDelta: Story = {
  args: {
    clientId: 'demo-1',
    candidate: { ...BASE_CANDIDATE, marginBps: 50, rarocAnnual: 0.05 },
    debounceMs: 0,
  },
  decorators: [withSeededCache(
    'demo-1',
    { ...BASE_CANDIDATE, marginBps: 50, rarocAnnual: 0.05 },
    NEGATIVE_IMPACT,
  )],
};

const HUGE_IMPACT: MarginalLtvImpact = {
  clvBeforeEur: 1_250_000,
  clvAfterEur: 3_600_000,
  deltaClvEur: 2_350_000,
  deltaClvPct: 1.88,
  breakdown: {
    directNiiEur: 1_200_000,
    crosssellUpliftEur: 600_000,
    churnReductionEur: 400_000,
    capitalOpportunityEur: 150_000,
  },
};

export const PopulatedHighImpactDemo: Story = {
  args: {
    clientId: 'demo-1',
    candidate: { ...BASE_CANDIDATE, amountEur: 50_000_000, marginBps: 300 },
    debounceMs: 0,
  },
  decorators: [withSeededCache(
    'demo-1',
    { ...BASE_CANDIDATE, amountEur: 50_000_000, marginBps: 300 },
    HUGE_IMPACT,
  )],
};
