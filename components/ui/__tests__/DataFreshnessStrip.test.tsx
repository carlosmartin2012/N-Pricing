// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataFreshnessStrip } from '../DataFreshnessStrip';
import { translations } from '../../../translations';

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => ({
    marketDataSources: [
      {
        id: 'SRC-1',
        name: 'ECB',
        provider: 'ECB',
        sourceType: 'YieldCurve',
        status: 'Active',
        currencies: ['EUR'],
        lastSyncAt: new Date().toISOString(),
      },
    ],
    yieldCurves: [{ currency: 'EUR', tenor: '1Y', rate: 0.03 }],
    liquidityCurves: [{ id: 'LIQ-1', name: 'EUR Liquidity', currency: 'EUR', points: [{ tenor: '1Y', spread: 0.01 }] }],
    dataMode: 'live',
    syncStatus: 'synced',
  }),
}));

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({ activeEntity: { shortCode: 'NFQ', name: 'NFQ Advisory' } }),
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ t: translations.en, workspaceMode: 'Trader' }),
}));

describe('DataFreshnessStrip', () => {
  it('summarizes source freshness, active entity and workspace mode', () => {
    render(<DataFreshnessStrip />);

    expect(screen.getByTestId('data-freshness-strip')).toBeInTheDocument();
    expect(screen.getByText('Data ready')).toBeInTheDocument();
    expect(screen.getByText(/Curves:/)).toBeInTheDocument();
    expect(screen.getByText(/Sources:/)).toBeInTheDocument();
    expect(screen.getByText(/Workspace mode:/)).toBeInTheDocument();
  });
});
