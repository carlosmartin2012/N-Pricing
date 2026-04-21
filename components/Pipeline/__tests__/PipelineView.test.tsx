// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PipelineView from '../PipelineView';
import type { PipelineNbaRow } from '../../../types/clv';

const api = vi.hoisted(() => ({
  listPipelineNba: vi.fn(),
  consumeNba: vi.fn(),
}));

vi.mock('../../../api/clv', () => api);

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({ activeEntity: { id: 'e-1', shortCode: 'BANK-ES' } }),
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ language: 'en' as const }),
}));

function row(overrides: Partial<PipelineNbaRow> = {}): PipelineNbaRow {
  return {
    id: 'pnba-1',
    entityId: 'e-1',
    clientId: 'c-1',
    clientName: 'Client A',
    clientSegment: 'Large',
    clientRating: 'A',
    recommendedProduct: 'FX_Hedging',
    recommendedRateBps: 40,
    recommendedVolumeEur: 1_500_000,
    recommendedCurrency: 'EUR',
    expectedClvDeltaEur: 320_000,
    confidence: 0.82,
    reasonCodes: ['product_gap_core'],
    rationale: 'Cool rationale',
    source: 'engine',
    generatedAt: '2026-04-22T10:00:00Z',
    consumedAt: null,
    consumedBy: null,
    ...overrides,
  };
}

function mount(rows: PipelineNbaRow[]) {
  api.listPipelineNba.mockResolvedValue(rows);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PipelineView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PipelineView', () => {
  it('renders the header and KPI tiles', async () => {
    mount([row()]);
    expect(await screen.findByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Clients covered')).toBeInTheDocument();
    expect(screen.getByText(/Total expected ΔCLV/i)).toBeInTheDocument();
  });

  it('renders one row per recommendation with client and product', async () => {
    mount([
      row({ id: 'p1', clientName: 'Client A', recommendedProduct: 'FX_Hedging' }),
      row({ id: 'p2', clientName: 'Client B', recommendedProduct: 'ESG_Green_Loan' }),
    ]);
    expect(await screen.findByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Client B')).toBeInTheDocument();
    // Product appears in both the feed row and the filter <option> — scope to feed.
    const feed = screen.getByTestId('pipeline-feed');
    expect(feed.textContent).toContain('FX_Hedging');
    expect(feed.textContent).toContain('ESG_Green_Loan');
  });

  it('sorts rows by ΔCLV descending', async () => {
    mount([
      row({ id: 'p-small', clientName: 'SMALL', expectedClvDeltaEur: 10_000 }),
      row({ id: 'p-big',   clientName: 'BIG',   expectedClvDeltaEur: 500_000 }),
    ]);
    await screen.findByText('BIG');
    const feed = screen.getByTestId('pipeline-feed');
    const items = feed.querySelectorAll('li');
    expect(items[0].textContent).toContain('BIG');
    expect(items[1].textContent).toContain('SMALL');
  });

  it('filters by product', async () => {
    mount([
      row({ id: 'p1', clientName: 'A', recommendedProduct: 'FX_Hedging' }),
      row({ id: 'p2', clientName: 'B', recommendedProduct: 'ESG_Green_Loan' }),
    ]);
    await screen.findByText('A');
    fireEvent.change(screen.getByTestId('pipeline-filter-product'), {
      target: { value: 'FX_Hedging' },
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  it('filters by confidence band (high = >=80%)', async () => {
    mount([
      row({ id: 'p-high', clientName: 'HIGH', confidence: 0.9 }),
      row({ id: 'p-low',  clientName: 'LOW',  confidence: 0.5 }),
    ]);
    await screen.findByText('HIGH');
    fireEvent.change(screen.getByTestId('pipeline-filter-confidence'), {
      target: { value: 'high' },
    });
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.queryByText('LOW')).not.toBeInTheDocument();
  });

  it('renders empty state when no recommendations', async () => {
    mount([]);
    expect(
      await screen.findByText(/No open recommendations/i),
    ).toBeInTheDocument();
  });

  it('switches status filter and triggers refetch', async () => {
    mount([row()]);
    await screen.findByText('Client A');
    fireEvent.click(screen.getByTestId('pipeline-status-consumed'));
    // The API should have been called again with status=consumed on filter flip
    expect(api.listPipelineNba).toHaveBeenCalledWith('consumed');
  });
});
