import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import BudgetReconciliationView from './BudgetReconciliationView';
import { UIProvider } from '../../contexts/UIContext';
import type { BudgetVarianceItem } from '../../utils/budget/budgetReconciler';

/**
 * Storybook variants for BudgetReconciliationView (Ola 9 Bloque C).
 *
 * Pre-seed la cache con queryKeys.budget.comparison(period). Period
 * por defecto es el del mes actual — usamos un getter para que
 * cualquier story tome el periodo correcto al renderizar.
 */

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

const ITEMS_MIX: BudgetVarianceItem[] = [
  {
    period: currentPeriod(), segment: 'SME', productType: 'loan', currency: 'EUR',
    budgetedRateBps: 500, realizedRateBps: 497, diffRateBps: -3,
    budgetedVolumeEur: 1_000_000, realizedVolumeEur: 1_021_000,
    diffVolumeEur: 21_000, diffVolumePct: 0.021,
    budgetedRarocPp: 14, realizedRarocPp: 14.2, diffRarocPp: 0.2,
    dealCount: 32, presentInBudget: true, presentInRealized: true, status: 'on_track',
  },
  {
    period: currentPeriod(), segment: 'SME', productType: 'mortgage', currency: 'EUR',
    budgetedRateBps: 420, realizedRateBps: 402, diffRateBps: -18,
    budgetedVolumeEur: 800_000, realizedVolumeEur: 867_200,
    diffVolumeEur: 67_200, diffVolumePct: 0.084,
    budgetedRarocPp: 12, realizedRarocPp: 11.4, diffRarocPp: -0.6,
    dealCount: 18, presentInBudget: true, presentInRealized: true, status: 'under_budget_rate',
  },
  {
    period: currentPeriod(), segment: 'Corporate', productType: 'loan', currency: 'EUR',
    budgetedRateBps: 380, realizedRateBps: 385, diffRateBps: 5,
    budgetedVolumeEur: 5_000_000, realizedVolumeEur: 5_935_000,
    diffVolumeEur: 935_000, diffVolumePct: 0.187,
    budgetedRarocPp: 11, realizedRarocPp: 11.1, diffRarocPp: 0.1,
    dealCount: 8, presentInBudget: true, presentInRealized: true, status: 'over_budget_volume',
  },
  {
    period: currentPeriod(), segment: 'Retail', productType: 'credit-line', currency: 'EUR',
    budgetedRateBps: 650, realizedRateBps: null, diffRateBps: null,
    budgetedVolumeEur: 200_000, realizedVolumeEur: null,
    diffVolumeEur: null, diffVolumePct: null,
    budgetedRarocPp: 16, realizedRarocPp: null, diffRarocPp: null,
    dealCount: 0, presentInBudget: true, presentInRealized: false, status: 'budget_only',
  },
];

const RESPONSE_MIX = {
  period: currentPeriod(),
  rateToleranceBps:   5,
  volumeTolerancePct: 0.10,
  summary: {
    period:                 currentPeriod(),
    total: 4, onTrack: 1, overRate: 0, underRate: 1, overVolume: 1, underVolume: 0,
    budgetOnly: 1, realizedOnly: 0,
    totalBudgetedVolumeEur: 7_000_000, totalRealizedVolumeEur: 7_823_200,
    weightedAvgDiffRateBps: -2.4,
  },
  items: ITEMS_MIX,
};

const RESPONSE_EMPTY = {
  period: currentPeriod(),
  rateToleranceBps:   5,
  volumeTolerancePct: 0.10,
  summary: {
    period:                 currentPeriod(),
    total: 0, onTrack: 0, overRate: 0, underRate: 0, overVolume: 0, underVolume: 0,
    budgetOnly: 0, realizedOnly: 0,
    totalBudgetedVolumeEur: 0, totalRealizedVolumeEur: 0,
    weightedAvgDiffRateBps: 0,
  },
  items: [],
};

function withSeededCache(response: typeof RESPONSE_MIX) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['budget', 'comparison', response.period], response);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', minHeight: '100vh' }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Budget/BudgetReconciliationView',
  component: BudgetReconciliationView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BudgetReconciliationView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mix realista — on_track + under_rate + over_volume + budget_only. */
export const Mixed: Story = {
  decorators: [withSeededCache(RESPONSE_MIX)],
};

/** Tenant nuevo — sin assumptions ALQUID configuradas. */
export const Empty: Story = {
  decorators: [withSeededCache(RESPONSE_EMPTY)],
};
