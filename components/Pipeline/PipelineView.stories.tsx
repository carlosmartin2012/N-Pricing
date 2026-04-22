import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router';
import PipelineView from './PipelineView';
import { UIProvider } from '../../contexts/UIContext';
import { EntityProvider } from '../../contexts/EntityContext';
import type { PipelineNbaRow } from '../../types/clv';

/**
 * Stories for PipelineView — firmwide NBA feed. The component consumes
 * `usePipelineNbaQuery('open')` by default, so seeding the cache under
 * ['clv', 'pipeline', 'nba', 'open'] produces a synchronous render.
 *
 * Variants capture the RM's real views:
 *   - Empty (no open NBA for the book today)
 *   - A small pipeline (3 recommendations)
 *   - A busy pipeline (12 recommendations across 10 clients)
 *   - Consumed-only status filter
 */

function nba(overrides: Partial<PipelineNbaRow> = {}): PipelineNbaRow {
  return {
    id: 'n-1',
    entityId: 'ent-1',
    clientId: 'C-1',
    clientName: 'Acme Industrial SA',
    clientSegment: 'Large Corporate',
    clientRating: 'A',
    recommendedProduct: 'FX_Hedging',
    recommendedRateBps: 40,
    recommendedVolumeEur: 1_500_000,
    recommendedCurrency: 'EUR',
    expectedClvDeltaEur: 320_000,
    confidence: 0.82,
    reasonCodes: ['product_gap_core', 'renewal_window_open'],
    rationale: 'FX_Hedging €1.5M → ΔCLV 2.1% · renewal window open · core product gap',
    source: 'engine',
    generatedAt: '2026-04-22T10:00:00Z',
    consumedAt: null,
    consumedBy: null,
    ...overrides,
  };
}

function withSeededCache(rows: PipelineNbaRow[], status: 'open' | 'consumed' | 'all' = 'open') {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['clv', 'pipeline', 'nba', status], rows);
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EntityProvider>
            <UIProvider>
              <div style={{ background: '#0e0e0e', minHeight: '100vh' }}>
                <Story />
              </div>
            </UIProvider>
          </EntityProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Pipeline/PipelineView',
  component: PipelineView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PipelineView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  decorators: [withSeededCache([])],
};

export const SmallPipeline: Story = {
  decorators: [withSeededCache([
    nba({ id: 'n-1', clientName: 'Acme Industrial SA',   recommendedProduct: 'ESG_Green_Loan', recommendedVolumeEur: 3_000_000, expectedClvDeltaEur: 410_000, confidence: 0.85, reasonCodes: ['regulatory_incentive_available', 'nim_below_target'], rationale: 'ESG_Green_Loan €3M → ΔCLV 4.6% · reg incentive · NIM lift' }),
    nba({ id: 'n-2', clientName: 'Beta Solar Energy SL', recommendedProduct: 'FX_Hedging',     recommendedVolumeEur: 1_500_000, expectedClvDeltaEur: 320_000, confidence: 0.78 }),
    nba({ id: 'n-3', clientName: 'Gamma Healthcare',     recommendedProduct: 'Trade_Finance',  recommendedVolumeEur:   800_000, expectedClvDeltaEur: 115_000, confidence: 0.62, reasonCodes: ['capacity_underused'], rationale: 'Trade finance €800K → ΔCLV 1.4%' }),
  ])],
};

export const BusyPipeline: Story = {
  decorators: [withSeededCache(
    Array.from({ length: 12 }).map((_, i) =>
      nba({
        id: `n-${i + 1}`,
        clientId: `C-${i + 1}`,
        clientName: ['Acme Industrial', 'Beta Solar', 'Gamma Health', 'Delta Trade', 'Epsilon Logistics',
                     'Zeta Retail', 'Eta Utility', 'Theta Mining', 'Iota Media', 'Kappa Tech'][i % 10] + ' SA',
        clientSegment: i % 3 === 0 ? 'Large Corporate' : i % 3 === 1 ? 'Mid-market' : 'SME',
        clientRating: ['A', 'BBB', 'BB', 'A'][i % 4],
        recommendedProduct: ['FX_Hedging', 'Corporate_Loan', 'ESG_Green_Loan', 'Trade_Finance', 'Cash_Management'][i % 5],
        recommendedVolumeEur: (500_000 * (1 + (i % 5))),
        expectedClvDeltaEur: 120_000 + (i * 35_000),
        confidence: 0.55 + (i * 0.03),
        reasonCodes: i % 2 === 0 ? ['product_gap_core', 'renewal_window_open'] : ['cross_sell_cohort_signal'],
        rationale: `${['FX_Hedging', 'Corporate_Loan', 'ESG_Green_Loan'][i % 3]} ticket — ΔCLV ${((i + 1) * 1.2).toFixed(1)}%`,
      }),
    ),
  )],
};

export const ConsumedOnly: Story = {
  decorators: [withSeededCache([
    nba({ id: 'n-c-1', clientName: 'Already-acted Client', consumedAt: '2026-04-21T14:00:00Z', consumedBy: 'rm@bank.es', expectedClvDeltaEur: 280_000 }),
  ], 'consumed')],
};
