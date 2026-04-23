// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MarketRateChip from '../MarketRateChip';
import type { Transaction } from '../../../types';

const mocks = vi.hoisted(() => ({
  useMarketBenchmarksQuery: vi.fn(),
}));

vi.mock('../../../hooks/queries/useMarketBenchmarksQuery', () => ({
  useMarketBenchmarksQuery: mocks.useMarketBenchmarksQuery,
}));

function makeDeal(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'D-ITEST',
    status: 'Draft',
    clientId: 'C-1',
    productType: 'LOAN_COMM',
    clientType: 'Corporate',
    currency: 'EUR',
    amount: 1_000_000,
    durationMonths: 36,
    ...overrides,
  } as Transaction;
}

const CORP_EUR_BENCHMARK = {
  id: 'b1',
  productType: 'LOAN_COMM',
  tenorBucket: 'MT' as const,
  clientType: 'Corporate',
  currency: 'EUR',
  rate: 4.22,
  source: 'BBG',
  asOfDate: '2026-04-01',
  notes: null,
};

describe('MarketRateChip', () => {
  beforeEach(() => {
    mocks.useMarketBenchmarksQuery.mockReset();
  });

  it('renders nothing when no benchmark matches the tuple', () => {
    mocks.useMarketBenchmarksQuery.mockReturnValue({ data: [] });
    const { container } = render(
      <MarketRateChip deal={makeDeal()} finalClientRatePct={4.3} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('flags BELOW market when the quote is ≥5bp under the benchmark', () => {
    mocks.useMarketBenchmarksQuery.mockReturnValue({ data: [CORP_EUR_BENCHMARK] });
    render(<MarketRateChip deal={makeDeal()} finalClientRatePct={4.05} />);
    expect(screen.getByTestId('market-rate-chip')).toBeInTheDocument();
    expect(screen.getByText('4.22%')).toBeInTheDocument();
    expect(screen.getByText('(BBG)')).toBeInTheDocument();
    expect(screen.getByText(/-17 bp vs market/)).toBeInTheDocument();
  });

  it('flags ABOVE market when the quote is ≥5bp over the benchmark', () => {
    mocks.useMarketBenchmarksQuery.mockReturnValue({ data: [CORP_EUR_BENCHMARK] });
    render(<MarketRateChip deal={makeDeal()} finalClientRatePct={4.45} />);
    expect(screen.getByText(/\+23 bp vs market/)).toBeInTheDocument();
  });

  it('flags ON_MARKET when within ±5bp', () => {
    mocks.useMarketBenchmarksQuery.mockReturnValue({ data: [CORP_EUR_BENCHMARK] });
    render(<MarketRateChip deal={makeDeal()} finalClientRatePct={4.25} />);
    // deltaBp = round((4.25 - 4.22) * 100) = 3 → ON_MARKET band (±5).
    expect(screen.getByText(/\+3 bp vs market/)).toBeInTheDocument();
  });
});
