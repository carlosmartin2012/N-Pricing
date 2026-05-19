// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketBenchmarksView from '../MarketBenchmarksView';
import { translations } from '../../../translations';

const mocks = vi.hoisted(() => ({
  useMarketBenchmarksQuery: vi.fn(),
  useUpsertMarketBenchmarkMutation: vi.fn(),
  useDeleteMarketBenchmarkMutation: vi.fn(),
  useImportMarketBenchmarksCsvMutation: vi.fn(),
  upsert: vi.fn(),
  deleteBenchmark: vi.fn(),
  importCsv: vi.fn(),
  addToast: vi.fn(),
  currentUser: { id: 'u1', email: 'admin@nfq.es', name: 'Admin', role: 'Admin' },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mocks.currentUser }),
}));

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => async () => true,
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ t: translations.en }),
}));

vi.mock('../../../hooks/queries/useMarketBenchmarksQuery', () => ({
  useMarketBenchmarksQuery: mocks.useMarketBenchmarksQuery,
  useUpsertMarketBenchmarkMutation: mocks.useUpsertMarketBenchmarkMutation,
  useDeleteMarketBenchmarkMutation: mocks.useDeleteMarketBenchmarkMutation,
  useImportMarketBenchmarksCsvMutation: mocks.useImportMarketBenchmarksCsvMutation,
}));

const ROW = {
  id: 'b1',
  productType: 'LOAN_COMM',
  tenorBucket: 'MT' as const,
  clientType: 'Corporate',
  currency: 'EUR',
  rate: 4.22,
  source: 'BBG',
  asOfDate: '2026-04-23',
  notes: 'Corporate MT',
};

describe('MarketBenchmarksView', () => {
  beforeEach(() => {
    mocks.upsert.mockReset().mockResolvedValue(ROW);
    mocks.deleteBenchmark.mockReset().mockResolvedValue(true);
    mocks.importCsv.mockReset().mockResolvedValue({ inserted: 1, updated: 0, errors: [] });
    mocks.addToast.mockReset();
    mocks.currentUser = { id: 'u1', email: 'admin@nfq.es', name: 'Admin', role: 'Admin' };
    mocks.useMarketBenchmarksQuery.mockReset().mockReturnValue({
      data: [ROW],
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.useUpsertMarketBenchmarkMutation.mockReturnValue({ mutateAsync: mocks.upsert, isPending: false });
    mocks.useDeleteMarketBenchmarkMutation.mockReturnValue({ mutateAsync: mocks.deleteBenchmark, isPending: false });
    mocks.useImportMarketBenchmarksCsvMutation.mockReturnValue({ mutateAsync: mocks.importCsv, isPending: false });
  });

  it('renders benchmark rows and saves an edited row through the market benchmark API', async () => {
    const user = userEvent.setup();
    render(<MarketBenchmarksView />);

    expect(screen.getByText('LOAN_COMM')).toBeInTheDocument();
    expect(screen.getByText('4.22%')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '' })[0]);
    await user.clear(screen.getByLabelText('Rate'));
    await user.type(screen.getByLabelText('Rate'), '4.35');
    await user.click(screen.getByRole('button', { name: /save benchmark/i }));

    await waitFor(() => {
      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'b1',
          productType: 'LOAN_COMM',
          tenorBucket: 'MT',
          clientType: 'Corporate',
          currency: 'EUR',
          rate: 4.35,
          source: 'BBG',
          asOfDate: '2026-04-23',
          notes: 'Corporate MT',
        }),
      );
    });
  });

  it('imports pasted CSV rows for admin users', async () => {
    const user = userEvent.setup();
    render(<MarketBenchmarksView />);

    await user.type(
      screen.getByPlaceholderText(/productType,tenorBucket/i),
      'productType,tenorBucket,clientType,currency,rate,source\nLOAN_COMM,MT,Corporate,EUR,4.22,BBG',
    );
    await user.click(screen.getByRole('button', { name: /import csv/i }));

    await waitFor(() => {
      expect(mocks.importCsv).toHaveBeenCalledWith(expect.stringContaining('LOAN_COMM,MT,Corporate'));
    });
  });

  it('renders read-only when the user is not admin', () => {
    mocks.currentUser = { id: 'u2', email: 'trader@nfq.es', name: 'Trader', role: 'Trader' };
    render(<MarketBenchmarksView />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save benchmark/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});
