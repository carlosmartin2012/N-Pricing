// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { translations } from '../../../translations';

// We re-import DataFreshnessStrip inside each test after re-mocking
// DataContext, since the strip now conditionally returns null when the
// data state is healthy (live mode + recent sync). The freshness metadata
// is ambient chrome that hides when there's nothing to warn about.

const useDataMock = vi.fn();

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({ activeEntity: { shortCode: 'NFQ', name: 'NFQ Advisory' } }),
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ t: translations.en, workspaceMode: 'Trader' }),
}));

describe('DataFreshnessStrip', () => {
  beforeEach(() => {
    useDataMock.mockReset();
  });

  it('renders nothing when data is healthy (live mode + recent sync)', async () => {
    useDataMock.mockReturnValue({
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
    });
    const { DataFreshnessStrip } = await import('../DataFreshnessStrip');
    const { container } = render(<DataFreshnessStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('summarizes source freshness, active entity and workspace mode when in fallback (demo) mode', async () => {
    useDataMock.mockReturnValue({
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
      dataMode: 'demo',
      syncStatus: 'mock',
    });
    const { DataFreshnessStrip } = await import('../DataFreshnessStrip');
    render(<DataFreshnessStrip />);

    expect(screen.getByTestId('data-freshness-strip')).toBeInTheDocument();
    expect(screen.getByText(/Curves:/)).toBeInTheDocument();
    expect(screen.getByText(/Sources:/)).toBeInTheDocument();
    expect(screen.getByText(/Workspace mode:/)).toBeInTheDocument();
  });
});
