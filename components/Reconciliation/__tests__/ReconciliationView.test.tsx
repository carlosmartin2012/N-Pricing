// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReconciliationView from '../ReconciliationView';
import type { EntryPair, ReconciliationSummary } from '../../../types/reconciliation';

const api = vi.hoisted(() => ({
  getReconciliationSummary: vi.fn(),
  getReconciliationEntries: vi.fn(),
}));

vi.mock('../../../api/reconciliation', () => api);

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({ activeEntity: { id: 'e-1', shortCode: 'BANK-ES' } }),
}));

function pair(overrides: Partial<EntryPair> = {}): EntryPair {
  return {
    dealId: 'D-1',
    clientId: 'C-1',
    clientName: 'Acme',
    businessUnit: 'BU_CORP',
    productType: 'Loan',
    bu:       { dealId: 'D-1', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    treasury: { dealId: 'D-1', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    matchStatus: 'matched',
    amountDeltaEur: 0,
    rateDeltaPct: 0,
    hint: null,
    ...overrides,
  };
}

function summary(overrides: Partial<ReconciliationSummary> = {}): ReconciliationSummary {
  return {
    asOfPeriod: '2026-04',
    computedAt: '2026-04-23T10:00:00Z',
    totalEntries: 0,
    matched: 0,
    unmatched: 0,
    unknown: 0,
    amountMismatchEur: 0,
    maxSingleDeltaEur: 0,
    byStatus: {
      matched: 0, amount_mismatch: 0, rate_mismatch: 0, currency_mismatch: 0,
      bu_only: 0, treasury_only: 0, unknown: 0,
    },
    ...overrides,
  };
}

function mount(s: ReconciliationSummary, pairs: EntryPair[]) {
  api.getReconciliationSummary.mockResolvedValue({ summary: s, pairs });
  api.getReconciliationEntries.mockResolvedValue(pairs);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReconciliationView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReconciliationView', () => {
  it('renders header + 4 KPI tiles + filter chips', async () => {
    mount(summary(), []);
    expect(await screen.findByText('FTP Reconciliation')).toBeInTheDocument();
    // KPI tile labels — "Matched" appears in 3 places (KPI label, filter
    // chip, status pill); guard via testid for the filter and just count
    // ≥ 1 occurrence for the rest.
    expect(screen.getAllByText('Matched').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unmatched').length).toBeGreaterThan(0);
    expect(screen.getByText('Total amount delta')).toBeInTheDocument();
    expect(screen.getByText('Max single delta')).toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-filter-all')).toBeInTheDocument();
  });

  it('renders empty state when no entries', async () => {
    mount(summary(), []);
    expect(await screen.findByTestId('reconciliation-empty')).toBeInTheDocument();
  });

  it('renders one row per pair', async () => {
    const pairs = [
      pair({ dealId: 'D-1', clientName: 'Alpha' }),
      pair({ dealId: 'D-2', clientName: 'Beta', matchStatus: 'amount_mismatch', amountDeltaEur: 500 }),
    ];
    const s = summary({ totalEntries: 2, matched: 1, unmatched: 1, byStatus: {
      matched: 1, amount_mismatch: 1, rate_mismatch: 0, currency_mismatch: 0,
      bu_only: 0, treasury_only: 0, unknown: 0,
    }});
    mount(s, pairs);
    expect(await screen.findByTestId('reconciliation-row-D-1')).toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-row-D-2')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('filter chip narrows visible rows', async () => {
    const pairs = [
      pair({ dealId: 'D-1', matchStatus: 'matched' }),
      pair({ dealId: 'D-2', matchStatus: 'amount_mismatch', amountDeltaEur: 500 }),
    ];
    mount(summary({ totalEntries: 2 }), pairs);
    await screen.findByTestId('reconciliation-row-D-1');
    fireEvent.click(screen.getByTestId('reconciliation-filter-amount_mismatch'));
    expect(screen.queryByTestId('reconciliation-row-D-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('reconciliation-row-D-2')).toBeInTheDocument();
  });

  it('shows matched percentage when summary has totals', async () => {
    const s = summary({ totalEntries: 4, matched: 3, unmatched: 1 });
    mount(s, [pair({ dealId: 'D-1' })]);
    // findByText awaits React Query data so the summary derived KPIs
    // have time to render before assertion.
    expect(await screen.findByText(/75\.0%/)).toBeInTheDocument();
  });

  it('export CSV button is disabled when feed is empty', async () => {
    mount(summary(), []);
    await screen.findByText('FTP Reconciliation');
    expect(screen.getByTestId('reconciliation-export-csv')).toBeDisabled();
  });

  it('row contains Open deep-link to /blotter', async () => {
    mount(summary({ totalEntries: 1 }), [pair({ dealId: 'D-XYZ' })]);
    const link = await screen.findByTestId('reconciliation-row-open-D-XYZ');
    expect(link).toHaveAttribute('href', expect.stringContaining('/blotter'));
    expect(link).toHaveAttribute('href', expect.stringContaining('dealId=D-XYZ'));
  });
});
