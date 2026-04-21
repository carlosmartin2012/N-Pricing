import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import NbaRecommendationCard from './NbaRecommendationCard';
import { UIProvider } from '../../contexts/UIContext';
import type { NbaRecommendation } from '../../types/clv';

const BASE_REC: NbaRecommendation = {
  id: 'nba-1',
  entityId: 'ent-1',
  clientId: 'demo-1',
  recommendedProduct: 'FX_Hedging',
  recommendedRateBps: 40,
  recommendedVolumeEur: 1_500_000,
  recommendedCurrency: 'EUR',
  expectedClvDeltaEur: 320_000,
  confidence: 0.82,
  reasonCodes: ['product_gap_core', 'renewal_window_open'],
  rationale: 'FX_Hedging ticket €1.5M → ΔCLV 2.1% · renewal window open · core product gap',
  source: 'engine',
  generatedAt: '2026-04-22T10:00:00Z',
  consumedAt: null,
  consumedBy: null,
};

function withSeededCache(recs: NbaRecommendation[]) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['clv', 'nba', 'demo-1', true], recs);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 640 }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Customer360/NbaRecommendationCard',
  component: NbaRecommendationCard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NbaRecommendationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([])],
};

export const SingleHighConfidence: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([BASE_REC])],
};

export const ThreeRecommendationsStackRanked: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([
    { ...BASE_REC, id: 'n1', recommendedProduct: 'ESG_Green_Loan', recommendedVolumeEur: 3_000_000, expectedClvDeltaEur: 410_000, confidence: 0.85,
      reasonCodes: ['regulatory_incentive_available', 'nim_below_target'],
      rationale: 'ESG_Green_Loan ticket €3M → ΔCLV 4.6% · regulatory incentive · lifts NIM toward target' },
    { ...BASE_REC, id: 'n2', recommendedProduct: 'FX_Hedging',    recommendedVolumeEur: 1_500_000, expectedClvDeltaEur: 320_000, confidence: 0.78,
      reasonCodes: ['product_gap_core', 'renewal_window_open'] },
    { ...BASE_REC, id: 'n3', recommendedProduct: 'Trade_Finance', recommendedVolumeEur:   800_000, expectedClvDeltaEur: 115_000, confidence: 0.62,
      reasonCodes: ['capacity_underused'],
      rationale: 'Trade finance €800K → ΔCLV 1.4% · capacity underused' },
  ])],
};

export const LowConfidenceOnly: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([
    { ...BASE_REC, id: 'low-1', confidence: 0.35, expectedClvDeltaEur: 45_000,
      reasonCodes: ['capacity_underused'],
      rationale: 'Exploratory — low signal, high variance' },
  ])],
};
